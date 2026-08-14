// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TypedJson, TypedJsonScalar, TypedJsonTransformer } from './TypedJson';

describe('TypedJson', () => {
    describe('TypedJson class', () => {
        it('should create instance with type and value', () => {
            const typedJson = new TypedJson();
            typedJson.type = 'string';
            typedJson.value = 'test value';

            expect(typedJson.type).toBe('string');
            expect(typedJson.value).toBe('test value');
        });

        it('should handle different value types', () => {
            const stringTyped = new TypedJson();
            stringTyped.type = 'string';
            stringTyped.value = 'hello';

            const numberTyped = new TypedJson();
            numberTyped.type = 'number';
            numberTyped.value = 42;

            const objectTyped = new TypedJson();
            objectTyped.type = 'object';
            objectTyped.value = { key: 'value' };

            expect(stringTyped.value).toBe('hello');
            expect(numberTyped.value).toBe(42);
            expect(objectTyped.value).toEqual({ key: 'value' });
        });

        it('should allow undefined and null values', () => {
            const undefinedTyped = new TypedJson();
            undefinedTyped.type = 'undefined';
            undefinedTyped.value = undefined;

            const nullTyped = new TypedJson();
            nullTyped.type = 'object';
            nullTyped.value = null;

            expect(undefinedTyped.value).toBeUndefined();
            expect(nullTyped.value).toBeNull();
        });
    });
});

