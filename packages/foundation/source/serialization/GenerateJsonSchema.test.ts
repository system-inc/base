// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Ajv2020 } from 'ajv/dist/2020';

import { Json } from '@system-inc/base-common/json/Json';
import { DateJsonValueTransformer } from '@system-inc/base-common/json/value-transformer/DateJsonValueTransformer';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { VerifyArrayMinSize } from '../validation/decorators/VerifyArrayMinSize';
import { VerifyArrayUnique } from '../validation/decorators/VerifyArrayUnique';
import { VerifyIsDate } from '../validation/decorators/VerifyIsDate';
import { VerifyIsEmail } from '../validation/decorators/VerifyIsEmail';
import { VerifyIsEnum } from '../validation/decorators/VerifyIsEnum';
import { VerifyIsInt } from '../validation/decorators/VerifyIsInt';
import { VerifyIsOptional } from '../validation/decorators/VerifyIsOptional';
import { VerifyLength } from '../validation/decorators/VerifyLength';
import { VerifyMax } from '../validation/decorators/VerifyMax';
import { VerifyMaxLength } from '../validation/decorators/VerifyMaxLength';
import { VerifyMin } from '../validation/decorators/VerifyMin';
import { VerifyMinLength } from '../validation/decorators/VerifyMinLength';
import { VerifyStringMatches } from '../validation/decorators/VerifyStringMatches';
import { validate } from '../validation/ValidationEngine';
import { SerializableField } from './decorators/SerializableField';
import { SerializableObject } from './decorators/SerializableObject';
import { deserialize } from './Deserialize';
import { generateJsonSchema, JsonSchemaBuilder } from './GenerateJsonSchema';
import { Deserializable } from './interfaces/Deserializable';

@SerializableObject()
class SchemaProfile {
    @SerializableField(() => String, { description: 'The display name.' })
    name: string;

    @VerifyIsOptional()
    @VerifyMaxLength(20)
    @SerializableField(() => String, { name: 'nick_name', optional: true })
    nickName?: string;

    @SerializableField(() => Boolean, { defaultValue: false })
    verified: boolean;

    @VerifyIsDate()
    @SerializableField(() => Date, { transformer: DateJsonValueTransformer })
    joined: Date;
}

@SerializableObject()
class SchemaAddress {
    @SerializableField(() => String)
    city: string;
}

@SerializableObject()
class SchemaPerson {
    @SerializableField(() => SchemaAddress)
    home: SchemaAddress;

    @SerializableField(() => [SchemaAddress], { optional: true })
    others?: SchemaAddress[];

    @SerializableField(() => SchemaPerson, { optional: true })
    manager?: SchemaPerson;
}

@SerializableObject()
class SchemaTags {
    // value-level rules apply to each item once an array-level rule exists
    @VerifyArrayMinSize(1)
    @VerifyArrayUnique()
    @VerifyMaxLength(5)
    @SerializableField(() => [String])
    tags: string[];

    // without one, they apply to the array itself — the shape the lint
    // rule flags, kept here to pin what the engine (and schema) do with it
    @VerifyMaxLength(3)
    @SerializableField(() => [Number])
    // eslint-disable-next-line base/verify-array-parity
    codes: number[];
}

enum SchemaColor {
    Red,
    Green,
}

enum SchemaSize {
    Small = 'small',
    Large = 'large',
}

@SerializableObject()
class SchemaChoices {
    @SerializableField(() => SchemaColor)
    color: SchemaColor;

    @VerifyIsEnum([SchemaSize.Small])
    @SerializableField(() => SchemaSize)
    size: SchemaSize;
}

@SerializableObject()
class SchemaMerged {
    @VerifyMinLength(3)
    @VerifyLength(5, 10)
    @VerifyStringMatches(/^[a-z]+$/)
    @VerifyStringMatches(/^[a-m]+$/)
    @SerializableField(() => String)
    code: string;

    @VerifyIsInt()
    @VerifyMin(1)
    @VerifyMax(10)
    @SerializableField(() => Number)
    count: number;
}

@SerializableObject()
class SchemaCustom implements Deserializable {
    deserialize(): this {
        return this;
    }
}

function itemClass(field: string): Constructor {
    @SerializableObject()
    class SchemaItem {}
    SerializableField(() => String)(SchemaItem.prototype, field);
    return SchemaItem;
}

