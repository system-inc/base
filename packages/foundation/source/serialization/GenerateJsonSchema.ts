// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Json } from '@system-inc/base-common/json/Json';
import {
    Constructor,
    isConstructor,
} from '@system-inc/base-common/type/Constructor';
import { EnumLike, isEnumLike } from '@system-inc/base-common/type/EnumLike';
import { TypeFunc } from '@system-inc/base-common/type/TypeFunc';
import { Mutable } from '@system-inc/base-common/type/UtilityTypes';
import { getBaseMetadata } from '../base/BaseMetadata';
import { RuleMetadata } from '../internal/metadata/ValidationMetadata';
import { RuleJsonSchemaUnrepresentable } from '../validation/RuleJsonSchema';
import { isDeserializable } from './interfaces/Deserializable';
import { getSerializableMetadata } from './internal/SerializableMetadata';
import { JsonSchema, JsonSchemaType } from './JsonSchema';

/**
 * A type the generator describes: a `TypeFunc` (`() => Foo`,
 * `() => [Foo]`), a constructor, or an enum.
 */
export type JsonSchemaSource = TypeFunc | Constructor | EnumLike;

/**
 * Generates a JSON Schema (draft 2020-12) for a type `deserialize` accepts.
 *
 * The schema describes the type's declared contract:
 * - **Structure comes from serialization metadata.** Properties are keyed
 *   by wire name (`@SerializableField({ name })`), typed by the field's
 *   `TypeFunc`, and `required` unless `optional` or defaulted. Nested
 *   `@SerializableObject` classes go in `$defs`. A field with a
 *   `transformer` is `{}`, since its wire shape isn't known.
 * - **Constraints come from `@Verify*` rules** through each rule's
 *   `jsonSchema` mapping, and are never stricter than the rule: a value
 *   the rule accepts passes the keywords it maps to (see
 *   `RuleJsonSchemaMapping`). Unrepresentable rules are left out.
 *
 * The server is more lenient than the declared contract in two ways the
 * schema doesn't advertise: `deserialize` coerces a mistyped primitive
 * (`42` for a string field becomes `"42"`), and it accepts `null` for any
 * field that is present.
 *
 * A class at the root is inlined, so the result is an object schema with
 * `$defs` alongside. Output is deterministic: properties in declaration
 * order, `$defs` keys sorted.
 */
export function generateJsonSchema(type: JsonSchemaSource): JsonSchema {
    const builder = new JsonSchemaBuilder();
    const root = jsonSchemaRootClass(type);
    return builder.document(
        root ? builder.objectSchemaFor(root) : builder.schemaFor(type),
    );
}

/**
 * Builds schemas that share one set of `$defs`, for callers composing a
 * document from several types (an object whose properties are separate
 * types, for example). Use {@link schemaFor} for each part, then
 * {@link document} to attach the collected `$defs` to the root.
 */
export class JsonSchemaBuilder {
    private readonly definitionNames = new Map<Constructor, string>();
    private readonly definitions = new Map<string, JsonSchema>();

    /**
     * The schema for a type, referring to classes through `$defs`.
     */
    schemaFor(type: JsonSchemaSource): JsonSchema {
        if (isConstructor(type) || isEnumLike(type)) {
            return this.schemaForValue(type);
        }
        return this.schemaForValue(type());
    }

    /**
     * The object schema for a serializable class, inlined rather than
     * referenced (for a document root).
     */
    objectSchemaFor(ctor: Constructor): JsonSchema {
        const metadata = getSerializableMetadata(ctor);
        if (!metadata) {
            return {};
        }
        // a class with its own deserialize() accepts any object shape
        if (isDeserializable(ctor.prototype)) {
            return { type: 'object' };
        }

        const rules = getBaseMetadata().validation.getAllFor(ctor);
        const properties: Record<string, JsonSchema> = {};
        const required: string[] = [];
        for (const field of metadata.fields) {
            const key = field.options?.name ?? field.fieldName;
            const transformed = field.options?.transformer !== undefined;
            // a transformed field's wire value isn't the value the rules
            // check, so neither its type nor its rules describe the wire
            let schema: Mutable<JsonSchema> = transformed
                ? {}
                : withRules(
                      field.typeFunc ? this.schemaFor(field.typeFunc) : {},
                      rules.filter(
                          (rule) => rule.propertyName === field.fieldName,
                      ),
                  );
            if (field.options?.description !== undefined) {
                schema = { ...schema, description: field.options.description };
            }
            if (field.options && 'defaultValue' in field.options) {
                schema = {
                    ...schema,
                    default: field.options.defaultValue,
                };
            } else if (!field.options?.optional) {
                required.push(key);
            }
            properties[key] = schema;
        }

        return required.length > 0
            ? { type: 'object', properties, required }
            : { type: 'object', properties };
    }

    /**
     * Attaches the `$defs` collected so far to a root schema, keys sorted.
     */
    document(root: JsonSchema): JsonSchema {
        if (this.definitions.size === 0) {
            return root;
        }
        const $defs: Record<string, JsonSchema> = {};
        for (const name of [...this.definitions.keys()].sort()) {
            $defs[name] = this.definitions.get(name)!;
        }
        return { ...root, $defs };
    }

    private schemaForValue(value: unknown): JsonSchema {
        if (Array.isArray(value)) {
            return { type: 'array', items: this.schemaForValue(value[0]) };
        }
        if (isEnumLike(value)) {
            return { enum: enumValues(value) };
        }
        if (isConstructor(value)) {
            return this.schemaForConstructor(value);
        }
        return {};
    }

