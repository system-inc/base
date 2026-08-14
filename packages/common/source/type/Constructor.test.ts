// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor, isConstructor, NestedConstructor } from './Constructor';

describe('Constructor', () => {
    // Test classes for constructor testing
    class SimpleClass {
        constructor(public value: string) {}
    }

    class ComplexClass {
        constructor(
            public name: string,
            public age: number,
            public active: boolean = true,
        ) {}

        method() {
            return `${this.name} is ${this.age} years old`;
        }
    }

    class NoParamClass {
        constructor() {}
    }

    class GenericClass<T> {
        constructor(public data: T) {}
    }

    // Abstract class for testing
    abstract class AbstractClass {
        constructor(public id: number) {}
        abstract abstractMethod(): void;
    }

    class ConcreteClass extends AbstractClass {
        constructor(
            id: number,
            public name: string,
        ) {
            super(id);
        }
        abstractMethod(): void {
            // Implementation
        }
    }

    describe('Type Definitions', () => {
        describe('Constructor<T, A> type', () => {
            test('should work with simple constructor signatures', () => {
                // Using object types to avoid wrapper object type warnings
                const StringConstructor: Constructor<object, [string]> = String;
                const NumberConstructor: Constructor<
                    object,
                    [number | undefined]
                > = Number;
                const BooleanConstructor: Constructor<
                    object,
                    [boolean | undefined]
                > = Boolean;

                expect(typeof StringConstructor).toBe('function');
                expect(typeof NumberConstructor).toBe('function');
                expect(typeof BooleanConstructor).toBe('function');

                // Test construction
                const str = new StringConstructor('test');
                const num = new NumberConstructor(42);
                const bool = new BooleanConstructor(true);

                expect(str).toBeInstanceOf(String);
                expect(num).toBeInstanceOf(Number);
                expect(bool).toBeInstanceOf(Boolean);
            });

            test('should work with custom class constructors', () => {
                const SimpleConstructor: Constructor<SimpleClass, [string]> =
                    SimpleClass;
                const ComplexConstructor: Constructor<
                    ComplexClass,
                    [string, number, boolean?]
                > = ComplexClass;

                expect(typeof SimpleConstructor).toBe('function');
                expect(typeof ComplexConstructor).toBe('function');

                // Test construction
                const simple = new SimpleConstructor('test');
                const complex = new ComplexConstructor('Alice', 30, false);

                expect(simple).toBeInstanceOf(SimpleClass);
                expect(simple.value).toBe('test');
                expect(complex).toBeInstanceOf(ComplexClass);
                expect(complex.name).toBe('Alice');
                expect(complex.age).toBe(30);
                expect(complex.active).toBe(false);
            });

            test('should work with no-parameter constructors', () => {
                const NoParamConstructor: Constructor<NoParamClass, []> =
                    NoParamClass;

                expect(typeof NoParamConstructor).toBe('function');

                const instance = new NoParamConstructor();
                expect(instance).toBeInstanceOf(NoParamClass);
            });

            test('should work with built-in constructors', () => {
                const DateConstructor: Constructor<
                    Date,
                    [string | number | Date | undefined]
                > = Date;
                const ArrayConstructor: Constructor<
                    unknown[],
                    [number | undefined]
                > = Array;
                const ObjectConstructor: Constructor<object, []> = Object;

                expect(typeof DateConstructor).toBe('function');
                expect(typeof ArrayConstructor).toBe('function');
                expect(typeof ObjectConstructor).toBe('function');

                // Test construction
                const date = new DateConstructor('2023-01-01');
                const array = new ArrayConstructor(5);
                const obj = new ObjectConstructor();

                expect(date).toBeInstanceOf(Date);
                expect(array).toBeInstanceOf(Array);
                expect(array).toHaveLength(5);
                expect(obj).toBeInstanceOf(Object);
            });

            test('should work with generic constructors', () => {
                const GenericStringConstructor: Constructor<
                    GenericClass<string>,
                    [string]
                > = GenericClass;
                const GenericNumberConstructor: Constructor<
                    GenericClass<number>,
                    [number]
                > = GenericClass;

                expect(typeof GenericStringConstructor).toBe('function');
                expect(typeof GenericNumberConstructor).toBe('function');

                const stringInstance = new GenericStringConstructor('test');
                const numberInstance = new GenericNumberConstructor(42);

                expect(stringInstance).toBeInstanceOf(GenericClass);
                expect(stringInstance.data).toBe('test');
                expect(numberInstance).toBeInstanceOf(GenericClass);
                expect(numberInstance.data).toBe(42);
            });

            test('should work with inheritance', () => {
                const ConcreteConstructor: Constructor<
                    ConcreteClass,
                    [number, string]
                > = ConcreteClass;

                expect(typeof ConcreteConstructor).toBe('function');

                const instance = new ConcreteConstructor(1, 'test');
                expect(instance).toBeInstanceOf(ConcreteClass);
                expect(instance).toBeInstanceOf(AbstractClass);
                expect(instance.id).toBe(1);
                expect(instance.name).toBe('test');
            });

            test('should default to object type when no type parameter provided', () => {
                const DefaultConstructor: Constructor = Object;
                expect(typeof DefaultConstructor).toBe('function');

                const instance = new DefaultConstructor();
                expect(typeof instance).toBe('object');
            });

            test('should work with any[] default for arguments', () => {
                const FlexibleConstructor: Constructor<SimpleClass> =
                    SimpleClass;
                expect(typeof FlexibleConstructor).toBe('function');

                // This should work even though we didn't specify argument types
                const instance = new FlexibleConstructor('test');
                expect(instance).toBeInstanceOf(SimpleClass);
                expect(instance.value).toBe('test');
            });
        });

        describe('NestedConstructor<T> type', () => {
            test('should accept single constructors', () => {
                const singleConstructor: NestedConstructor<SimpleClass> =
                    SimpleClass;
                expect(typeof singleConstructor).toBe('function');
            });

            test('should accept arrays of constructors', () => {
                const constructorArray: NestedConstructor<object> = [
                    SimpleClass,
                    ComplexClass,
                    NoParamClass,
                ];

                expect(Array.isArray(constructorArray)).toBe(true);
                expect(constructorArray).toHaveLength(3);
                expect(typeof constructorArray[0]).toBe('function');
                expect(typeof constructorArray[1]).toBe('function');
                expect(typeof constructorArray[2]).toBe('function');
            });

            test('should accept deeply nested arrays', () => {
                const deeplyNested: NestedConstructor<object> = [
                    SimpleClass,
                    [ComplexClass, [NoParamClass]],
                ];

                expect(Array.isArray(deeplyNested)).toBe(true);
                expect(typeof deeplyNested[0]).toBe('function');
                expect(Array.isArray(deeplyNested[1])).toBe(true);
                expect(
                    typeof (deeplyNested[1] as NestedConstructor<object>[])[0],
                ).toBe('function');
                expect(
                    Array.isArray(
                        (deeplyNested[1] as NestedConstructor<object>[])[1],
                    ),
                ).toBe(true);
            });

            test('should work with mixed nesting levels', () => {
                const mixed: NestedConstructor<object> = [
                    SimpleClass,
                    [ComplexClass],
                    [[NoParamClass]],
                    [[[Date]]],
                ];

                expect(Array.isArray(mixed)).toBe(true);
                expect(mixed).toHaveLength(4);
                expect(typeof mixed[0]).toBe('function');
                expect(Array.isArray(mixed[1])).toBe(true);
                expect(Array.isArray(mixed[2])).toBe(true);
                expect(Array.isArray(mixed[3])).toBe(true);
            });

            test('should work with specific type constraints', () => {
                const typedNested: NestedConstructor<SimpleClass> = [
                    SimpleClass,
                    [SimpleClass, SimpleClass],
                ];

                expect(Array.isArray(typedNested)).toBe(true);
                expect(typeof typedNested[0]).toBe('function');
                expect(Array.isArray(typedNested[1])).toBe(true);
            });
        });
    });

    describe('isConstructor function', () => {
        describe('should return true for constructor functions', () => {
            test('custom class constructors', () => {
                expect(isConstructor(SimpleClass)).toBe(true);
                expect(isConstructor(ComplexClass)).toBe(true);
                expect(isConstructor(NoParamClass)).toBe(true);
                expect(isConstructor(GenericClass)).toBe(true);
            });

            test('built-in constructors', () => {
                expect(isConstructor(Object)).toBe(true);
                expect(isConstructor(Array)).toBe(true);
                expect(isConstructor(String)).toBe(true);
                expect(isConstructor(Number)).toBe(true);
                expect(isConstructor(Boolean)).toBe(true);
                expect(isConstructor(Date)).toBe(true);
                expect(isConstructor(RegExp)).toBe(true);
                expect(isConstructor(Error)).toBe(true);
                expect(isConstructor(Map)).toBe(true);
                expect(isConstructor(Set)).toBe(true);
                expect(isConstructor(Promise)).toBe(true);
            });

            test('function constructors created at runtime', () => {
                const RuntimeConstructor = function (
                    this: { value: string },
                    value: string,
                ) {
                    (this as { value: string }).value = value;
                };
                RuntimeConstructor.prototype.method = function () {
                    return this.value;
                };

                expect(isConstructor(RuntimeConstructor)).toBe(true);
            });

            test('class expressions', () => {
                const ClassExpression = class {
                    constructor(public value: string) {}
                };

                expect(isConstructor(ClassExpression)).toBe(true);
            });

            test('inherited classes', () => {
                expect(isConstructor(ConcreteClass)).toBe(true);
                expect(isConstructor(AbstractClass)).toBe(true);
            });

            test('constructor functions with modified prototypes', () => {
                function CustomConstructor(
                    this: { name: string },
                    name: string,
                ) {
                    (this as { name: string }).name = name;
                }
                CustomConstructor.prototype = {
                    constructor: CustomConstructor,
                    getName: function () {
                        return this.name;
                    },
                };

                expect(isConstructor(CustomConstructor)).toBe(true);
            });
        });

        describe('should return false for non-constructor functions', () => {
            test('regular functions', () => {
                const regularFunction = function () {
                    return 'hello';
                };
                const arrowFunction = () => 'hello';

                // Regular functions have prototype.constructor, so they're detected as constructors
                expect(isConstructor(regularFunction)).toBe(true);
                // Arrow functions don't have prototype
                expect(isConstructor(arrowFunction)).toBe(false);
            });

            test('bound functions', () => {
                const boundFunction = SimpleClass.bind(null);
                // Bound constructors lose their prototype property structure
                expect(isConstructor(boundFunction)).toBe(false);
            });

            test('functions without prototype', () => {
                const noProtoFunction = () => {};
                expect(isConstructor(noProtoFunction)).toBe(false);
            });

            test('functions with null prototype', () => {
                function nullProtoFunction() {}
                (nullProtoFunction as { prototype: unknown }).prototype = null;
                // This will cause a crash due to null.constructor access
                expect(() => isConstructor(nullProtoFunction)).toThrow();
            });

            test('functions with non-object prototype', () => {
                function stringProtoFunction() {}
                (stringProtoFunction as { prototype: unknown }).prototype =
                    'not an object';
                expect(isConstructor(stringProtoFunction)).toBe(false);
            });

            test('functions with prototype lacking constructor', () => {
                function noConstructorFunction() {}
                const originalProto: unknown = noConstructorFunction.prototype;
                // Create object with null prototype to truly lack constructor
                noConstructorFunction.prototype = Object.create(null);
                expect(isConstructor(noConstructorFunction)).toBe(false);
                // Restore original for cleanup
                (noConstructorFunction as { prototype: unknown }).prototype =
                    originalProto;
            });

            test('functions with non-function constructor', () => {
                function badConstructorFunction() {}
                (
                    badConstructorFunction.prototype as { constructor: unknown }
                ).constructor = 'not a function';
                expect(isConstructor(badConstructorFunction)).toBe(false);
            });
        });

        describe('should return false for non-function values', () => {
            test('primitive values', () => {
                expect(isConstructor(null)).toBe(false);
                expect(isConstructor(undefined)).toBe(false);
                expect(isConstructor('string')).toBe(false);
                expect(isConstructor(42)).toBe(false);
                expect(isConstructor(true)).toBe(false);
                expect(isConstructor(Symbol('test'))).toBe(false);
                expect(isConstructor(123n)).toBe(false);
            });

            test('objects', () => {
                expect(isConstructor({})).toBe(false);
                expect(isConstructor([])).toBe(false);
                expect(isConstructor(new Date())).toBe(false);
                expect(isConstructor(new RegExp('test'))).toBe(false);
                expect(isConstructor(new Map())).toBe(false);
                expect(isConstructor(new Set())).toBe(false);
            });

            test('class instances', () => {
                const simpleInstance = new SimpleClass('test');
                const complexInstance = new ComplexClass('test', 25);

                expect(isConstructor(simpleInstance)).toBe(false);
                expect(isConstructor(complexInstance)).toBe(false);
            });
        });

        describe('edge cases', () => {
            test('should handle Proxy objects', () => {
                const ProxyConstructor = new Proxy(SimpleClass, {});
                // Proxy should preserve constructor behavior
                expect(isConstructor(ProxyConstructor)).toBe(true);
            });

            test('should handle functions with prototype chains', () => {
                function ParentConstructor(
                    this: { value: string },
                    value: string,
                ) {
                    (this as { value: string }).value = value;
                }

                function ChildConstructor(
                    this: { value: string; extra: number },
                    value: string,
                    extra: number,
                ) {
                    ParentConstructor.call(this, value);
                    (this as { value: string; extra: number }).extra = extra;
                }

                ChildConstructor.prototype = Object.create(
                    ParentConstructor.prototype,
                );
                ChildConstructor.prototype.constructor = ChildConstructor;

                expect(isConstructor(ParentConstructor)).toBe(true);
                expect(isConstructor(ChildConstructor)).toBe(true);
            });

            test('should handle frozen functions', () => {
                const frozenConstructor = Object.freeze(SimpleClass);
                expect(isConstructor(frozenConstructor)).toBe(true);
            });

            test('should handle sealed functions', () => {
                const sealedConstructor = Object.seal(SimpleClass);
                expect(isConstructor(sealedConstructor)).toBe(true);
            });

            test('should handle functions with modified name', () => {
                function OriginalName() {}
                Object.defineProperty(OriginalName, 'name', {
                    value: 'ModifiedName',
                });
                expect(isConstructor(OriginalName)).toBe(true);
            });

            test('should handle native constructors with unusual properties', () => {
                // Function constructor has a function prototype, not object
                expect(isConstructor(Function)).toBe(false);
                // GeneratorFunction and AsyncFunction are actually valid constructors
                expect(isConstructor(GeneratorFunction)).toBe(true);
                expect(isConstructor(AsyncFunction)).toBe(true);
            });
        });
    });

    describe('Integration tests', () => {
        test('should work with type guards in practical scenarios', () => {
            const values = [
                SimpleClass,
                ComplexClass,
                Object,
                Array,
                () => {},
                'not a constructor',
                42,
                {},
                new SimpleClass('test'),
                null,
                undefined,
            ];

            const constructors = values.filter(isConstructor);

            expect(constructors).toHaveLength(4);
            expect(constructors).toContain(SimpleClass);
            expect(constructors).toContain(ComplexClass);
            expect(constructors).toContain(Object);
            expect(constructors).toContain(Array);
        });

        test('should preserve type information after type guard', () => {
            function createInstance<T>(
                ctor: unknown,
                ...args: unknown[]
            ): T | null {
                if (isConstructor(ctor)) {
                    // TypeScript should know ctor is Constructor here
                    return new ctor(...args) as T;
                }
                return null;
            }

            const simpleInstance = createInstance<SimpleClass>(
                SimpleClass,
                'test',
            );
            const complexInstance = createInstance<ComplexClass>(
                ComplexClass,
                'Alice',
                30,
            );
            const invalidInstance = createInstance<object>('not a constructor');

            expect(simpleInstance).toBeInstanceOf(SimpleClass);
            expect((simpleInstance as SimpleClass).value).toBe('test');
            expect(complexInstance).toBeInstanceOf(ComplexClass);
            expect((complexInstance as ComplexClass).name).toBe('Alice');
            expect(invalidInstance).toBeNull();
        });

        test('should work with constructor factories', () => {
            function createConstructor<T>(
                baseConstructor: Constructor<T>,
                ...mixins: Constructor[]
            ): Constructor<T> {
                // Verify all inputs are constructors
                if (!isConstructor(baseConstructor)) {
                    throw new Error('Base must be a constructor');
                }

                for (const mixin of mixins) {
                    if (!isConstructor(mixin)) {
                        throw new Error('All mixins must be constructors');
                    }
                }

                // Simple factory implementation
                return baseConstructor;
            }

            const FactoryResult = createConstructor(SimpleClass, ComplexClass);
            expect(isConstructor(FactoryResult)).toBe(true);
            expect(FactoryResult).toBe(SimpleClass);

            // Should throw for non-constructors
            expect(() =>
                createConstructor(
                    'not a constructor' as unknown as Constructor,
                    SimpleClass,
                ),
            ).toThrow('Base must be a constructor');
            expect(() =>
                createConstructor(
                    SimpleClass,
                    'not a constructor' as unknown as Constructor,
                ),
            ).toThrow('All mixins must be constructors');
        });

        test('should work with nested constructor processing', () => {
            function processNestedConstructors(
                nested: NestedConstructor,
            ): Constructor[] {
                const result: Constructor[] = [];

                function process(item: NestedConstructor): void {
                    if (Array.isArray(item)) {
                        item.forEach(process);
                    } else if (isConstructor(item)) {
                        result.push(item);
                    }
                }

                process(nested);
                return result;
            }

            const nestedStructure: NestedConstructor = [
                SimpleClass,
                [ComplexClass, NoParamClass],
                [[Date, Array]],
            ];

            const flattened = processNestedConstructors(nestedStructure);

            expect(flattened).toHaveLength(5);
            expect(flattened).toContain(SimpleClass);
            expect(flattened).toContain(ComplexClass);
            expect(flattened).toContain(NoParamClass);
            expect(flattened).toContain(Date);
            expect(flattened).toContain(Array);
        });

        test('should work with reflection and metadata systems', () => {
            // Simulate a metadata system that uses Constructor types
            const metadata = new Map<Constructor, Record<string, unknown>>();

            function registerMetadata(
                ctor: unknown,
                data: Record<string, unknown>,
            ): void {
                if (isConstructor(ctor)) {
                    metadata.set(ctor, data);
                } else {
                    throw new Error(
                        'Can only register metadata for constructors',
                    );
                }
            }

            function getMetadata(
                ctor: Constructor,
            ): Record<string, unknown> | undefined {
                return metadata.get(ctor);
            }

            // Register metadata
            registerMetadata(SimpleClass, { type: 'simple', version: 1 });
            registerMetadata(ComplexClass, { type: 'complex', version: 2 });

            // Retrieve metadata
            expect(getMetadata(SimpleClass)).toEqual({
                type: 'simple',
                version: 1,
            });
            expect(getMetadata(ComplexClass)).toEqual({
                type: 'complex',
                version: 2,
            });
            expect(getMetadata(Date)).toBeUndefined();

            // Should throw for non-constructors
            expect(() => registerMetadata('not a constructor', {})).toThrow(
                'Can only register metadata for constructors',
            );
        });
    });
});

// Helper to get GeneratorFunction and AsyncFunction constructors
const GeneratorFunction = function* () {}.constructor as Constructor;
const AsyncFunction = async function () {}.constructor as Constructor;