describe('generateJsonSchema', () => {
    it('keys properties by wire name and takes required, default and description from the field', () => {
        expect(generateJsonSchema(SchemaProfile)).toEqual({
            type: 'object',
            properties: {
                name: { type: 'string', description: 'The display name.' },
                nick_name: { type: 'string', maxLength: 20 },
                verified: { type: 'boolean', default: false },
                // a transformed field's wire shape isn't known
                joined: {},
            },
            required: ['name', 'joined'],
        });
    });

    it('puts nested classes in sorted $defs, including a self-reference', () => {
        expect(generateJsonSchema(() => SchemaPerson)).toEqual({
            type: 'object',
            properties: {
                home: { $ref: '#/$defs/SchemaAddress' },
                others: {
                    type: 'array',
                    items: { $ref: '#/$defs/SchemaAddress' },
                },
                manager: { $ref: '#/$defs/SchemaPerson' },
            },
            required: ['home'],
            $defs: {
                SchemaAddress: {
                    type: 'object',
                    properties: { city: { type: 'string' } },
                    required: ['city'],
                },
                SchemaPerson: {
                    type: 'object',
                    properties: {
                        home: { $ref: '#/$defs/SchemaAddress' },
                        others: {
                            type: 'array',
                            items: { $ref: '#/$defs/SchemaAddress' },
                        },
                        manager: { $ref: '#/$defs/SchemaPerson' },
                    },
                    required: ['home'],
                },
            },
        });
    });

    it('applies value-level rules to items only when an array-level rule is present', () => {
        expect(generateJsonSchema(SchemaTags)).toEqual({
            type: 'object',
            properties: {
                tags: {
                    type: 'array',
                    minItems: 1,
                    uniqueItems: true,
                    items: { type: 'string', maxLength: 5 },
                },
                codes: {
                    type: 'array',
                    items: { type: 'number' },
                    maxItems: 3,
                },
            },
            required: ['tags', 'codes'],
        });
    });

    it('emits enum values without numeric reverse mappings, intersected with IsEnum', () => {
        expect(generateJsonSchema(SchemaChoices)).toEqual({
            type: 'object',
            properties: {
                color: { enum: [0, 1] },
                size: { enum: ['small'] },
            },
            required: ['color', 'size'],
        });
    });

    it('merges rules: tighter bounds win, types narrow, and a second pattern goes in allOf', () => {
        expect(generateJsonSchema(SchemaMerged)).toEqual({
            type: 'object',
            properties: {
                code: {
                    type: 'string',
                    minLength: 5,
                    maxLength: 10,
                    // decorators apply bottom-up, so the lower rule registers first
                    pattern: '^[a-m]+$',
                    allOf: [{ pattern: '^[a-z]+$' }],
                },
                count: { type: 'integer', minimum: 1, maximum: 10 },
            },
            required: ['code', 'count'],
        });
    });

    it('describes root arrays and primitives without inlining', () => {
        expect(generateJsonSchema(() => [SchemaAddress])).toEqual({
            type: 'array',
            items: { $ref: '#/$defs/SchemaAddress' },
            $defs: {
                SchemaAddress: {
                    type: 'object',
                    properties: { city: { type: 'string' } },
                    required: ['city'],
                },
            },
        });
        expect(generateJsonSchema(() => String)).toEqual({ type: 'string' });
        expect(generateJsonSchema(() => Date)).toEqual({ type: 'string' });
        expect(generateJsonSchema(SchemaSize)).toEqual({
            enum: ['small', 'large'],
        });
    });

    it('describes a class with its own deserialize() as any object', () => {
        expect(generateJsonSchema(SchemaCustom)).toEqual({ type: 'object' });
    });

    it('suffixes $defs names for distinct classes that share a name', () => {
        const builder = new JsonSchemaBuilder();
        const first = builder.schemaFor(itemClass('a'));
        const second = builder.schemaFor(itemClass('b'));

        expect(first).toEqual({ $ref: '#/$defs/SchemaItem' });
        expect(second).toEqual({ $ref: '#/$defs/SchemaItem_2' });
        expect(Object.keys(builder.document({}).$defs ?? {})).toEqual([
            'SchemaItem',
            'SchemaItem_2',
        ]);
    });

    it('is deterministic', () => {
        expect(JSON.stringify(generateJsonSchema(SchemaPerson))).toBe(
            JSON.stringify(generateJsonSchema(SchemaPerson)),
        );
    });
});

@SerializableObject()
class SchemaInvite {
    @VerifyIsEmail()
    @SerializableField(() => String)
    email: string;

    @VerifyIsOptional()
    @VerifyLength(1, 40)
    @SerializableField(() => String, { optional: true })
    note?: string;

    @VerifyArrayMinSize(1)
    @VerifyMaxLength(10)
    @SerializableField(() => [String])
    roles: string[];

    @VerifyIsInt()
    @VerifyMin(1)
    @SerializableField(() => Number, { defaultValue: 1 })
    seats: number;
}

async function serverAccepts(input: Json): Promise<boolean> {
    try {
        const value = deserialize(input, SchemaInvite, { strict: true });
        return (await validate(value)).length === 0;
    } catch {
        return false;
    }
}

/**
 * End to end: for well-typed input (the declared contract), whatever the
 * server accepts — `deserialize`, then `validate` — passes the schema.
 */
describe('a generated schema is never stricter than the server', () => {
    const validateSchema = new Ajv2020({ strict: false }).compile(
        generateJsonSchema(SchemaInvite),
    );

    const inputs: Json[] = [
        { email: 'a@b.co', roles: ['admin'] },
        { email: 'a@b.co', roles: ['admin', 'owner'], seats: 3 },
        { email: 'a@b.co', note: 'hello', roles: ['x'], seats: 1 },
        { email: 'not-an-email', roles: ['admin'] },
        { email: 'a@b.co', roles: [] },
        { email: 'a@b.co', roles: ['far-too-long-role'] },
        { email: 'a@b.co', roles: ['admin'], seats: 0 },
        { email: 'a@b.co', roles: ['admin'], note: '' },
        { roles: ['admin'] },
    ];

    it.each(inputs.map((input) => [JSON.stringify(input), input]))(
        '%s',
        async (_label, input) => {
            if (await serverAccepts(input)) {
                expect(validateSchema(input)).toBe(true);
            }
        },
    );

    it('accepts at least one input and rejects others, so both paths run', async () => {
        const accepted = await Promise.all(inputs.map(serverAccepts));
        expect(accepted).toContain(true);
        expect(accepted).toContain(false);
    });
});
