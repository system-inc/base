// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from './Constructor';
import { isPrimitiveType, primitiveTypeCreate } from './PrimitiveType';

describe('PrimitiveType', () => {
    // Test class for non-primitive testing
    class CustomClass {
        constructor(public value: string) {}
    }

    describe('isPrimitiveType', () => {
        describe('should return true for primitive types', () => {
            test('String constructor', () => {
                expect(isPrimitiveType(String)).toBe(true);
            });

            test('Number constructor', () => {
                expect(isPrimitiveType(Number)).toBe(true);
            });

            test('Boolean constructor', () => {
                expect(isPrimitiveType(Boolean)).toBe(true);
            });

            test('BigInt constructor', () => {
                expect(isPrimitiveType(BigInt as unknown as Constructor)).toBe(
                    true,
                );
            });

            test('Symbol constructor', () => {
                expect(isPrimitiveType(Symbol as unknown as Constructor)).toBe(
                    true,
                );
            });

            test('Date constructor', () => {
                expect(isPrimitiveType(Date)).toBe(true);
            });
        });

        describe('should return false for non-primitive types', () => {
            test('custom class constructor', () => {
                expect(isPrimitiveType(CustomClass)).toBe(false);
            });

            test('Array constructor', () => {
                expect(isPrimitiveType(Array)).toBe(false);
            });

            test('Object constructor', () => {
                expect(isPrimitiveType(Object)).toBe(false);
            });

            test('Function constructor', () => {
                expect(isPrimitiveType(Function)).toBe(false);
            });

            test('RegExp constructor', () => {
                expect(isPrimitiveType(RegExp)).toBe(false);
            });

            test('Error constructor', () => {
                expect(isPrimitiveType(Error)).toBe(false);
            });

            test('Map constructor', () => {
                expect(isPrimitiveType(Map)).toBe(false);
            });

            test('Set constructor', () => {
                expect(isPrimitiveType(Set)).toBe(false);
            });
        });

        test('should work with constructor types', () => {
            const stringCtor: Constructor = String;
            const customCtor: Constructor = CustomClass;

            expect(isPrimitiveType(stringCtor)).toBe(true);
            expect(isPrimitiveType(customCtor)).toBe(false);
        });
    });

    describe('primitiveTypeCreate', () => {
        describe('String type creation', () => {
            test('should create string from string', () => {
                const result = primitiveTypeCreate(String, 'hello');
                expect(result).toBe('hello');
                expect(typeof result).toBe('string');
            });

            test('should create string from number', () => {
                const result = primitiveTypeCreate(String, 123);
                expect(result).toBe('123');
                expect(typeof result).toBe('string');
            });

            test('should create string from boolean', () => {
                expect(primitiveTypeCreate(String, true)).toBe('true');
                expect(primitiveTypeCreate(String, false)).toBe('false');
            });

            test('should create string from null', () => {
                const result = primitiveTypeCreate(String, null);
                expect(result).toBe('null');
                expect(typeof result).toBe('string');
            });

            test('should create string from undefined', () => {
                const result = primitiveTypeCreate(String, undefined);
                expect(result).toBe('undefined');
                expect(typeof result).toBe('string');
            });

            test('should create string from object', () => {
                const result = primitiveTypeCreate(String, {
                    toString: () => 'custom',
                });
                expect(result).toBe('custom');
                expect(typeof result).toBe('string');
            });
        });

        describe('Number type creation', () => {
            test('should create number from number', () => {
                const result = primitiveTypeCreate(Number, 42);
                expect(result).toBe(42);
                expect(typeof result).toBe('number');
            });

            test('should create number from string', () => {
                expect(primitiveTypeCreate(Number, '123')).toBe(123);
                expect(primitiveTypeCreate(Number, '123.45')).toBe(123.45);
                expect(primitiveTypeCreate(Number, '0')).toBe(0);
            });

            test('should create number from boolean', () => {
                expect(primitiveTypeCreate(Number, true)).toBe(1);
                expect(primitiveTypeCreate(Number, false)).toBe(0);
            });

            test('should create NaN from invalid strings', () => {
                const result = primitiveTypeCreate(Number, 'invalid');
                expect(Number.isNaN(result as number)).toBe(true);
            });

            test('should create number from null and undefined', () => {
                expect(primitiveTypeCreate(Number, null)).toBe(0);
                expect(
                    Number.isNaN(
                        primitiveTypeCreate(Number, undefined) as number,
                    ),
                ).toBe(true);
            });

            test('should handle special numeric values', () => {
                expect(primitiveTypeCreate(Number, Infinity)).toBe(Infinity);
                expect(primitiveTypeCreate(Number, -Infinity)).toBe(-Infinity);
                expect(primitiveTypeCreate(Number, '0xFF')).toBe(255); // Hex
            });
        });

        describe('Boolean type creation', () => {
            test('should create boolean from boolean', () => {
                expect(primitiveTypeCreate(Boolean, true)).toBe(true);
                expect(primitiveTypeCreate(Boolean, false)).toBe(false);
            });

            test('should create boolean from truthy values', () => {
                expect(primitiveTypeCreate(Boolean, 1)).toBe(true);
                expect(primitiveTypeCreate(Boolean, 'hello')).toBe(true);
                expect(primitiveTypeCreate(Boolean, {})).toBe(true);
                expect(primitiveTypeCreate(Boolean, [])).toBe(true);
            });

            test('should create boolean from falsy values', () => {
                expect(primitiveTypeCreate(Boolean, 0)).toBe(false);
                expect(primitiveTypeCreate(Boolean, '')).toBe(false);
                expect(primitiveTypeCreate(Boolean, null)).toBe(false);
                expect(primitiveTypeCreate(Boolean, undefined)).toBe(false);
                expect(primitiveTypeCreate(Boolean, NaN)).toBe(false);
            });
        });

        describe('BigInt type creation', () => {
            test('should create BigInt from number', () => {
                const result = primitiveTypeCreate(
                    BigInt as unknown as Constructor,
                    123,
                );
                expect(result).toBe(123n);
                expect(typeof result).toBe('bigint');
            });

            test('should create BigInt from string', () => {
                expect(
                    primitiveTypeCreate(
                        BigInt as unknown as Constructor,
                        '123',
                    ),
                ).toBe(123n);
                expect(
                    primitiveTypeCreate(BigInt as unknown as Constructor, '0'),
                ).toBe(0n);
                expect(
                    primitiveTypeCreate(
                        BigInt as unknown as Constructor,
                        '-456',
                    ),
                ).toBe(-456n);
            });

            test('should create BigInt from bigint', () => {
                const result = primitiveTypeCreate(
                    BigInt as unknown as Constructor,
                    789n,
                );
                expect(result).toBe(789n);
                expect(typeof result).toBe('bigint');
            });

            test('should create BigInt from boolean', () => {
                expect(
                    primitiveTypeCreate(BigInt as unknown as Constructor, true),
                ).toBe(1n);
                expect(
                    primitiveTypeCreate(
                        BigInt as unknown as Constructor,
                        false,
                    ),
                ).toBe(0n);
            });

            test('should throw error for invalid types', () => {
                expect(() =>
                    primitiveTypeCreate(BigInt as unknown as Constructor, null),
                ).toThrow(
                    'BigInt value must be a string or number, got object',
                );
                expect(() =>
                    primitiveTypeCreate(
                        BigInt as unknown as Constructor,
                        undefined,
                    ),
                ).toThrow(
                    'BigInt value must be a string or number, got undefined',
                );
                expect(() =>
                    primitiveTypeCreate(BigInt as unknown as Constructor, {}),
                ).toThrow(
                    'BigInt value must be a string or number, got object',
                );
                expect(() =>
                    primitiveTypeCreate(BigInt as unknown as Constructor, []),
                ).toThrow(
                    'BigInt value must be a string or number, got object',
                );
            });

            test('should handle large numbers', () => {
                const result = primitiveTypeCreate(
                    BigInt as unknown as Constructor,
                    '123456789012345678901234567890',
                );
                expect(result).toBe(123456789012345678901234567890n);
            });
        });

        describe('Symbol type creation', () => {
            test('should create Symbol from string', () => {
                const result = primitiveTypeCreate(
                    Symbol as unknown as Constructor,
                    'test',
                );
                expect(typeof result).toBe('symbol');
                expect((result as symbol).toString()).toBe('Symbol(test)');
            });

            test('should create Symbol from number', () => {
                const result = primitiveTypeCreate(
                    Symbol as unknown as Constructor,
                    123,
                );
                expect(typeof result).toBe('symbol');
                expect((result as symbol).toString()).toBe('Symbol(123)');
            });

            test('should create Symbol from empty string', () => {
                const result = primitiveTypeCreate(
                    Symbol as unknown as Constructor,
                    '',
                );
                expect(typeof result).toBe('symbol');
                expect((result as symbol).toString()).toBe('Symbol()');
            });

            test('should throw error for invalid types', () => {
                expect(() =>
                    primitiveTypeCreate(Symbol as unknown as Constructor, null),
                ).toThrow(
                    'Symbol value must be a string or symbol, got object',
                );
                expect(() =>
                    primitiveTypeCreate(
                        Symbol as unknown as Constructor,
                        undefined,
                    ),
                ).toThrow(
                    'Symbol value must be a string or symbol, got undefined',
                );
                expect(() =>
                    primitiveTypeCreate(Symbol as unknown as Constructor, true),
                ).toThrow(
                    'Symbol value must be a string or symbol, got boolean',
                );
                expect(() =>
                    primitiveTypeCreate(Symbol as unknown as Constructor, {}),
                ).toThrow(
                    'Symbol value must be a string or symbol, got object',
                );
            });

            test('should create unique symbols', () => {
                const symbol1 = primitiveTypeCreate(
                    Symbol as unknown as Constructor,
                    'test',
                );
                const symbol2 = primitiveTypeCreate(
                    Symbol as unknown as Constructor,
                    'test',
                );
                expect(symbol1).not.toBe(symbol2);
                expect(typeof symbol1).toBe('symbol');
                expect(typeof symbol2).toBe('symbol');
            });
        });

        describe('Date type creation', () => {
            test('should create Date from Date object', () => {
                const originalDate = new Date('2023-01-01');
                const result = primitiveTypeCreate(Date, originalDate);
                expect(result).toBeInstanceOf(Date);
                expect((result as Date).getTime()).toBe(originalDate.getTime());
            });

            test('should create Date from string', () => {
                const result = primitiveTypeCreate(
                    Date,
                    '2023-06-15T12:00:00Z',
                );
                expect(result).toBeInstanceOf(Date);
                expect((result as Date).getFullYear()).toBe(2023);
                expect((result as Date).getMonth()).toBe(5); // June is 5
                expect((result as Date).getDate()).toBe(15);
            });

            test('should create Date from ISO string', () => {
                const isoString = '2023-06-15T14:30:00.000Z';
                const result = primitiveTypeCreate(Date, isoString);
                expect(result).toBeInstanceOf(Date);
                expect((result as Date).toISOString()).toBe(isoString);
            });

            test('should throw error for invalid types', () => {
                expect(() => primitiveTypeCreate(Date, 123)).toThrow(
                    'Date value must be a string or Date object, got number',
                );
                expect(() => primitiveTypeCreate(Date, null)).toThrow(
                    'Date value must be a string or Date object, got object',
                );
                expect(() => primitiveTypeCreate(Date, undefined)).toThrow(
                    'Date value must be a string or Date object, got undefined',
                );
                expect(() => primitiveTypeCreate(Date, true)).toThrow(
                    'Date value must be a string or Date object, got boolean',
                );
                expect(() => primitiveTypeCreate(Date, {})).toThrow(
                    'Date value must be a string or Date object, got object',
                );
            });

            test('should handle various date string formats', () => {
                const formats = [
                    '2023-06-15T12:00:00Z',
                    '2023-06-15',
                    'June 15, 2023',
                    '2023-06-15T12:00:00.000Z',
                ];

                formats.forEach((format) => {
                    const result = primitiveTypeCreate(Date, format);
                    expect(result).toBeInstanceOf(Date);
                    expect((result as Date).getFullYear()).toBe(2023);
                });
            });

            test('should create invalid date for invalid date strings', () => {
                const result = primitiveTypeCreate(Date, 'invalid date string');
                expect(result).toBeInstanceOf(Date);
                expect(Number.isNaN((result as Date).getTime())).toBe(true);
            });
        });

        describe('Error cases', () => {
            test('should throw error for unsupported constructor', () => {
                expect(() => primitiveTypeCreate(CustomClass, 'test')).toThrow(
                    'Unsupported primitive type: CustomClass',
                );
                expect(() => primitiveTypeCreate(Array, [])).toThrow(
                    'Unsupported primitive type: Array',
                );
                expect(() => primitiveTypeCreate(Object, {})).toThrow(
                    'Unsupported primitive type: Object',
                );
            });

            test('should handle constructors with modified names', () => {
                // Create a copy of String to avoid modifying the global constructor
                const StringCopy = class extends String {};
                Object.defineProperty(StringCopy, 'name', {
                    value: 'ModifiedString',
                });

                expect(() =>
                    primitiveTypeCreate(StringCopy as Constructor, 'test'),
                ).toThrow('Unsupported primitive type: ModifiedString');
            });
        });

        describe('Type consistency', () => {
            test('should maintain type consistency across multiple calls', () => {
                const values = ['test', 123, true, null, undefined];

                values.forEach((value) => {
                    const stringResult = primitiveTypeCreate(String, value);
                    const numberResult = primitiveTypeCreate(Number, value);
                    const booleanResult = primitiveTypeCreate(Boolean, value);

                    expect(typeof stringResult).toBe('string');
                    expect(typeof numberResult).toBe('number');
                    expect(typeof booleanResult).toBe('boolean');
                });
            });

            test('should work with constructor interface', () => {
                const constructors: Constructor[] = [String, Number, Boolean];
                const value = 'test';

                constructors.forEach((ctor) => {
                    if (isPrimitiveType(ctor)) {
                        const result = primitiveTypeCreate(ctor, value);
                        expect(result).toBeDefined();
                    }
                });
            });
        });
    });

    describe('Integration tests', () => {
        test('should work together for type checking and creation', () => {
            // Test with appropriate values for each type
            const testCases = [
                { ctor: String, value: 'test', isPrimitive: true },
                { ctor: Number, value: 123, isPrimitive: true },
                { ctor: Boolean, value: true, isPrimitive: true },
                {
                    ctor: BigInt as unknown as Constructor,
                    value: 123,
                    isPrimitive: true,
                },
                {
                    ctor: Symbol as unknown as Constructor,
                    value: 'test',
                    isPrimitive: true,
                },
                { ctor: Date, value: '2023-06-15', isPrimitive: true },
                { ctor: CustomClass, value: 'test', isPrimitive: false },
            ];

            testCases.forEach(({ ctor, value, isPrimitive }) => {
                expect(isPrimitiveType(ctor)).toBe(isPrimitive);

                if (isPrimitive) {
                    // Should not throw for primitive types
                    expect(() =>
                        primitiveTypeCreate(ctor, value),
                    ).not.toThrow();
                } else {
                    // Should throw for non-primitive types
                    expect(() => primitiveTypeCreate(ctor, value)).toThrow();
                }
            });
        });

        test('should handle round-trip conversions', () => {
            const testCases = [
                { ctor: String, value: 'hello', expected: 'hello' },
                { ctor: Number, value: 42, expected: 42 },
                { ctor: Boolean, value: true, expected: true },
                {
                    ctor: BigInt as unknown as Constructor,
                    value: 123n,
                    expected: 123n,
                },
            ];

            testCases.forEach(({ ctor, value, expected }) => {
                expect(isPrimitiveType(ctor)).toBe(true);
                const result = primitiveTypeCreate(ctor, value);
                expect(result).toBe(expected);
            });
        });

        test('should handle edge case combinations', () => {
            // Test creating primitives from other primitive types
            expect(
                primitiveTypeCreate(String, Symbol('test')) as string,
            ).toContain('Symbol(test)');
            expect(primitiveTypeCreate(Number, '123')).toBe(123);
            expect(primitiveTypeCreate(Boolean, 42)).toBe(true);

            // Test BigInt edge cases
            expect(
                primitiveTypeCreate(BigInt as unknown as Constructor, 0),
            ).toBe(0n);
            expect(
                primitiveTypeCreate(BigInt as unknown as Constructor, '0x10'),
            ).toBe(16n);
        });
    });
});
