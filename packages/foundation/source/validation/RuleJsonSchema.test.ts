// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { readdirSync } from 'fs';
import { join } from 'path';
import { Ajv2020 } from 'ajv/dist/2020';

import { getBaseMetadata } from '../base/BaseMetadata';
import { RuleMetadata } from '../internal/metadata/ValidationMetadata';
import { JsonSchema } from '../serialization/JsonSchema';
import { VerifyArrayMaxSize } from './decorators/VerifyArrayMaxSize';
import { VerifyArrayMinSize } from './decorators/VerifyArrayMinSize';
import { VerifyArrayUnique } from './decorators/VerifyArrayUnique';
import { VerifyIsArray } from './decorators/VerifyIsArray';
import { VerifyIsBoolean } from './decorators/VerifyIsBoolean';
import { VerifyIsCountryCode } from './decorators/VerifyIsCountryCode';
import { VerifyIsDate } from './decorators/VerifyIsDate';
import { VerifyIsDefined } from './decorators/VerifyIsDefined';
import { VerifyIsDomain } from './decorators/VerifyIsDomain';
import { VerifyIsEmail } from './decorators/VerifyIsEmail';
import { VerifyIsEnum } from './decorators/VerifyIsEnum';
import { VerifyIsInt } from './decorators/VerifyIsInt';
import { VerifyIsIP } from './decorators/VerifyIsIP';
import { VerifyIsLocale } from './decorators/VerifyIsLocale';
import { VerifyIsNotEmpty } from './decorators/VerifyIsNotEmpty';
import { VerifyIsNumber } from './decorators/VerifyIsNumber';
import { VerifyIsObject } from './decorators/VerifyIsObject';
import { VerifyIsOptional } from './decorators/VerifyIsOptional';
import { VerifyIsPhoneNumber } from './decorators/VerifyIsPhoneNumber';
import { VerifyIsString } from './decorators/VerifyIsString';
import { VerifyIsTimeZone } from './decorators/VerifyIsTimeZone';
import { VerifyIsUrl } from './decorators/VerifyIsUrl';
import { VerifyIsUUID } from './decorators/VerifyIsUUID';
import { VerifyLength } from './decorators/VerifyLength';
import { VerifyMax } from './decorators/VerifyMax';
import { VerifyMaxDate } from './decorators/VerifyMaxDate';
import { VerifyMaxLength } from './decorators/VerifyMaxLength';
import { VerifyMin } from './decorators/VerifyMin';
import { VerifyMinDate } from './decorators/VerifyMinDate';
import { VerifyMinLength } from './decorators/VerifyMinLength';
import { VerifyStringMatches } from './decorators/VerifyStringMatches';
import { RuleJsonSchemaUnrepresentable } from './RuleJsonSchema';

// a real 2020-12 validator; ajv compiles patterns with the `u` flag
const ajv = new Ajv2020({ strict: false });

/**
 * The rule metadata a decorator records, read back from a throwaway class.
 */
function ruleFor(decorator: PropertyDecorator): RuleMetadata {
    class Fixture {}
    decorator(Fixture.prototype, 'value');
    return getBaseMetadata().validation.getAllFor(Fixture)[0];
}

function accepts(rule: RuleMetadata, value: unknown): boolean {
    return (
        rule.check(value, rule.options, {
            target: {},
            property: 'value',
            value,
            options: rule.options,
        }) === true
    );
}

function fragmentFor(
    rule: RuleMetadata,
    target: JsonSchema,
): JsonSchema | undefined {
    const mapping = rule.jsonSchema;
    return mapping === undefined || mapping === RuleJsonSchemaUnrepresentable
        ? undefined
        : mapping(rule.options, target);
}

enum Color {
    Red,
    Green,
}

/**
 * Every built-in rule, by its export name. Adding a decorator file under
 * `decorators/` without listing it here fails the suite below.
 */
