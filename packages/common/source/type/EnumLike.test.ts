// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { EnumLike, isEnumLike, NestedEnumLike } from './EnumLike';

describe('EnumLike', () => {
    // Test enums and enum-like objects
    enum TestEnum {
        VALUE1 = 'value1',
        VALUE2 = 'value2',
        VALUE3 = 'value3',
    }

    enum NumericEnum {
        FIRST = 1,
        SECOND = 2,
        THIRD = 3,
    }

    const TestEnumLike = {
        OPTION_A: 'optionA',
        OPTION_B: 'optionB',
        OPTION_C: 'optionC',
    } as const;

    const NumericEnumLike = {
        ONE: 1,
        TWO: 2,
        THREE: 3,
    } as const;

    // Test classes for non-enum testing
    class TestClass {
        constructor(public value: string) {}
    }

    describe('Type Definitions', () => {
        describe('EnumLike type', () => {
            test('should accept string enum-like objects', () => {
                const stringEnumLike: EnumLike<string> = {
                    KEY1: 'value1',
                    KEY2: 'value2',
                    KEY3: 'value3',
                };

                expect(stringEnumLike.KEY1).toBe('value1');
                expect(stringEnumLike.KEY2).toBe('value2');
                expect(stringEnumLike.KEY3).toBe('value3');
            });

            test('should accept number enum-like objects', () => {
                const numberEnumLike: EnumLike<number> = {
                    FIRST: 1,
                    SECOND: 2,
                    THIRD: 3,
                };

                expect(numberEnumLike.FIRST).toBe(1);
                expect(numberEnumLike.SECOND).toBe(2);
                expect(numberEnumLike.THIRD).toBe(3);
            });

            test('should accept mixed string/number enum-like objects', () => {
                const mixedEnumLike: EnumLike<string | number> = {
                    STRING_KEY: 'stringValue',
                    NUMBER_KEY: 42,
                    ANOTHER_STRING: 'anotherValue',
                };

                expect(mixedEnumLike.STRING_KEY).toBe('stringValue');
                expect(mixedEnumLike.NUMBER_KEY).toBe(42);
                expect(mixedEnumLike.ANOTHER_STRING).toBe('anotherValue');
            });

            test('should work with actual TypeScript enums', () => {
                const enumAsEnumLike: EnumLike<string> = TestEnum;
                expect(enumAsEnumLike.VALUE1).toBe('value1');
                expect(enumAsEnumLike.VALUE2).toBe('value2');
                expect(enumAsEnumLike.VALUE3).toBe('value3');
            });

            test('should work with numeric TypeScript enums', () => {
                const numericEnumAsEnumLike: EnumLike<string | number> =
                    NumericEnum;
                expect(numericEnumAsEnumLike.FIRST).toBe(1);
                expect(numericEnumAsEnumLike.SECOND).toBe(2);
                expect(numericEnumAsEnumLike.THIRD).toBe(3);
            });
        });

        describe('NestedEnumLike type', () => {
            test('should accept single EnumLike objects', () => {
                const nestedEnum: NestedEnumLike = TestEnumLike;
                expect(typeof nestedEnum).toBe('object');
                expect(nestedEnum).toBe(TestEnumLike);
            });

            test('should accept arrays of EnumLike objects', () => {
                const nestedEnumArray: NestedEnumLike = [
                    TestEnumLike,
                    NumericEnumLike,
                ];
                expect(Array.isArray(nestedEnumArray)).toBe(true);
                expect(nestedEnumArray).toHaveLength(2);
                expect(nestedEnumArray[0]).toBe(TestEnumLike);
                expect(nestedEnumArray[1]).toBe(NumericEnumLike);
            });

            test('should accept deeply nested arrays', () => {
                const deeplyNested: NestedEnumLike = [
                    [[TestEnumLike]],
                    [NumericEnumLike],
                ];
                expect(Array.isArray(deeplyNested)).toBe(true);
                expect(Array.isArray(deeplyNested[0])).toBe(true);
                expect(
                    Array.isArray((deeplyNested[0] as NestedEnumLike[])[0]),
                ).toBe(true);
            });

            test('should accept mixed nesting levels', () => {
                const mixedNesting: NestedEnumLike = [
                    TestEnumLike,
                    [NumericEnumLike],
                    [[TestEnum]],
                ];
                expect(Array.isArray(mixedNesting)).toBe(true);
                expect(mixedNesting).toHaveLength(3);
                expect(typeof mixedNesting[0]).toBe('object');
                expect(Array.isArray(mixedNesting[1])).toBe(true);
                expect(Array.isArray(mixedNesting[2])).toBe(true);
            });
        });
    });

    describe('isEnumLike', () => {
        describe('should return true for enum-like objects', () => {
            test('simple object literal', () => {
                const simpleObject = { KEY1: 'value1', KEY2: 'value2' };
                expect(isEnumLike(simpleObject)).toBe(true);
            });

            test('const assertions', () => {
                const constObject = { OPTION_A: 'a', OPTION_B: 'b' } as const;
                expect(isEnumLike(constObject)).toBe(true);
            });

            test('TypeScript string enums', () => {
                expect(isEnumLike(TestEnum)).toBe(true);
            });

            test('TypeScript numeric enums', () => {
                expect(isEnumLike(NumericEnum)).toBe(true);
            });

            test('empty objects', () => {
                const emptyObject = {};
                expect(isEnumLike(emptyObject)).toBe(true);
            });

            test('objects with string values', () => {
                const stringObject = {
                    RED: 'red',
                    GREEN: 'green',
                    BLUE: 'blue',
                };
                expect(isEnumLike(stringObject)).toBe(true);
            });

            test('objects with number values', () => {
                const numberObject = {
                    SMALL: 1,
                    MEDIUM: 2,
                    LARGE: 3,
                };
                expect(isEnumLike(numberObject)).toBe(true);
            });

            test('objects with mixed value types', () => {
                const mixedObject = {
                    STRING_VALUE: 'text',
                    NUMBER_VALUE: 42,
                    BOOLEAN_VALUE: true,
                };
                expect(isEnumLike(mixedObject)).toBe(true);
            });

            test('objects with symbol keys', () => {
                const symbolKey = Symbol('key');
                const objectWithSymbol = {
                    [symbolKey]: 'value',
                    NORMAL_KEY: 'normal',
                };
                expect(isEnumLike(objectWithSymbol)).toBe(true);
            });

            test('objects with computed property names', () => {
                const computedObject = {
                    [`PREFIX_${'SUFFIX'}`]: 'value',
                    NORMAL: 'normal',
                };
                expect(isEnumLike(computedObject)).toBe(true);
            });
        });

        describe('should return false for non-enum-like values', () => {
            test('null', () => {
                expect(isEnumLike(null)).toBe(false);
            });

            test('undefined', () => {
                expect(isEnumLike(undefined)).toBe(false);
            });

            test('primitive strings', () => {
                expect(isEnumLike('string')).toBe(false);
                expect(isEnumLike('')).toBe(false);
            });

            test('primitive numbers', () => {
                expect(isEnumLike(42)).toBe(false);
                expect(isEnumLike(0)).toBe(false);
                expect(isEnumLike(NaN)).toBe(false);
                expect(isEnumLike(Infinity)).toBe(false);
            });

            test('primitive booleans', () => {
                expect(isEnumLike(true)).toBe(false);
                expect(isEnumLike(false)).toBe(false);
            });

            test('primitive bigints', () => {
                expect(isEnumLike(123n)).toBe(false);
                expect(isEnumLike(0n)).toBe(false);
            });

            test('primitive symbols', () => {
                expect(isEnumLike(Symbol('test'))).toBe(false);
                expect(isEnumLike(Symbol.iterator)).toBe(false);
            });

            test('constructor functions', () => {
                expect(isEnumLike(TestClass)).toBe(false);
                expect(isEnumLike(String)).toBe(false);
                expect(isEnumLike(Number)).toBe(false);
                expect(isEnumLike(Object)).toBe(false);
                expect(isEnumLike(Array)).toBe(false);
            });

            test('class instances', () => {
                const instance = new TestClass('test');
                expect(isEnumLike(instance)).toBe(false);
            });

            test('built-in constructor functions', () => {
                expect(isEnumLike(Date)).toBe(false);
                expect(isEnumLike(RegExp)).toBe(false);
                expect(isEnumLike(Error)).toBe(false);
                expect(isEnumLike(Map)).toBe(false);
                expect(isEnumLike(Set)).toBe(false);
            });

            test('functions', () => {
                const regularFunction = function () {};
                const arrowFunction = () => {};
                expect(isEnumLike(regularFunction)).toBe(false);
                expect(isEnumLike(arrowFunction)).toBe(false);
            });

            test('arrays', () => {
                expect(isEnumLike([])).toBe(false);
                expect(isEnumLike([1, 2, 3])).toBe(false);
                expect(isEnumLike(['a', 'b', 'c'])).toBe(false);
            });

            test('built-in objects with prototypes', () => {
                expect(isEnumLike(new Date())).toBe(false);
                expect(isEnumLike(new RegExp('test'))).toBe(false);
                expect(isEnumLike(new Error('test'))).toBe(false);
                expect(isEnumLike(new Map())).toBe(false);
                expect(isEnumLike(new Set())).toBe(false);
            });
        });

        describe('edge cases', () => {
            test('objects created with Object.create(null)', () => {
                const nullPrototypeObject = Object.create(null);
                nullPrototypeObject.KEY = 'value';
                expect(isEnumLike(nullPrototypeObject)).toBe(true);
            });

            test('objects with null prototype but no properties', () => {
                const emptyNullPrototype = Object.create(null);
                expect(isEnumLike(emptyNullPrototype)).toBe(true);
            });

            test('objects with custom prototypes', () => {
                const proto = { customMethod: () => {} };
                const objectWithCustomProto = Object.create(proto);
                objectWithCustomProto.KEY = 'value';
                expect(isEnumLike(objectWithCustomProto)).toBe(false);
            });

            test('frozen objects', () => {
                const frozenObject = Object.freeze({ KEY: 'value' });
                expect(isEnumLike(frozenObject)).toBe(true);
            });

            test('sealed objects', () => {
                const sealedObject = Object.seal({ KEY: 'value' });
                expect(isEnumLike(sealedObject)).toBe(true);
            });

            test('objects with non-enumerable properties', () => {
                const obj = {};
                Object.defineProperty(obj, 'hiddenKey', {
                    value: 'hiddenValue',
                    enumerable: false,
                });
                Object.defineProperty(obj, 'visibleKey', {
                    value: 'visibleValue',
                    enumerable: true,
                });
                expect(isEnumLike(obj)).toBe(true);
            });

            test('objects with getters and setters', () => {
                const obj = {
                    _value: 'internal',
                    get value() {
                        return this._value;
                    },
                    set value(val: string) {
                        this._value = val;
                    },
                };
                expect(isEnumLike(obj)).toBe(true);
            });

            test('objects with only symbol properties', () => {
                const sym1 = Symbol('key1');
                const sym2 = Symbol('key2');
                const symbolOnlyObject = {
                    [sym1]: 'value1',
                    [sym2]: 'value2',
                };
                expect(isEnumLike(symbolOnlyObject)).toBe(true);
            });
        });

        describe('prototype detection', () => {
            test('should detect prototype property on constructors', () => {
                // Constructors have a prototype property
                expect('prototype' in TestClass).toBe(true);
                expect('prototype' in String).toBe(true);
                expect('prototype' in Array).toBe(true);

                // These should all return false for isEnumLike
                expect(isEnumLike(TestClass)).toBe(false);
                expect(isEnumLike(String)).toBe(false);
                expect(isEnumLike(Array)).toBe(false);
            });

            test('should not detect prototype on regular objects', () => {
                const regularObject = { key: 'value' };
                const enumObject = TestEnum;

                // Regular objects don't have a 'prototype' property
                expect('prototype' in regularObject).toBe(false);
                expect('prototype' in enumObject).toBe(false);

                // These should return true for isEnumLike
                expect(isEnumLike(regularObject)).toBe(true);
                expect(isEnumLike(enumObject)).toBe(true);
            });

            test('should handle objects with manually added prototype property', () => {
                const objWithPrototypeProp = {
                    prototype: 'not a real prototype',
                    KEY: 'value',
                };

                // This object has a 'prototype' property, so should return false
                expect('prototype' in objWithPrototypeProp).toBe(true);
                expect(isEnumLike(objWithPrototypeProp)).toBe(false);
            });
        });

        describe('TypeScript enum compatibility', () => {
            test('should work with reverse-mapped numeric enums', () => {
                enum AutoNumericEnum {
                    FIRST, // 0
                    SECOND, // 1
                    THIRD, // 2
                }

                // TypeScript numeric enums create reverse mappings
                expect(isEnumLike(AutoNumericEnum)).toBe(true);
                expect(AutoNumericEnum.FIRST).toBe(0);
                expect(AutoNumericEnum[0]).toBe('FIRST');
            });

            test('should work with string enums without reverse mapping', () => {
                enum StringEnum {
                    RED = 'red',
                    GREEN = 'green',
                    BLUE = 'blue',
                }

                expect(isEnumLike(StringEnum)).toBe(true);
                expect(StringEnum.RED).toBe('red');
                // String enums don't have reverse mapping
                expect(
                    (StringEnum as Record<string, unknown>)['red'],
                ).toBeUndefined();
            });

            test('should work with heterogeneous enums', () => {
                enum HeterogeneousEnum {
                    STRING_VALUE = 'string',
                    NUMERIC_VALUE = 42,
                    BOOLEAN_VALUE = 1, // TypeScript doesn't support boolean enum values directly
                }

                expect(isEnumLike(HeterogeneousEnum)).toBe(true);
                expect(HeterogeneousEnum.STRING_VALUE).toBe('string');
                expect(HeterogeneousEnum.NUMERIC_VALUE).toBe(42);
                expect(HeterogeneousEnum.BOOLEAN_VALUE).toBe(1);
            });

            test('should work with computed enum values', () => {
                enum ComputedEnum {
                    A = 1,
                    B = A * 2,
                    C = B + A,
                }

                expect(isEnumLike(ComputedEnum)).toBe(true);
                expect(ComputedEnum.A).toBe(1);
                expect(ComputedEnum.B).toBe(2);
                expect(ComputedEnum.C).toBe(3);
            });
        });
    });

    describe('Integration tests', () => {
        test('should work with type guards in practical scenarios', () => {
            const values = [
                TestEnum,
                TestEnumLike,
                { CUSTOM: 'custom' },
                'not an enum',
                42,
                TestClass,
                new TestClass('test'),
                [],
                null,
                undefined,
            ];

            const enumLikeValues = values.filter(isEnumLike);

            expect(enumLikeValues).toHaveLength(3);
            expect(enumLikeValues).toContain(TestEnum);
            expect(enumLikeValues).toContain(TestEnumLike);
            expect(enumLikeValues).toContainEqual({ CUSTOM: 'custom' });
        });

        test('should preserve type information after type guard', () => {
            function processIfEnumLike(value: unknown): string[] {
                if (isEnumLike(value)) {
                    // TypeScript should know value is EnumLike here
                    return Object.keys(value);
                }
                return [];
            }

            expect(processIfEnumLike(TestEnum)).toEqual([
                'VALUE1',
                'VALUE2',
                'VALUE3',
            ]);
            expect(processIfEnumLike(TestEnumLike)).toEqual([
                'OPTION_A',
                'OPTION_B',
                'OPTION_C',
            ]);
            expect(processIfEnumLike('not enum')).toEqual([]);
            expect(processIfEnumLike(42)).toEqual([]);
        });

        test('should work with generic functions', () => {
            function getEnumKeys<T extends EnumLike>(enumLike: T): string[] {
                return Object.keys(enumLike);
            }

            const stringKeys = getEnumKeys(TestEnum);
            const numberKeys = getEnumKeys(NumericEnum);
            const objectKeys = getEnumKeys(TestEnumLike);

            expect(stringKeys).toEqual(['VALUE1', 'VALUE2', 'VALUE3']);
            expect(numberKeys).toEqual([
                '1',
                '2',
                '3',
                'FIRST',
                'SECOND',
                'THIRD',
            ]);
            expect(objectKeys).toEqual(['OPTION_A', 'OPTION_B', 'OPTION_C']);
        });

        test('should work with nested enum-like structures', () => {
            const nestedStructure: NestedEnumLike = [
                TestEnum,
                [TestEnumLike, NumericEnum],
                [[{ DEEP: 'deep' }]],
            ];

            expect(Array.isArray(nestedStructure)).toBe(true);
            expect(isEnumLike(nestedStructure[0])).toBe(true);
            expect(Array.isArray(nestedStructure[1])).toBe(true);
            expect(
                isEnumLike((nestedStructure[1] as NestedEnumLike[])[0]),
            ).toBe(true);
            expect(
                isEnumLike((nestedStructure[1] as NestedEnumLike[])[1]),
            ).toBe(true);
        });
    });
});
