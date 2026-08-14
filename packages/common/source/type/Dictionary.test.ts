// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    Dictionary,
    dictionaryFrom,
    PartialDictionary,
    PartialRestrictedDictionary,
    RestrictedDictionary,
} from './Dictionary';

describe('Dictionary', () => {
    describe('Type Definitions', () => {
        describe('Dictionary<T> type', () => {
            test('should accept string-to-string mappings', () => {
                const stringDict: Dictionary<string> = {
                    key1: 'value1',
                    key2: 'value2',
                    key3: 'value3',
                };

                expect(stringDict.key1).toBe('value1');
                expect(stringDict.key2).toBe('value2');
                expect(stringDict.key3).toBe('value3');
            });

            test('should accept string-to-number mappings', () => {
                const numberDict: Dictionary<number> = {
                    first: 1,
                    second: 2,
                    third: 3,
                };

                expect(numberDict.first).toBe(1);
                expect(numberDict.second).toBe(2);
                expect(numberDict.third).toBe(3);
            });

            test('should accept string-to-boolean mappings', () => {
                const booleanDict: Dictionary<boolean> = {
                    enabled: true,
                    disabled: false,
                    active: true,
                };

                expect(booleanDict.enabled).toBe(true);
                expect(booleanDict.disabled).toBe(false);
                expect(booleanDict.active).toBe(true);
            });

            test('should accept string-to-object mappings', () => {
                interface User {
                    name: string;
                    age: number;
                }

                const userDict: Dictionary<User> = {
                    user1: { name: 'Alice', age: 30 },
                    user2: { name: 'Bob', age: 25 },
                };

                expect(userDict.user1.name).toBe('Alice');
                expect(userDict.user1.age).toBe(30);
                expect(userDict.user2.name).toBe('Bob');
                expect(userDict.user2.age).toBe(25);
            });

            test('should accept string-to-array mappings', () => {
                const arrayDict: Dictionary<string[]> = {
                    fruits: ['apple', 'banana', 'orange'],
                    colors: ['red', 'green', 'blue'],
                };

                expect(arrayDict.fruits).toEqual(['apple', 'banana', 'orange']);
                expect(arrayDict.colors).toEqual(['red', 'green', 'blue']);
            });

            test('should accept mixed value types with union types', () => {
                const mixedDict: Dictionary<string | number | boolean> = {
                    name: 'test',
                    count: 42,
                    enabled: true,
                };

                expect(mixedDict.name).toBe('test');
                expect(mixedDict.count).toBe(42);
                expect(mixedDict.enabled).toBe(true);
            });

            test('should allow empty dictionaries', () => {
                const emptyDict: Dictionary<string> = {};
                expect(Object.keys(emptyDict)).toHaveLength(0);
            });
        });

        describe('PartialDictionary<T> type', () => {
            test('should allow optional values', () => {
                const partialDict: PartialDictionary<string> = {
                    key1: 'value1',
                    key2: undefined,
                };

                expect(partialDict.key1).toBe('value1');
                expect(partialDict.key2).toBeUndefined();
            });

            test('should allow missing keys', () => {
                const partialDict: PartialDictionary<number> = {
                    present: 42,
                };

                expect(partialDict.present).toBe(42);
                expect(partialDict.missing).toBeUndefined();
            });

            test('should work with object values', () => {
                interface Config {
                    enabled: boolean;
                    timeout: number;
                }

                const configDict: PartialDictionary<Config> = {
                    production: { enabled: true, timeout: 5000 },
                    development: undefined,
                };

                expect(configDict.production?.enabled).toBe(true);
                expect(configDict.production?.timeout).toBe(5000);
                expect(configDict.development).toBeUndefined();
            });

            test('should allow completely empty dictionaries', () => {
                const emptyPartialDict: PartialDictionary<string> = {};
                expect(Object.keys(emptyPartialDict)).toHaveLength(0);
            });
        });

        describe('RestrictedDictionary<T, K> type', () => {
            test('should enforce specific keys with string literal types', () => {
                type Colors = 'red' | 'green' | 'blue';
                const colorDict: RestrictedDictionary<string, Colors> = {
                    red: '#FF0000',
                    green: '#00FF00',
                    blue: '#0000FF',
                };

                expect(colorDict.red).toBe('#FF0000');
                expect(colorDict.green).toBe('#00FF00');
                expect(colorDict.blue).toBe('#0000FF');
            });

            test('should work with different value types', () => {
                type MetricKeys = 'cpu' | 'memory' | 'disk';
                const metricsDict: RestrictedDictionary<number, MetricKeys> = {
                    cpu: 85.5,
                    memory: 67.2,
                    disk: 45.0,
                };

                expect(metricsDict.cpu).toBe(85.5);
                expect(metricsDict.memory).toBe(67.2);
                expect(metricsDict.disk).toBe(45.0);
            });

            test('should work with object values', () => {
                type ConfigKeys = 'database' | 'cache';
                interface ConnectionConfig {
                    host: string;
                    port: number;
                }

                const configDict: RestrictedDictionary<
                    ConnectionConfig,
                    ConfigKeys
                > = {
                    database: { host: 'localhost', port: 5432 },
                    cache: { host: 'redis-server', port: 6379 },
                };

                expect(configDict.database.host).toBe('localhost');
                expect(configDict.database.port).toBe(5432);
                expect(configDict.cache.host).toBe('redis-server');
                expect(configDict.cache.port).toBe(6379);
            });

            test('should work with single key type', () => {
                const singleKeyDict: RestrictedDictionary<boolean, 'enabled'> =
                    {
                        enabled: true,
                    };

                expect(singleKeyDict.enabled).toBe(true);
            });
        });

        describe('PartialRestrictedDictionary<T, K> type', () => {
            test('should allow optional values for specific keys', () => {
                type FeatureFlags = 'featureA' | 'featureB' | 'featureC';
                const flagsDict: PartialRestrictedDictionary<
                    boolean,
                    FeatureFlags
                > = {
                    featureA: true,
                    featureB: undefined,
                };

                expect(flagsDict.featureA).toBe(true);
                expect(flagsDict.featureB).toBeUndefined();
                expect(flagsDict.featureC).toBeUndefined();
            });

            test('should work with object values', () => {
                type ServiceKeys = 'auth' | 'billing' | 'analytics';
                interface ServiceConfig {
                    endpoint: string;
                    timeout: number;
                }

                const servicesDict: PartialRestrictedDictionary<
                    ServiceConfig,
                    ServiceKeys
                > = {
                    auth: { endpoint: '/auth', timeout: 3000 },
                    billing: undefined,
                };

                expect(servicesDict.auth?.endpoint).toBe('/auth');
                expect(servicesDict.auth?.timeout).toBe(3000);
                expect(servicesDict.billing).toBeUndefined();
                expect(servicesDict.analytics).toBeUndefined();
            });

            test('should allow completely empty dictionaries', () => {
                type Keys = 'a' | 'b' | 'c';
                const emptyDict: PartialRestrictedDictionary<string, Keys> = {};
                expect(Object.keys(emptyDict)).toHaveLength(0);
            });

            test('should work with union value types', () => {
                type StatusKeys = 'success' | 'error' | 'pending';
                const statusDict: PartialRestrictedDictionary<
                    string | number,
                    StatusKeys
                > = {
                    success: 'OK',
                    error: 500,
                };

                expect(statusDict.success).toBe('OK');
                expect(statusDict.error).toBe(500);
                expect(statusDict.pending).toBeUndefined();
            });
        });
    });

    describe('dictionaryFrom function', () => {
        describe('basic functionality', () => {
            test('should convert simple object to dictionary', () => {
                const input = { a: 1, b: 2, c: 3 };
                const result = dictionaryFrom(input);

                expect(result).toEqual({ a: 1, b: 2, c: 3 });
                expect(typeof result).toBe('object');
            });

            test('should handle empty objects', () => {
                const input = {};
                const result = dictionaryFrom(input);

                expect(result).toEqual({});
                expect(Object.keys(result)).toHaveLength(0);
            });

            test('should handle objects with string values', () => {
                const input = {
                    name: 'John',
                    city: 'New York',
                    country: 'USA',
                };
                const result = dictionaryFrom<string>(input);

                expect(result.name).toBe('John');
                expect(result.city).toBe('New York');
                expect(result.country).toBe('USA');
            });

            test('should handle objects with number values', () => {
                const input = { width: 100, height: 200, depth: 50 };
                const result = dictionaryFrom<number>(input);

                expect(result.width).toBe(100);
                expect(result.height).toBe(200);
                expect(result.depth).toBe(50);
            });

            test('should handle objects with boolean values', () => {
                const input = { enabled: true, visible: false, active: true };
                const result = dictionaryFrom<boolean>(input);

                expect(result.enabled).toBe(true);
                expect(result.visible).toBe(false);
                expect(result.active).toBe(true);
            });

            test('should handle objects with mixed value types', () => {
                const input = {
                    name: 'test',
                    count: 42,
                    enabled: true,
                    data: null,
                };
                const result = dictionaryFrom(input);

                expect(result.name).toBe('test');
                expect(result.count).toBe(42);
                expect(result.enabled).toBe(true);
                expect(result.data).toBe(null);
            });
        });

        describe('complex value types', () => {
            test('should handle objects with array values', () => {
                const input = {
                    fruits: ['apple', 'banana'],
                    numbers: [1, 2, 3],
                };
                const result = dictionaryFrom(input);

                expect(result.fruits).toEqual(['apple', 'banana']);
                expect(result.numbers).toEqual([1, 2, 3]);
            });

            test('should handle objects with object values', () => {
                const input = {
                    user: { name: 'Alice', age: 30 },
                    config: { timeout: 5000, retries: 3 },
                };
                const result = dictionaryFrom(input);

                expect(result.user).toEqual({ name: 'Alice', age: 30 });
                expect(result.config).toEqual({ timeout: 5000, retries: 3 });
            });

            test('should handle nested objects', () => {
                const input = {
                    level1: {
                        level2: {
                            value: 'deep',
                        },
                    },
                };
                const result = dictionaryFrom(input);

                expect(result.level1).toEqual({
                    level2: {
                        value: 'deep',
                    },
                });
            });

            test('should handle objects with function values', () => {
                const input = {
                    handler: () => 'hello',
                    processor: function (x: number) {
                        return x * 2;
                    },
                };
                const result = dictionaryFrom(input);

                expect(typeof result.handler).toBe('function');
                expect(typeof result.processor).toBe('function');
                expect((result.handler as () => string)()).toBe('hello');
                expect((result.processor as (x: number) => number)(5)).toBe(10);
            });

            test('should handle objects with undefined and null values', () => {
                const input = {
                    defined: 'value',
                    undefined: undefined,
                    null: null,
                };
                const result = dictionaryFrom(input);

                expect(result.defined).toBe('value');
                expect(result.undefined).toBeUndefined();
                expect(result.null).toBe(null);
            });
        });

        describe('edge cases', () => {
            test('should handle objects with symbol keys (filtered out)', () => {
                const symbolKey = Symbol('key');
                const input = {
                    stringKey: 'value',
                    [symbolKey]: 'symbolValue',
                };
                const result = dictionaryFrom(input);

                expect(result.stringKey).toBe('value');
                expect(
                    result[symbolKey as unknown as keyof typeof result],
                ).toBeUndefined();
                expect(Object.keys(result)).toEqual(['stringKey']);
            });

            test('should handle objects with non-enumerable properties (filtered out)', () => {
                const input = { visible: 'value' };
                Object.defineProperty(input, 'hidden', {
                    value: 'hiddenValue',
                    enumerable: false,
                });

                const result = dictionaryFrom(input);

                expect(result.visible).toBe('value');
                expect(
                    (result as Record<string, unknown>).hidden,
                ).toBeUndefined();
                expect(Object.keys(result)).toEqual(['visible']);
            });

            test('should handle objects with getters and setters', () => {
                const input = {
                    _value: 'internal',
                    get value() {
                        return this._value;
                    },
                    set value(val: string) {
                        this._value = val;
                    },
                    regularProp: 'regular',
                };

                const result = dictionaryFrom(input);

                expect(result._value).toBe('internal');
                expect(result.value).toBe('internal');
                expect(result.regularProp).toBe('regular');
            });

            test('should handle objects created with Object.create(null)', () => {
                const input = Object.create(null);
                input.key1 = 'value1';
                input.key2 = 'value2';

                const result = dictionaryFrom(input);

                expect(result.key1).toBe('value1');
                expect(result.key2).toBe('value2');
                expect(Object.keys(result)).toEqual(['key1', 'key2']);
            });

            test('should handle frozen objects', () => {
                const input = Object.freeze({
                    frozen: 'value',
                    another: 'test',
                });
                const result = dictionaryFrom(input);

                expect(result.frozen).toBe('value');
                expect(result.another).toBe('test');
                expect(Object.keys(result)).toEqual(['frozen', 'another']);
            });

            test('should handle sealed objects', () => {
                const input = Object.seal({ sealed: 'value', test: 123 });
                const result = dictionaryFrom(input);

                expect(result.sealed).toBe('value');
                expect(result.test).toBe(123);
                expect(Object.keys(result)).toEqual(['sealed', 'test']);
            });
        });

        describe('class instances and special objects', () => {
            test('should handle class instances', () => {
                class TestClass {
                    public prop1 = 'value1';
                    public prop2 = 42;

                    constructor(public dynamicProp: string) {}

                    method() {
                        return 'method result';
                    }
                }

                const instance = new TestClass('dynamic');
                const result = dictionaryFrom(instance);

                expect(result.prop1).toBe('value1');
                expect(result.prop2).toBe(42);
                expect(result.dynamicProp).toBe('dynamic');
                // Methods are not enumerable, so they won't be included
                expect(
                    (result as Record<string, unknown>).method,
                ).toBeUndefined();
                expect(Object.keys(result)).toEqual([
                    'dynamicProp',
                    'prop1',
                    'prop2',
                ]);
            });

            test('should handle Date objects', () => {
                const date = new Date('2023-01-01T00:00:00Z');
                const result = dictionaryFrom(date);

                // Date objects don't have enumerable properties by default
                expect(Object.keys(result)).toHaveLength(0);
            });

            test('should handle Arrays (though not recommended)', () => {
                const array = ['a', 'b', 'c'];
                const result = dictionaryFrom(array);

                expect(result['0']).toBe('a');
                expect(result['1']).toBe('b');
                expect(result['2']).toBe('c');
                expect(Object.keys(result)).toEqual(['0', '1', '2']);
            });

            test('should handle RegExp objects', () => {
                const regex = /test/gi;
                const result = dictionaryFrom(regex);

                // RegExp objects don't have enumerable properties by default
                expect(Object.keys(result)).toHaveLength(0);
            });

            test('should handle Error objects', () => {
                const error = new Error('Test error');
                const result = dictionaryFrom(error);

                // Error objects may have enumerable properties depending on the environment
                // We just check that it doesn't throw
                expect(typeof result).toBe('object');
            });
        });

        describe('return value properties', () => {
            test('should return a new object (not the same reference)', () => {
                const input = { a: 1, b: 2 };
                const result = dictionaryFrom(input);

                expect(result).not.toBe(input);
                expect(result).toEqual(input);
            });

            test('should maintain deep equality for nested objects', () => {
                const input = {
                    nested: { value: 'test' },
                    array: [1, 2, 3],
                };
                const result = dictionaryFrom(input);

                expect(result.nested).toBe(input.nested); // Same reference for nested objects
                expect(result.array).toBe(input.array); // Same reference for arrays
            });

            test('should have Object.prototype as prototype', () => {
                const input = { test: 'value' };
                const result = dictionaryFrom(input);

                expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
                expect(result.hasOwnProperty).toBeDefined();
                expect(result.toString).toBeDefined();
            });

            test('should be extensible', () => {
                const input = { existing: 'value' };
                const result = dictionaryFrom(input);

                result.newProp = 'new value';
                expect(result.newProp).toBe('new value');
                expect(Object.isExtensible(result)).toBe(true);
            });
        });

        describe('type safety', () => {
            test('should work with explicit generic type parameter', () => {
                interface User {
                    name: string;
                    age: number;
                }

                const input = {
                    user1: { name: 'Alice', age: 30 },
                    user2: { name: 'Bob', age: 25 },
                };

                const result = dictionaryFrom<User>(input);

                expect(result.user1.name).toBe('Alice');
                expect(result.user1.age).toBe(30);
                expect(result.user2.name).toBe('Bob');
                expect(result.user2.age).toBe(25);
            });

            test('should work without explicit generic type parameter', () => {
                const input = { mixed: 'value', number: 42, bool: true };
                const result = dictionaryFrom(input);

                expect(result.mixed).toBe('value');
                expect(result.number).toBe(42);
                expect(result.bool).toBe(true);
            });

            test('should work with unknown value type', () => {
                const input = { anything: 'can be here', even: [1, 2, 3] };
                const result = dictionaryFrom<unknown>(input);

                expect(result.anything).toBe('can be here');
                expect(result.even).toEqual([1, 2, 3]);
            });
        });
    });

    describe('Integration tests', () => {
        test('should work with all dictionary types together', () => {
            // Create data using dictionaryFrom
            const sourceData = { name: 'test', value: 42, enabled: true };
            const dict = dictionaryFrom<string | number | boolean>(sourceData);

            // Use as Dictionary type
            const typedDict: Dictionary<string | number | boolean> = dict;
            expect(typedDict.name).toBe('test');
            expect(typedDict.value).toBe(42);
            expect(typedDict.enabled).toBe(true);

            // Convert to partial dictionary
            const partialDict: PartialDictionary<string | number | boolean> = {
                ...dict,
                optional: undefined,
            };
            expect(partialDict.name).toBe('test');
            expect(partialDict.optional).toBeUndefined();
        });

        test('should work in practical scenarios', () => {
            // Configuration management scenario
            type ConfigKeys = 'database' | 'cache' | 'logging';

            interface ConfigValue {
                host: string;
                port: number;
                enabled: boolean;
            }

            const rawConfig = {
                database: { host: 'localhost', port: 5432, enabled: true },
                cache: { host: 'redis', port: 6379, enabled: true },
                logging: { host: 'logserver', port: 514, enabled: false },
            };

            // Convert to dictionary
            const configDict = dictionaryFrom<ConfigValue>(rawConfig);

            // Use as restricted dictionary
            const restrictedConfig: RestrictedDictionary<
                ConfigValue,
                ConfigKeys
            > = configDict as RestrictedDictionary<ConfigValue, ConfigKeys>;

            expect(restrictedConfig.database.host).toBe('localhost');
            expect(restrictedConfig.cache.port).toBe(6379);
            expect(restrictedConfig.logging.enabled).toBe(false);

            // Create partial version for overrides
            const overrides: PartialRestrictedDictionary<
                ConfigValue,
                ConfigKeys
            > = {
                database: { host: 'prod-db', port: 5432, enabled: true },
            };

            expect(overrides.database?.host).toBe('prod-db');
            expect(overrides.cache).toBeUndefined();
        });

        test('should handle complex transformation pipelines', () => {
            // Start with complex object
            const complexInput = {
                users: {
                    admin: {
                        name: 'Admin',
                        permissions: ['read', 'write', 'delete'],
                    },
                    user: { name: 'User', permissions: ['read'] },
                },
                settings: {
                    theme: 'dark',
                    notifications: true,
                    timeout: 30000,
                },
            };

            // Transform to dictionary
            const dict = dictionaryFrom(complexInput);

            // Verify structure is preserved
            expect((dict.users as Record<string, unknown>).admin).toEqual({
                name: 'Admin',
                permissions: ['read', 'write', 'delete'],
            });
            expect((dict.users as Record<string, unknown>).user).toEqual({
                name: 'User',
                permissions: ['read'],
            });
            expect(dict.settings).toEqual({
                theme: 'dark',
                notifications: true,
                timeout: 30000,
            });

            // Can be used as different dictionary types
            const typedDict: Dictionary<unknown> = dict;
            const partialDict: PartialDictionary<unknown> = {
                ...dict,
                extra: undefined,
            };

            expect(Object.keys(typedDict)).toEqual(['users', 'settings']);
            expect(partialDict.extra).toBeUndefined();
        });
    });
});