const BUILT_IN_RULES: Record<string, PropertyDecorator> = {
    VerifyArrayMaxSize: VerifyArrayMaxSize(2),
    VerifyArrayMinSize: VerifyArrayMinSize(2),
    VerifyArrayUnique: VerifyArrayUnique(),
    VerifyIsArray: VerifyIsArray(),
    VerifyIsBoolean: VerifyIsBoolean(),
    VerifyIsCountryCode: VerifyIsCountryCode('alpha2'),
    VerifyIsDate: VerifyIsDate(),
    VerifyIsDefined: VerifyIsDefined(),
    VerifyIsDomain: VerifyIsDomain(),
    VerifyIsEmail: VerifyIsEmail(),
    VerifyIsEnum: VerifyIsEnum(Color),
    VerifyIsInt: VerifyIsInt(),
    VerifyIsIP: VerifyIsIP(),
    VerifyIsLocale: VerifyIsLocale(),
    VerifyIsNotEmpty: VerifyIsNotEmpty(),
    VerifyIsNumber: VerifyIsNumber(),
    VerifyIsObject: VerifyIsObject(),
    VerifyIsOptional: VerifyIsOptional(),
    VerifyIsPhoneNumber: VerifyIsPhoneNumber({}),
    VerifyIsString: VerifyIsString(),
    VerifyIsTimeZone: VerifyIsTimeZone(),
    VerifyIsUrl: VerifyIsUrl(),
    VerifyIsUUID: VerifyIsUUID(),
    VerifyLength: VerifyLength(2, 4),
    VerifyMax: VerifyMax(5),
    VerifyMaxDate: VerifyMaxDate(new Date('2030-01-01')),
    VerifyMaxLength: VerifyMaxLength(3),
    VerifyMin: VerifyMin(5),
    VerifyMinDate: VerifyMinDate(new Date('2020-01-01')),
    VerifyMinLength: VerifyMinLength(3),
    VerifyStringMatches: VerifyStringMatches(/^[a-z]+$/),
};

describe('built-in rule JSON Schema mappings', () => {
    it('lists every built-in rule decorator', () => {
        const files = readdirSync(join(__dirname, 'decorators'))
            .filter((file) => /^Verify\w+\.ts$/.test(file))
            .map((file) => file.replace(/\.ts$/, ''))
            // registerRule itself, for app-defined rules
            .filter((name) => name !== 'VerifyBy')
            .sort();

        expect(Object.keys(BUILT_IN_RULES).sort()).toEqual(files);
    });

    it.each(Object.entries(BUILT_IN_RULES))(
        '%s declares a mapping or marks itself unrepresentable',
        (_name, decorator) => {
            expect(ruleFor(decorator).jsonSchema).toBeDefined();
        },
    );
});

interface NeverStricterCase {
    readonly name: string;
    readonly decorator: PropertyDecorator;
    /**
     * The schema of the value the rule applies to.
     */
    readonly target: JsonSchema;
    readonly values: readonly unknown[];
}

const STRING: JsonSchema = { type: 'string' };
const UNKNOWN: JsonSchema = {};

const UUID_V4 = '0f8fad5b-d9cb-469f-a165-70867728950e';
const UUID_V7 = '01890a5d-ac96-774b-bcce-b302099a8057';