    private schemaForConstructor(ctor: Constructor): JsonSchema {
        switch (ctor) {
            case String:
                return { type: 'string' };
            case Number:
                return { type: 'number' };
            case Boolean:
                return { type: 'boolean' };
            // deserialize builds a Date from a string
            case Date:
                return { type: 'string' };
            // deserialize builds a BigInt from an integer or a string
            case BigInt as unknown as Constructor:
                return { type: ['integer', 'string'] };
        }
        if (!getSerializableMetadata(ctor)) {
            return {};
        }
        return { $ref: `#/$defs/${this.definitionName(ctor)}` };
    }

    /**
     * Registers the class in `$defs` on first use and returns its name.
     * The name is reserved before the schema is built, so a class that
     * refers to itself resolves to its own definition.
     */
    private definitionName(ctor: Constructor): string {
        const existing = this.definitionNames.get(ctor);
        if (existing) {
            return existing;
        }
        const base = ctor.name || 'Anonymous';
        let name = base;
        for (let suffix = 2; this.definitions.has(name); suffix++) {
            name = `${base}_${suffix}`;
        }
        this.definitionNames.set(ctor, name);
        this.definitions.set(name, {});
        this.definitions.set(name, this.objectSchemaFor(ctor));
        return name;
    }
}

/**
 * The serializable class a type names directly (not in an array or enum) —
 * the class {@link generateJsonSchema} inlines at the document root, whose
 * fields are then the root object's properties.
 */
export function jsonSchemaRootClass(
    type: JsonSchemaSource,
): Constructor | undefined {
    if (isEnumLike(type)) {
        return undefined;
    }
    const value = isConstructor(type) ? type : type();
    return isConstructor(value) && getSerializableMetadata(value)
        ? value
        : undefined;
}

/**
 * An enum's values, without the reverse mappings TypeScript adds to
 * numeric enums (`{ 0: 'A', A: 0 }` contributes only `0`).
 */
function enumValues(enumLike: EnumLike): (string | number)[] {
    return Object.entries(enumLike)
        .filter(
            ([key, value]) =>
                !(typeof value === 'string' && enumLike[value] === Number(key)),
        )
        .map(([, value]) => value);
}

/**
 * Layers a property's rules onto its declared schema, mirroring the
 * engine: when the property carries an array-level rule, value-level rules
 * apply to each item; otherwise every rule applies to the value itself.
 */
function withRules(
    declared: JsonSchema,
    rules: ReadonlyArray<RuleMetadata>,
): JsonSchema {
    const hasArrayRule = rules.some((rule) => rule.operatesOn === 'array');
    let schema = declared;
    let items = declared.items;
    for (const rule of rules) {
        const mapping = rule.jsonSchema;
        if (!mapping || mapping === RuleJsonSchemaUnrepresentable) {
            continue;
        }
        if (rule.operatesOn === 'value' && hasArrayRule) {
            const target = items ?? {};
            items = mergeJsonSchema(target, mapping(rule.options, target));
        } else {
            schema = mergeJsonSchema(schema, mapping(rule.options, schema));
        }
    }
    return items === undefined ? schema : { ...schema, items };
}

const LOWER_BOUNDS = new Set(['minimum', 'minLength', 'minItems']);
const UPPER_BOUNDS = new Set(['maximum', 'maxLength', 'maxItems']);

/**
 * Merges a rule's keywords into a schema. Bounds keep the tighter value,
 * `type` and `enum` intersect, and any other keyword already present with
 * a different value (two `pattern`s, say) goes into `allOf` so both apply.
 */
function mergeJsonSchema(base: JsonSchema, fragment: JsonSchema): JsonSchema {
    const merged: Record<string, unknown> = { ...base };
    const allOf: JsonSchema[] = [...(base.allOf ?? [])];
    for (const [keyword, value] of Object.entries(fragment)) {
        const existing = merged[keyword];
        if (existing === undefined) {
            merged[keyword] = value;
        } else if (LOWER_BOUNDS.has(keyword)) {
            merged[keyword] = Math.max(existing as number, value as number);
        } else if (UPPER_BOUNDS.has(keyword)) {
            merged[keyword] = Math.min(existing as number, value as number);
        } else if (keyword === 'type') {
            merged.type = narrowType(
                existing as JsonSchema['type'],
                value as JsonSchema['type'],
            );
        } else if (keyword === 'enum') {
            const allowed = value as Json[];
            merged.enum = (existing as Json[]).filter((entry) =>
                allowed.includes(entry),
            );
        } else if (JSON.stringify(existing) !== JSON.stringify(value)) {
            allOf.push({ [keyword]: value } as JsonSchema);
        }
    }
    if (allOf.length > 0) {
        merged.allOf = allOf;
    }
    return merged as JsonSchema;
}

/**
 * The intersection of two `type` keywords, where `integer` is a subset of
 * `number`. When they share nothing, the rule's type wins: the rule is
 * checked after `deserialize` coerces, so it's what the server enforces.
 */
function narrowType(
    declared: JsonSchema['type'],
    rule: JsonSchema['type'],
): JsonSchema['type'] {
    const toList = (type: JsonSchema['type']): JsonSchemaType[] =>
        type === undefined
            ? []
            : Array.isArray(type)
              ? [...type]
              : [type as JsonSchemaType];
    const ruleTypes = toList(rule);
    const shared = new Set<JsonSchemaType>();
    for (const type of toList(declared)) {
        if (ruleTypes.includes(type)) {
            shared.add(type);
        } else if (type === 'number' && ruleTypes.includes('integer')) {
            shared.add('integer');
        } else if (type === 'integer' && ruleTypes.includes('number')) {
            shared.add('integer');
        }
    }
    const types = shared.size > 0 ? [...shared] : ruleTypes;
    return types.length === 1 ? types[0] : types;
}