describe('TypedJsonTransformer', () => {
    let transformer: TypedJsonTransformer;

    beforeEach(() => {
        transformer = new TypedJsonTransformer();
    });

    describe('to method (marshal to database)', () => {
        it('should convert TypedJson to JSON string', () => {
            const typedJson = new TypedJson();
            typedJson.type = 'string';
            typedJson.value = 'test value';

            const result = transformer.to(typedJson);

            expect(result).toBe('{"type":"string","value":"test value"}');
            expect(typeof result).toBe('string');
        });

        it('should handle complex objects', () => {
            const typedJson = new TypedJson();
            typedJson.type = 'object';
            typedJson.value = {
                name: 'John',
                age: 30,
                nested: { key: 'value' },
                array: [1, 2, 3],
            };

            const result = transformer.to(typedJson);
            const parsed = JSON.parse(result!);

            expect(parsed.type).toBe('object');
            expect(parsed.value.name).toBe('John');
            expect(parsed.value.age).toBe(30);
            expect(parsed.value.nested).toEqual({ key: 'value' });
            expect(parsed.value.array).toEqual([1, 2, 3]);
        });

        it('should handle different primitive types', () => {
            const stringTyped = new TypedJson();
            stringTyped.type = 'string';
            stringTyped.value = 'hello';

            const numberTyped = new TypedJson();
            numberTyped.type = 'number';
            numberTyped.value = 42;

            const booleanTyped = new TypedJson();
            booleanTyped.type = 'boolean';
            booleanTyped.value = true;

            expect(transformer.to(stringTyped)).toBe(
                '{"type":"string","value":"hello"}',
            );
            expect(transformer.to(numberTyped)).toBe(
                '{"type":"number","value":42}',
            );
            expect(transformer.to(booleanTyped)).toBe(
                '{"type":"boolean","value":true}',
            );
        });

        it('should handle arrays', () => {
            const typedJson = new TypedJson();
            typedJson.type = 'array';
            typedJson.value = ['a', 'b', 'c'];

            const result = transformer.to(typedJson);

            expect(result).toBe('{"type":"array","value":["a","b","c"]}');
        });

        it('should handle null and undefined values in TypedJson', () => {
            const nullTyped = new TypedJson();
            nullTyped.type = 'object';
            nullTyped.value = null;

            const undefinedTyped = new TypedJson();
            undefinedTyped.type = 'undefined';
            undefinedTyped.value = undefined;

            const nullResult = transformer.to(nullTyped);
            const undefinedResult = transformer.to(undefinedTyped);

            expect(nullResult).toBe('{"type":"object","value":null}');
            expect(undefinedResult).toBe('{"type":"undefined"}'); // undefined gets omitted in JSON
        });

        it('should return null for undefined input', () => {
            const result = transformer.to(undefined);

            expect(result).toBeNull();
        });

        it('should return null for null input', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = transformer.to(null as any);

            expect(result).toBeNull();
        });

        it('should handle special number values', () => {
            const infinityTyped = new TypedJson();
            infinityTyped.type = 'number';
            infinityTyped.value = Infinity;

            const nanTyped = new TypedJson();
            nanTyped.type = 'number';
            nanTyped.value = NaN;

            // JSON.stringify converts these to null
            expect(transformer.to(infinityTyped)).toBe(
                '{"type":"number","value":null}',
            );
            expect(transformer.to(nanTyped)).toBe(
                '{"type":"number","value":null}',
            );
        });

        it('should handle dates', () => {
            const date = new Date('2023-01-01T00:00:00.000Z');
            const typedJson = new TypedJson();
            typedJson.type = 'object';
            typedJson.value = date;

            const result = transformer.to(typedJson);
            const parsed = JSON.parse(result!);

            expect(parsed.value).toBe('2023-01-01T00:00:00.000Z');
        });
    });

    describe('from method (unmarshal from database)', () => {
        // Suppress console.log and console.error for these tests
        let consoleSpy: jest.SpyInstance;
        let consoleErrorSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleSpy = jest
                .spyOn(console, 'log')
                .mockImplementation(() => {});
            consoleErrorSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
        });

        afterEach(() => {
            consoleSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });

        it('should parse valid JSON string to TypedJson', () => {
            const jsonString = '{"type":"string","value":"test value"}';
            const result = transformer.from(jsonString);

            expect(result).toEqual({
                type: 'string',
                value: 'test value',
            });
        });

        it('should handle complex objects', () => {
            const jsonString =
                '{"type":"object","value":{"name":"John","age":30,"nested":{"key":"value"}}}';
            const result = transformer.from(jsonString);

            expect(result).toEqual({
                type: 'object',
                value: {
                    name: 'John',
                    age: 30,
                    nested: { key: 'value' },
                },
            });
        });

        it('should handle different primitive types', () => {
            const stringResult = transformer.from(
                '{"type":"string","value":"hello"}',
            );
            const numberResult = transformer.from(
                '{"type":"number","value":42}',
            );
            const booleanResult = transformer.from(
                '{"type":"boolean","value":true}',
            );

            expect(stringResult?.value).toBe('hello');
            expect(numberResult?.value).toBe(42);
            expect(booleanResult?.value).toBe(true);
        });

        it('should handle arrays', () => {
            const jsonString = '{"type":"array","value":["a","b","c"]}';
            const result = transformer.from(jsonString);

            expect(result?.value).toEqual(['a', 'b', 'c']);
        });

        it('should handle null values', () => {
            const jsonString = '{"type":"object","value":null}';
            const result = transformer.from(jsonString);

            expect(result?.value).toBeNull();
        });

        it('should return null for null input', () => {
            const result = transformer.from(null);

            expect(result).toBeNull();
        });

        it('should return null for undefined input', () => {
            const result = transformer.from(undefined);

            expect(result).toBeNull();
        });

        it('should handle empty string', () => {
            const result = transformer.from('');

            expect(result).toBeNull();
        });

        it('should handle invalid JSON gracefully', () => {
            const result1 = transformer.from('invalid json');
            const result2 = transformer.from('{invalid}');
            const result3 = transformer.from('{"incomplete":');

            expect(result1).toBeNull();
            expect(result2).toBeNull();
            expect(result3).toBeNull();
        });

        it('should handle malformed JSON strings', () => {
            const malformedInputs = [
                '{"type":"string"value":"missing comma"}',
                '{"type":"string","value":"unclosed string}',
                '{type:"unquoted key","value":"test"}',
                '{"type":"string","value":"test",}', // trailing comma
            ];

            malformedInputs.forEach((input) => {
                const result = transformer.from(input);
                expect(result).toBeNull();
            });
        });

        it('should handle whitespace-only strings', () => {
            const result1 = transformer.from('   ');
            const result2 = transformer.from('\t\n\r ');

            expect(result1).toBeNull();
            expect(result2).toBeNull();
        });

        it('should handle valid JSON primitives', () => {
            expect(transformer.from('null')).toBeNull();
            expect(transformer.from('true')).toBe(true);
            expect(transformer.from('false')).toBe(false);
            expect(transformer.from('42')).toBe(42);
            expect(transformer.from('"string"')).toBe('string');
        });

        it('should handle nested objects correctly', () => {
            const jsonString =
                '{"type":"object","value":{"level1":{"level2":{"level3":"deep"}}}}';
            const result = transformer.from(jsonString);

            expect(result?.value.level1.level2.level3).toBe('deep');
        });
    });

    describe('roundtrip transformation', () => {
        // Suppress console output for these tests
        let consoleSpy: jest.SpyInstance;
        let consoleErrorSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleSpy = jest
                .spyOn(console, 'log')
                .mockImplementation(() => {});
            consoleErrorSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
        });

        afterEach(() => {
            consoleSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });

        it('should maintain data through roundtrip transformation', () => {
            const original = new TypedJson();
            original.type = 'object';
            original.value = {
                string: 'test',
                number: 42,
                boolean: true,
                array: [1, 2, 3],
                nested: { key: 'value' },
            };

            const serialized = transformer.to(original);
            const deserialized = transformer.from(serialized);

            expect(deserialized).toEqual(original);
        });

        it('should handle multiple roundtrips without data loss', () => {
            const original = new TypedJson();
            original.type = 'string';
            original.value = 'roundtrip test';

            let current = original;
            for (let i = 0; i < 3; i++) {
                const serialized = transformer.to(current);
                current = transformer.from(serialized)!;
            }

            expect(current).toEqual(original);
        });

        it('should handle edge cases in roundtrip', () => {
            const edgeCases = [
                { type: 'string', value: '' },
                { type: 'number', value: 0 },
                { type: 'boolean', value: false },
                { type: 'object', value: {} },
                { type: 'array', value: [] },
                { type: 'object', value: null },
            ];

            edgeCases.forEach((testCase) => {
                const typedJson = new TypedJson();
                typedJson.type = testCase.type;
                typedJson.value = testCase.value;

                const serialized = transformer.to(typedJson);
                const deserialized = transformer.from(serialized);

                expect(deserialized).toEqual(testCase);
            });
        });
    });

    describe('type compatibility', () => {
        it('should implement ValueTransformer interface', () => {
            expect(transformer.to).toBeDefined();
            expect(transformer.from).toBeDefined();
            expect(typeof transformer.to).toBe('function');
            expect(typeof transformer.from).toBe('function');
        });

        it('should return correct types', () => {
            const typedJson = new TypedJson();
            typedJson.type = 'string';
            typedJson.value = 'test';

            const toResult = transformer.to(typedJson);
            const fromResult = transformer.from(
                '{"type":"string","value":"test"}',
            );

            expect(typeof toResult).toBe('string');
            expect(typeof fromResult).toBe('object');
        });

        it('should handle null returns correctly', () => {
            const toResult = transformer.to(undefined);
            const fromResult = transformer.from(null);

            expect(toResult).toBeNull();
            expect(fromResult).toBeNull();
        });
    });
});