const NEVER_STRICTER_CASES: NeverStricterCase[] = [
    {
        name: 'IsString',
        decorator: VerifyIsString(),
        target: UNKNOWN,
        values: ['', 'a', 1, null, true, {}, []],
    },
    {
        name: 'IsNumber',
        decorator: VerifyIsNumber(),
        target: UNKNOWN,
        values: [0, -1.5, 1e300, '1', null],
    },
    {
        name: 'IsInt',
        decorator: VerifyIsInt(),
        target: UNKNOWN,
        values: [0, 1, 1.0, -3, 1.5, '1'],
    },
    {
        name: 'IsBoolean',
        decorator: VerifyIsBoolean(),
        target: UNKNOWN,
        values: [true, false, 0, 'true'],
    },
    {
        name: 'IsObject',
        decorator: VerifyIsObject(),
        target: UNKNOWN,
        values: [{}, { a: 1 }, [], null, 'x'],
    },
    {
        name: 'IsArray',
        decorator: VerifyIsArray(),
        target: UNKNOWN,
        values: [[], [1], {}, 'x'],
    },
    {
        name: 'IsDefined',
        decorator: VerifyIsDefined(),
        target: UNKNOWN,
        values: [0, '', false, null],
    },
    {
        name: 'IsOptional',
        decorator: VerifyIsOptional(),
        target: UNKNOWN,
        values: [0, '', null],
    },
    {
        name: 'IsEmail',
        decorator: VerifyIsEmail(),
        target: STRING,
        values: [
            'a@b.co',
            'first.last+tag@example.com',
            'ü@ö.de',
            '😀@x.io',
            'x y@b.co',
            'a@b',
            '',
        ],
    },
    {
        name: 'IsDomain',
        decorator: VerifyIsDomain(),
        target: STRING,
        values: [
            'example.com',
            'a.b.co',
            'xn--bcher-kva.example',
            'localhost',
            'ex_ample.com',
            '😀.com',
            `${'a'.repeat(64)}.com`,
        ],
    },
    {
        name: 'IsUrl',
        decorator: VerifyIsUrl(),
        target: STRING,
        values: ['https://x.io/path?q=1', 'http://localhost:3000', 'ftp://x'],
    },
    {
        name: 'IsPhoneNumber',
        decorator: VerifyIsPhoneNumber({}),
        target: STRING,
        values: ['+14155552671', '415-555-2671', 'abc'],
    },
    {
        name: 'IsTimeZone',
        decorator: VerifyIsTimeZone(),
        target: STRING,
        values: ['UTC', 'America/New_York', 'Mars/Base'],
    },
    {
        name: 'IsLocale',
        decorator: VerifyIsLocale(),
        target: STRING,
        values: ['en-US', 'zh-Hant-TW', '', 'not a locale!!'],
    },
    {
        name: 'IsEnum (array)',
        decorator: VerifyIsEnum(['a', 'b', 1]),
        target: UNKNOWN,
        values: ['a', 'b', 1, 'c', 2],
    },
    {
        name: 'IsEnum (numeric TS enum)',
        decorator: VerifyIsEnum(Color),
        target: UNKNOWN,
        values: [0, 1, 'Red', 2],
    },
    {
        name: 'Min',
        decorator: VerifyMin(5),
        target: UNKNOWN,
        values: [5, 6.5, 4, '10'],
    },
    {
        name: 'Max',
        decorator: VerifyMax(5),
        target: UNKNOWN,
        values: [5, -1, 6, '1'],
    },
    {
        name: 'MinLength (string)',
        decorator: VerifyMinLength(3),
        target: STRING,
        values: ['abc', 'abcd', 'ab', 'ünï'],
    },
    {
        name: 'MinLength (array)',
        decorator: VerifyMinLength(3),
        target: { type: 'array' },
        values: [[1, 2, 3], [1]],
    },
    {
        name: 'MinLength (unknown)',
        decorator: VerifyMinLength(3),
        target: UNKNOWN,
        values: ['abc', [1, 2, 3], 'ab', 5],
    },
    {
        name: 'MaxLength (string)',
        decorator: VerifyMaxLength(3),
        target: STRING,
        values: ['abc', '', 'abcd', '😀😀'],
    },
    {
        name: 'MaxLength (unknown)',
        decorator: VerifyMaxLength(3),
        target: UNKNOWN,
        values: ['abc', [1, 2], 'abcd', null],
    },
    {
        name: 'Length',
        decorator: VerifyLength(2, 4),
        target: UNKNOWN,
        values: ['ab', 'abcd', [1, 2], 'a', 'abcde'],
    },
    {
        name: 'ArrayMinSize',
        decorator: VerifyArrayMinSize(2),
        target: UNKNOWN,
        values: [[1, 2], [1], 'ab'],
    },
    {
        name: 'ArrayMaxSize',
        decorator: VerifyArrayMaxSize(2),
        target: UNKNOWN,
        values: [[], [1, 2], [1, 2, 3]],
    },
    {
        name: 'ArrayUnique (primitive items)',
        decorator: VerifyArrayUnique(),
        target: { type: 'array', items: STRING },
        values: [
            ['a', 'b'],
            ['a', 'a'],
        ],
    },
    {
        name: 'ArrayUnique (object items)',
        decorator: VerifyArrayUnique(),
        target: { type: 'array', items: { type: 'object' } },
        // distinct objects with equal contents pass the identity check
        values: [[{ a: 1 }, { a: 1 }]],
    },
    {
        name: 'IsNotEmpty (string)',
        decorator: VerifyIsNotEmpty(),
        target: STRING,
        values: ['', 'a'],
    },
    {
        name: 'IsNotEmpty (array)',
        decorator: VerifyIsNotEmpty(),
        target: { type: 'array' },
        values: [[], [0]],
    },
    {
        name: 'IsNotEmpty (unknown)',
        decorator: VerifyIsNotEmpty(),
        target: UNKNOWN,
        values: [0, 'a', [1], { a: 1 }, {}, '', []],
    },
    {
        name: 'IsIP (any)',
        decorator: VerifyIsIP(),
        target: STRING,
        values: ['1.2.3.4', '::1', 'fe80::1', '256.1.1.1', 'x'],
    },
    {
        name: 'IsIP (4)',
        decorator: VerifyIsIP(4),
        target: STRING,
        values: ['10.0.0.1', '::1'],
    },
    {
        name: 'IsIP (6)',
        decorator: VerifyIsIP(6),
        target: STRING,
        values: ['2001:db8::1', '::ffff:10.0.0.1', '10.0.0.1'],
    },
    {
        name: 'IsUUID (any)',
        decorator: VerifyIsUUID(),
        target: STRING,
        values: [UUID_V4, UUID_V4.toUpperCase(), UUID_V7, 'not-a-uuid'],
    },
    {
        name: 'IsUUID (4)',
        decorator: VerifyIsUUID(4),
        target: STRING,
        values: [UUID_V4, UUID_V4.toUpperCase(), UUID_V7],
    },
    {
        name: 'IsCountryCode (alpha2)',
        decorator: VerifyIsCountryCode('alpha2'),
        target: STRING,
        values: ['US', 'DE', 'us', 'XX'],
    },
    {
        name: 'IsCountryCode (numeric)',
        decorator: VerifyIsCountryCode('numeric'),
        target: STRING,
        values: ['840', '276', '84'],
    },
    {
        name: 'StringMatches (flagless)',
        decorator: VerifyStringMatches(/^\d{3}-[a-z]+$/),
        target: STRING,
        values: ['123-abc', '12-abc', '123-ABC'],
    },
    {
        name: 'StringMatches (i flag)',
        decorator: VerifyStringMatches(/^abc$/i),
        target: STRING,
        values: ['abc', 'ABC', 'abd'],
    },
    {
        name: 'StringMatches (dot)',
        decorator: VerifyStringMatches(/^..$/),
        target: STRING,
        // one astral character is two code units: `..` matches it only
        // without the `u` flag
        values: ['ab', '😀', 'a'],
    },
    {
        name: 'StringMatches (negated shorthand)',
        decorator: VerifyStringMatches(/^\S\S$/),
        target: STRING,
        values: ['ab', '😀'],
    },
    {
        name: 'StringMatches (negated class)',
        decorator: VerifyStringMatches(/^[^a][^a]$/),
        target: STRING,
        values: ['bc', '😀'],
    },
];

