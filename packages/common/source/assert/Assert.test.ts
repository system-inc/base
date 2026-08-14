// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { assert } from './Assert';

describe('Assert Utilities', () => {
    describe('assert', () => {
        test('should not throw when condition is true', () => {
            expect(() => assert(true)).not.toThrow();
            expect(() => assert(1 > 0)).not.toThrow();
            expect(() => assert('hello' === 'hello')).not.toThrow();
            expect(() => assert([1, 2, 3].length === 3)).not.toThrow();
        });

        test('should throw with default message when condition is false', () => {
            expect(() => assert(false)).toThrow('Assertion failed');
            expect(() => assert(1 > 2)).toThrow('Assertion failed');
            expect(() => assert('hello' === ('world' as string))).toThrow(
                'Assertion failed',
            );
            expect(() => assert([].length > 0)).toThrow('Assertion failed');
        });

        test('should throw with custom message when provided', () => {
            expect(() => assert(false, 'Custom error message')).toThrow(
                'Custom error message',
            );
            expect(() => assert(1 > 2, 'Math is broken')).toThrow(
                'Math is broken',
            );
            expect(() => assert(false, 'Value should not be null')).toThrow(
                'Value should not be null',
            );
        });

        test('should handle truthy expressions correctly', () => {
            expect(() => assert(1 > 0)).not.toThrow();
            expect(() => assert('test'.length > 0)).not.toThrow();
            expect(() => assert([1].length > 0)).not.toThrow();
            expect(() => assert(typeof {} === 'object')).not.toThrow();
            expect(() => assert(Infinity > 0)).not.toThrow();
            expect(() => assert(-1 < 0)).not.toThrow();
        });

        test('should handle falsy expressions correctly', () => {
            expect(() => assert(0 > 1)).toThrow('Assertion failed');
            expect(() => assert(''.length > 0)).toThrow('Assertion failed');

            const nullValue: null | string = null;
            const undefinedValue: undefined | string = undefined;
            expect(() => assert(nullValue === 'test')).toThrow(
                'Assertion failed',
            );
            expect(() => assert(undefinedValue === 'test')).toThrow(
                'Assertion failed',
            );
            expect(() => assert(isNaN(Number('hello')) === false)).toThrow(
                'Assertion failed',
            );
        });

        test('should handle boolean expressions', () => {
            const obj = { value: 42 };

            expect(() => assert(obj.value === 42)).not.toThrow();
            expect(() => assert(obj.value !== 42)).toThrow();
            expect(() => assert(obj.value > 40)).not.toThrow();
            expect(() => assert(obj.value < 40)).toThrow();
        });

        test('should handle undefined message parameter', () => {
            expect(() => assert(false, undefined)).toThrow('Assertion failed');
        });

        test('should handle empty string message', () => {
            expect(() => assert(false, '')).toThrow('Assertion failed');
        });

        test('should handle multiline custom messages', () => {
            const multilineMessage =
                'This is a multiline\nerror message\nwith details';
            expect(() => assert(false, multilineMessage)).toThrow(
                multilineMessage,
            );
        });

        test('should handle special characters in custom messages', () => {
            const specialMessage = 'Error: assertion failed! @#$%^&*()';
            expect(() => assert(false, specialMessage)).toThrow(specialMessage);
        });

        test('should throw Error instances', () => {
            try {
                assert(false);
            } catch (error: unknown) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe('Assertion failed');
            }
        });

        test('should throw Error instances with custom message', () => {
            const customMessage = 'Custom assertion error';
            try {
                assert(false, customMessage);
            } catch (error: unknown) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe(customMessage);
            }
        });

        test('should work with complex boolean expressions', () => {
            const arr = [1, 2, 3, 4, 5];

            expect(() => assert(arr.includes(3))).not.toThrow();
            expect(() => assert(arr.includes(10))).toThrow();
            expect(() => assert(arr.every((x) => x > 0))).not.toThrow();
            expect(() => assert(arr.every((x) => x > 3))).toThrow();
            expect(() => assert(arr.some((x) => x > 3))).not.toThrow();
            expect(() => assert(arr.some((x) => x > 10))).toThrow();
        });

        test('should work with function calls returning booleans', () => {
            const isEven = (n: number) => n % 2 === 0;
            const isPositive = (n: number) => n > 0;

            expect(() => assert(isEven(4))).not.toThrow();
            expect(() => assert(isEven(3))).toThrow();
            expect(() => assert(isPositive(5))).not.toThrow();
            expect(() => assert(isPositive(-1))).toThrow();
        });

        test('should handle assertions in loops and iterations', () => {
            const numbers = [1, 2, 3, 4, 5];

            expect(() => {
                numbers.forEach((n) =>
                    assert(n > 0, `Number ${n} should be positive`),
                );
            }).not.toThrow();

            expect(() => {
                [1, 2, -3, 4].forEach((n) =>
                    assert(n > 0, `Number ${n} should be positive`),
                );
            }).toThrow('Number -3 should be positive');
        });

        test('should work with type guards and type checking', () => {
            const value: unknown = 'hello';

            expect(() => assert(typeof value === 'string')).not.toThrow();
            expect(() => assert(typeof value === 'number')).toThrow();

            const obj: Record<string, unknown> = { name: 'test' };
            expect(() => assert('name' in obj)).not.toThrow();
            expect(() => assert('age' in obj)).toThrow();
        });

        test('should handle promise-related assertions (synchronous)', () => {
            const promise = Promise.resolve(42);

            expect(() => assert(promise instanceof Promise)).not.toThrow();
            expect(() =>
                assert(typeof promise.then === 'function'),
            ).not.toThrow();
        });

        test('should work with regex and pattern matching', () => {
            const email = 'test@example.com';
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            expect(() => assert(emailPattern.test(email))).not.toThrow();
            expect(() => assert(emailPattern.test('invalid-email'))).toThrow();
        });

        test('should handle nested object property assertions', () => {
            const user = {
                profile: {
                    settings: {
                        notifications: true,
                    },
                },
            };

            expect(() =>
                assert(user.profile.settings.notifications === true),
            ).not.toThrow();
            expect(() =>
                assert(user.profile.settings.notifications === false),
            ).toThrow();
        });

        test('should work in practical scenarios', () => {
            // Configuration validation
            const config = { apiUrl: 'https://api.example.com', timeout: 5000 };
            expect(() => {
                assert(
                    config.apiUrl.startsWith('https://'),
                    'API URL must use HTTPS',
                );
                assert(config.timeout > 0, 'Timeout must be positive');
            }).not.toThrow();

            // Array bounds checking
            const items = ['a', 'b', 'c'];
            const index = 1;
            expect(() => {
                assert(
                    index >= 0 && index < items.length,
                    `Index ${index} out of bounds`,
                );
            }).not.toThrow();

            // State validation
            const state = { isLoading: false, data: [1, 2, 3] };
            expect(() => {
                assert(!state.isLoading, 'Cannot access data while loading');
                assert(state.data.length > 0, 'Data should not be empty');
            }).not.toThrow();
        });
    });
});
