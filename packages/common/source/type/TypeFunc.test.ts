// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from './Constructor';
import { EnumLike } from './EnumLike';
import {
    ConstructorTypeFunc,
    EnumTypeFunc,
    TypeFunc,
    typeFuncUnwrap,
} from './TypeFunc';

describe('TypeFunc', () => {
    // Test classes for constructor testing
    class TestClass {
        constructor(public value: string) {}
    }

    class AnotherTestClass {
        constructor(
            public id: number,
            public name: string,
        ) {}
    }

    // Test enums for enum testing
    enum TestEnum {
        VALUE1 = 'value1',
        VALUE2 = 'value2',
        VALUE3 = 'value3',
    }

    const TestEnumLike = {
        OPTION_A: 'optionA',
        OPTION_B: 'optionB',
        OPTION_C: 'optionC',
    } as const;

    describe('Type Definitions', () => {
        test('ConstructorTypeFunc should work with simple constructor', () => {
            const constructorFunc: ConstructorTypeFunc<TestClass> = () =>
                TestClass;
            const result = constructorFunc();
            expect(result).toBe(TestClass);
            expect(typeof result).toBe('function');
        });

        test('ConstructorTypeFunc should work with nested constructor arrays', () => {
            const nestedConstructorFunc: ConstructorTypeFunc<
                TestClass
            > = () => [TestClass];
            const result = nestedConstructorFunc();
            expect(Array.isArray(result)).toBe(true);
            if (Array.isArray(result)) {
                expect(result[0]).toBe(TestClass);
            }
        });

        test('EnumTypeFunc should work with enum', () => {
            const enumFunc: EnumTypeFunc = () => TestEnum;
            const result = enumFunc();
            expect(result).toBe(TestEnum);
            expect(typeof result).toBe('object');
        });

        test('EnumTypeFunc should work with enum-like object', () => {
            const enumLikeFunc: EnumTypeFunc = () => TestEnumLike;
            const result = enumLikeFunc();
            expect(result).toBe(TestEnumLike);
            expect(typeof result).toBe('object');
        });

        test('TypeFunc should accept both constructor and enum functions', () => {
            const constructorTypeFunc: TypeFunc<TestClass> = () => TestClass;
            const enumTypeFunc: TypeFunc = () => TestEnum;

            expect(typeof constructorTypeFunc).toBe('function');
            expect(typeof enumTypeFunc).toBe('function');
        });
    });

    describe('typeFuncUnwrap', () => {
        describe('Constructor unwrapping', () => {
            test('should unwrap simple constructor function', () => {
                const typeFunc: TypeFunc<TestClass> = () => TestClass;
                const result = typeFuncUnwrap(typeFunc);

                expect(result).toBe(TestClass);
                expect(typeof result).toBe('function');
            });

            test('should unwrap constructor from single-element array', () => {
                const typeFunc: TypeFunc<TestClass> = () => [TestClass];
                const result = typeFuncUnwrap(typeFunc);

                expect(result).toBe(TestClass);
                expect(typeof result).toBe('function');
            });

            test('should unwrap constructor from deeply nested arrays', () => {
                const typeFunc: TypeFunc<TestClass> = () => [[[TestClass]]];
                const result = typeFuncUnwrap(typeFunc);

                expect(result).toBe(TestClass);
                expect(typeof result).toBe('function');
            });

            test('should unwrap different constructor types', () => {
                const testClassFunc: TypeFunc<TestClass> = () => TestClass;
                const anotherClassFunc: TypeFunc<AnotherTestClass> = () =>
                    AnotherTestClass;

                expect(typeFuncUnwrap(testClassFunc)).toBe(TestClass);
                expect(typeFuncUnwrap(anotherClassFunc)).toBe(AnotherTestClass);
            });
        });

        describe('Enum unwrapping', () => {
            test('should unwrap enum directly', () => {
                const enumFunc: TypeFunc = () => TestEnum;
                const result = typeFuncUnwrap(enumFunc);

                expect(result).toBe(TestEnum);
                expect(typeof result).toBe('object');
            });

            test('should unwrap enum-like object directly', () => {
                const enumLikeFunc: TypeFunc = () => TestEnumLike;
                const result = typeFuncUnwrap(enumLikeFunc);

                expect(result).toBe(TestEnumLike);
                expect(typeof result).toBe('object');
            });

            test('should unwrap enum from single-element array', () => {
                const enumFunc: TypeFunc = () => [TestEnum];
                const result = typeFuncUnwrap(enumFunc);

                expect(result).toBe(TestEnum);
                expect(typeof result).toBe('object');
            });

            test('should unwrap enum from deeply nested arrays', () => {
                const enumFunc: TypeFunc = () => [[[TestEnumLike]]];
                const result = typeFuncUnwrap(enumFunc);

                expect(result).toBe(TestEnumLike);
                expect(typeof result).toBe('object');
            });
        });

        describe('Error cases', () => {
            test('should throw error for empty array', () => {
                const invalidFunc = () => [] as unknown;

                expect(() => typeFuncUnwrap(invalidFunc as TypeFunc)).toThrow(
                    'TypeFunc array literal must have exactly one element',
                );
            });

            test('should throw error for array with multiple elements', () => {
                const invalidFunc = () =>
                    [TestClass, AnotherTestClass] as unknown;

                expect(() => typeFuncUnwrap(invalidFunc as TypeFunc)).toThrow(
                    'TypeFunc array literal must have exactly one element',
                );
            });

            test('should throw error for nested empty array', () => {
                const invalidFunc = () => [[]] as unknown;

                expect(() => typeFuncUnwrap(invalidFunc as TypeFunc)).toThrow(
                    'TypeFunc array literal must have exactly one element',
                );
            });

            test('should throw error for nested array with multiple elements', () => {
                const invalidFunc = () =>
                    [[TestClass, AnotherTestClass]] as unknown;

                expect(() => typeFuncUnwrap(invalidFunc as TypeFunc)).toThrow(
                    'TypeFunc array literal must have exactly one element',
                );
            });
        });

        describe('Complex nesting scenarios', () => {
            test('should handle alternating nesting levels', () => {
                const complexFunc: TypeFunc<TestClass> = () => [
                    [[[TestClass]]],
                ];
                const result = typeFuncUnwrap(complexFunc);

                expect(result).toBe(TestClass);
            });

            test('should work with very deep nesting', () => {
                const deeplyNestedFunc: TypeFunc = () =>
                    Array(10)
                        .fill(null)
                        .reduce((acc) => [acc], TestEnum);
                const result = typeFuncUnwrap(deeplyNestedFunc);

                expect(result).toBe(TestEnum);
            });
        });

        describe('Return type verification', () => {
            test('should return Constructor type for constructor input', () => {
                const constructorFunc: TypeFunc<TestClass> = () => TestClass;
                const result = typeFuncUnwrap(constructorFunc);

                // Verify it can be used as a constructor
                const instance = new (result as Constructor<TestClass>)('test');
                expect(instance).toBeInstanceOf(TestClass);
                expect(instance.value).toBe('test');
            });

            test('should return EnumLike type for enum input', () => {
                const enumFunc: TypeFunc = () => TestEnum;
                const result = typeFuncUnwrap(enumFunc) as EnumLike;

                // Verify it has enum properties
                expect(result.VALUE1).toBe('value1');
                expect(result.VALUE2).toBe('value2');
                expect(result.VALUE3).toBe('value3');
            });

            test('should return EnumLike type for enum-like object input', () => {
                const enumLikeFunc: TypeFunc = () => TestEnumLike;
                const result = typeFuncUnwrap(enumLikeFunc) as EnumLike;

                // Verify it has enum-like properties
                expect(result.OPTION_A).toBe('optionA');
                expect(result.OPTION_B).toBe('optionB');
                expect(result.OPTION_C).toBe('optionC');
            });
        });
    });

    describe('Real-world usage scenarios', () => {
        test('should work in decorator-like pattern', () => {
            // Simulate a metadata system that uses TypeFunc
            const metadata = new Map<string, Constructor | EnumLike>();

            function processTypeFunc(key: string, typeFunc: TypeFunc) {
                const type = typeFuncUnwrap(typeFunc);
                metadata.set(key, type);
            }

            // Process different types
            processTypeFunc('testClass', () => TestClass);
            processTypeFunc('anotherClass', () => [AnotherTestClass]);
            processTypeFunc('testEnum', () => TestEnum);

            // Verify metadata was stored correctly
            expect(metadata.get('testClass')).toBe(TestClass);
            expect(metadata.get('anotherClass')).toBe(AnotherTestClass);
            expect(metadata.get('testEnum')).toBe(TestEnum);
        });

        test('should work with lazy evaluation pattern', () => {
            // Simulate lazy evaluation where type is resolved only when needed
            let constructorCallCount = 0;
            let enumCallCount = 0;

            const lazyConstructorFunc: TypeFunc<TestClass> = () => {
                constructorCallCount++;
                return TestClass;
            };

            const lazyEnumFunc: TypeFunc = () => {
                enumCallCount++;
                return TestEnum;
            };

            // Functions are created but not called yet
            expect(constructorCallCount).toBe(0);
            expect(enumCallCount).toBe(0);

            // Only when unwrapped are they evaluated
            const constructorResult = typeFuncUnwrap(lazyConstructorFunc);
            const enumResult = typeFuncUnwrap(lazyEnumFunc);

            expect(constructorCallCount).toBe(1);
            expect(enumCallCount).toBe(1);
            expect(constructorResult).toBe(TestClass);
            expect(enumResult).toBe(TestEnum);
        });

        test('should work with conditional type resolution', () => {
            // Test conditional constructor resolution
            const constructorFunc: ConstructorTypeFunc<TestClass> = () =>
                TestClass;
            const constructorResult = typeFuncUnwrap(constructorFunc);
            expect(constructorResult).toBe(TestClass);

            // Test conditional enum resolution
            const enumFunc: EnumTypeFunc = () => TestEnum;
            const enumResult = typeFuncUnwrap(enumFunc);
            expect(enumResult).toBe(TestEnum);

            // Test different constructors based on conditions
            function getConstructorType(
                useFirst: boolean,
            ): ConstructorTypeFunc<TestClass | AnotherTestClass> {
                return useFirst ? () => TestClass : () => AnotherTestClass;
            }

            const firstConstructor = typeFuncUnwrap(getConstructorType(true));
            const secondConstructor = typeFuncUnwrap(getConstructorType(false));

            expect(firstConstructor).toBe(TestClass);
            expect(secondConstructor).toBe(AnotherTestClass);
        });
    });
});