describe('rule JSON Schema mappings are never stricter than the rule', () => {
    it.each(NEVER_STRICTER_CASES.map((testCase) => [testCase.name, testCase]))(
        '%s',
        (_name, { decorator, target, values }) => {
            const rule = ruleFor(decorator);
            const fragment = fragmentFor(rule, target);
            if (fragment === undefined) {
                return;
            }
            const validateFragment = ajv.compile(fragment);
            for (const value of values.filter((v) => accepts(rule, v))) {
                expect({ value, passes: validateFragment(value) }).toEqual({
                    value,
                    passes: true,
                });
            }
        },
    );

    it('drops a pattern rather than its flags or code-unit matching', () => {
        expect(
            fragmentFor(ruleFor(VerifyStringMatches(/^abc$/i)), STRING),
        ).toEqual({ type: 'string' });
        expect(
            fragmentFor(ruleFor(VerifyStringMatches(/^..$/)), STRING),
        ).toEqual({ type: 'string' });
        expect(
            fragmentFor(ruleFor(VerifyStringMatches(/^[a-z]+$/)), STRING),
        ).toEqual({ type: 'string', pattern: '^[a-z]+$' });
    });

    it('spells out a UUID pattern without the i flag', () => {
        const fragment = fragmentFor(ruleFor(VerifyIsUUID(4)), STRING);
        expect(fragment?.pattern).toBe(
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        );
    });

    it('gives uniqueItems only to primitive items', () => {
        const rule = ruleFor(VerifyArrayUnique());
        expect(
            fragmentFor(rule, { type: 'array', items: { type: 'object' } }),
        ).toEqual({ type: 'array' });
        expect(fragmentFor(rule, { type: 'array', items: STRING })).toEqual({
            type: 'array',
            uniqueItems: true,
        });
    });

    /**
     * The documented exception (see `lengthJsonSchema`): length rules count
     * UTF-16 code units and JSON Schema counts code points, and the bound is
     * kept as written rather than halved.
     */
    it('keeps a minimum length in code units, stricter only beyond the BMP', () => {
        const rule = ruleFor(VerifyMinLength(4));
        const validateFragment = ajv.compile(fragmentFor(rule, STRING)!);

        expect(accepts(rule, '😀😀')).toBe(true);
        expect(validateFragment('😀😀')).toBe(false);
    });
});