describe('TypedJsonScalar', () => {
    describe('GraphQL Scalar properties', () => {
        it('should have correct name and description', () => {
            expect(TypedJsonScalar.name).toBe('TypedJson');
            expect(TypedJsonScalar.description).toContain(
                'Typed JSON custom scalar type',
            );
        });
    });

    describe('serialize method', () => {
        it('should serialize TypedJson instance correctly', () => {
            const typedJson = new TypedJson();
            typedJson.type = 'string';
            typedJson.value = 'test value';

            const result = TypedJsonScalar.serialize(typedJson);

            expect(result).toBe('test value');
        });

        it('should serialize different value types', () => {
            const stringTyped = new TypedJson();
            stringTyped.type = 'string';
            stringTyped.value = 'hello';

            const numberTyped = new TypedJson();
            numberTyped.type = 'number';
            numberTyped.value = 42;

            const objectTyped = new TypedJson();
            objectTyped.type = 'object';
            objectTyped.value = { key: 'value' };

            expect(TypedJsonScalar.serialize(stringTyped)).toBe('hello');
            expect(TypedJsonScalar.serialize(numberTyped)).toBe(42);
            expect(TypedJsonScalar.serialize(objectTyped)).toEqual({
                key: 'value',
            });
        });

        it('serializes a plain { type, value } object read from the database', () => {
            // TypedJsonTransformer.from returns a plain object (JSON.parse),
            // never a TypedJson instance — the scalar must still serialize it.
            const fromDb = new TypedJsonTransformer().from(
                '{"type":"string","value":"db value"}',
            );
            expect(fromDb).not.toBeInstanceOf(TypedJson);
            expect(TypedJsonScalar.serialize(fromDb)).toBe('db value');
        });

        it('should throw error for non-TypedJson values', () => {
            expect(() => TypedJsonScalar.serialize('not a TypedJson')).toThrow(
                'TypedJsonScalar can only serialize TypedJson values',
            );
            expect(() => TypedJsonScalar.serialize(42)).toThrow(
                'TypedJsonScalar can only serialize TypedJson values',
            );
            expect(() => TypedJsonScalar.serialize({})).toThrow(
                'TypedJsonScalar can only serialize TypedJson values',
            );
            expect(() => TypedJsonScalar.serialize(null)).toThrow(
                'TypedJsonScalar can only serialize TypedJson values',
            );
        });

        it('should handle null and undefined values in TypedJson', () => {
            const nullTyped = new TypedJson();
            nullTyped.type = 'object';
            nullTyped.value = null;

            const undefinedTyped = new TypedJson();
            undefinedTyped.type = 'undefined';
            undefinedTyped.value = undefined;

            expect(TypedJsonScalar.serialize(nullTyped)).toBeNull();
            expect(TypedJsonScalar.serialize(undefinedTyped)).toBeUndefined();
        });
    });

    describe('parseValue method', () => {
        it('should create TypedJson from different value types', () => {
            const stringResult = TypedJsonScalar.parseValue('hello');
            const numberResult = TypedJsonScalar.parseValue(42);
            const booleanResult = TypedJsonScalar.parseValue(true);
            const objectResult = TypedJsonScalar.parseValue({ key: 'value' });
            const arrayResult = TypedJsonScalar.parseValue([1, 2, 3]);

            expect(stringResult).toEqual({ type: 'string', value: 'hello' });
            expect(numberResult).toEqual({ type: 'number', value: 42 });
            expect(booleanResult).toEqual({ type: 'boolean', value: true });
            expect(objectResult).toEqual({
                type: 'object',
                value: { key: 'value' },
            });
            expect(arrayResult).toEqual({ type: 'object', value: [1, 2, 3] }); // arrays are typeof 'object'
        });

        it('should handle null and undefined', () => {
            const nullResult = TypedJsonScalar.parseValue(null);
            const undefinedResult = TypedJsonScalar.parseValue(undefined);

            expect(nullResult).toEqual({ type: 'object', value: null }); // typeof null is 'object'
            expect(undefinedResult).toEqual({
                type: 'undefined',
                value: undefined,
            });
        });

        it('should handle functions', () => {
            const func = () => 'test';
            const functionResult = TypedJsonScalar.parseValue(func);

            expect(functionResult.type).toBe('function');
            expect(functionResult.value).toBe(func);
        });

        it('should handle symbols', () => {
            const sym = Symbol('test');
            const symbolResult = TypedJsonScalar.parseValue(sym);

            expect(symbolResult.type).toBe('symbol');
            expect(symbolResult.value).toBe(sym);
        });
    });

    describe('parseLiteral method', () => {
        it('should throw error when called', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mockAst = {} as any;

            expect(() => TypedJsonScalar.parseLiteral(mockAst)).toThrow(
                'TypedJsonScalar not support parseLiteral',
            );
        });
    });
});
