// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { getBaseMetadata } from '../base/BaseMetadata';
import { RuleMetadata } from '../internal/metadata/ValidationMetadata';
import { ValidationError } from './ValidationError';

/**
 * The sentinel rule name for {@link IsOptional}. Tracked by name so
 * that `validate` can short-circuit all other rules when the value
 * is absent, without coupling the engine to the decorator module.
 */
const IS_OPTIONAL_RULE_NAME = 'IsOptional';

/**
 * Validates a value against the rules attached to its class and any
 * nested validatable classes it contains.
 *
 * Behavior:
 * - **Deep by default.** Any property whose value is a class instance
 *   with registered rules is validated recursively. Same for arrays
 *   of such instances. Callers never need to annotate nested types.
 * - **Arrays are declared, then value rules iterate.** An array-typed
 *   property must carry an array-level rule (`operatesOn: 'array'` —
 *   e.g. `IsArray`, `ArrayMinSize`), which receives the whole array.
 *   Only then do value-level rules apply per-element (error paths
 *   include the index, `items[2].email`). Without an array-level rule a
 *   value rule evaluates the value itself, so an array on a scalar
 *   property is rejected rather than silently iterated.
 * - **`IsOptional` short-circuits.** When a property carries
 *   `@VerifyIsOptional()` and its value is `null` / `undefined`,
 *   all other rules on the property are skipped.
 * - **Cycles are safe.** A visited set prevents infinite recursion
 *   through self-referential object graphs.
 *
 * Returns a flat array of {@link ValidationError}. An empty array
 * means the value passed validation.
 */
export async function validate(value: unknown): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const visited = new WeakSet<object>();
    walk(value, '', errors, visited);
    return errors;
}

function walk(
    value: unknown,
    path: string,
    errors: ValidationError[],
    visited: WeakSet<object>,
): void {
    if (value === null || value === undefined) return;
    if (typeof value !== 'object') return;
    if (visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            walk(value[i], `${path}[${i}]`, errors, visited);
        }
        return;
    }

    const ctor = (value as object).constructor;
    if (!ctor || ctor === Object) return;

    const rules = getBaseMetadata().validation.getAllFor(ctor);

    // Apply rules per property.
    const rulesByProperty = groupByProperty(rules);
    for (const [property, propertyRules] of rulesByProperty) {
        const propertyValue = (value as Record<string, unknown>)[property];
        const propertyPath = joinPath(path, property);
        applyRules(
            value as object,
            property,
            propertyValue,
            propertyRules,
            propertyPath,
            errors,
        );
    }

    // Recurse into every own enumerable property that might contain
    // further validatable values, regardless of whether the current
    // class has rules on it — a rule-less intermediate object may
    // still contain a deeply-nested validatable child.
    for (const key of Object.keys(value as object)) {
        const child = (value as Record<string, unknown>)[key];
        if (child === null || child === undefined) continue;
        if (typeof child !== 'object') continue;
        walk(child, joinPath(path, key), errors, visited);
    }
}

function applyRules(
    target: object,
    property: string,
    propertyValue: unknown,
    rules: RuleMetadata[],
    propertyPath: string,
    errors: ValidationError[],
): void {
    // IsOptional short-circuits all other rules on this property
    // when the value is absent.
    const hasOptional = rules.some(
        (rule) => rule.ruleName === IS_OPTIONAL_RULE_NAME,
    );
    if (
        hasOptional &&
        (propertyValue === null || propertyValue === undefined)
    ) {
        return;
    }

    // A value-level rule auto-iterates an array ONLY when the property is
    // declared as an array with an array-level rule (@VerifyIsArray etc.).
    // Otherwise a value-level rule evaluates the value itself, so an array
    // sent for a scalar property FAILS the rule instead of silently iterating
    // — an empty array would otherwise run zero checks and bypass every rule.
    // (The `verify-array-parity` lint rule enforces that an array-typed
    // property carrying value rules also declares an array-level rule.)
    const declaredAsArray = rules.some((rule) => rule.operatesOn === 'array');

    for (const rule of rules) {
        if (rule.ruleName === IS_OPTIONAL_RULE_NAME) continue;

        if (rule.operatesOn === 'array') {
            evaluate(
                rule,
                target,
                property,
                propertyValue,
                propertyPath,
                errors,
            );
        } else if (Array.isArray(propertyValue) && declaredAsArray) {
            for (let i = 0; i < propertyValue.length; i++) {
                evaluate(
                    rule,
                    target,
                    property,
                    propertyValue[i],
                    `${propertyPath}[${i}]`,
                    errors,
                );
            }
        } else {
            evaluate(
                rule,
                target,
                property,
                propertyValue,
                propertyPath,
                errors,
            );
        }
    }
}

function evaluate(
    rule: RuleMetadata,
    target: object,
    property: string,
    value: unknown,
    path: string,
    errors: ValidationError[],
): void {
    const context = { target, property, value, options: rule.options };
    const result = rule.check(value, rule.options, context);
    if (result === true) return;

    const message = typeof result === 'string' ? result : rule.message(context);

    // Merge into an existing error at the same path so multiple
    // failed rules on one property appear under a single entry.
    const existing = errors.find((error) => error.path === path);
    if (existing) {
        (existing.constraints as Record<string, string>)[rule.ruleName] =
            message;
        return;
    }

    errors.push({
        path,
        value,
        constraints: { [rule.ruleName]: message },
    });
}

function groupByProperty(rules: RuleMetadata[]): Map<string, RuleMetadata[]> {
    const map = new Map<string, RuleMetadata[]>();
    for (const rule of rules) {
        let list = map.get(rule.propertyName);
        if (!list) {
            list = [];
            map.set(rule.propertyName, list);
        }
        list.push(rule);
    }
    return map;
}

function joinPath(parent: string, child: string): string {
    return parent ? `${parent}.${child}` : child;
}

/**
 * Public view of a single registered rule. Deliberately omits the
 * raw `check` and `message` functions — those are framework
 * internals. Consumers (e.g. CLI schema metadata emission) only need
 * the rule name, property, options, and shape.
 */
export interface PublicRuleMetadata {
    readonly ruleName: string;
    readonly propertyName: string;
    readonly operatesOn: 'value' | 'array';
    readonly options: unknown;
}

/**
 * Return every rule registered against `target` and its ancestors,
 * in the public shape that omits internal callbacks.
 */
export function getValidationRules(target: Function): PublicRuleMetadata[] {
    return getBaseMetadata()
        .validation.getAllFor(target)
        .map((rule) => ({
            ruleName: rule.ruleName,
            propertyName: rule.propertyName,
            operatesOn: rule.operatesOn,
            options: rule.options,
        }));
}

/**
 * Find a registered class constructor by its name.
 *
 * Used by the CLI when emitting GraphQL schema metadata: we have a
 * type name string (the GraphQL input type) and need to resolve it
 * to the corresponding TypeScript class so we can read its rules.
 *
 * Returns `undefined` when no registered target matches.
 */
export function findValidationTargetByName(name: string): Function | undefined {
    for (const target of getBaseMetadata().validation.getRegisteredTargets()) {
        if (target.name === name) return target;
    }
    return undefined;
}
