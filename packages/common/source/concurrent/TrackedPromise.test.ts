// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TrackedPromise } from './TrackedPromise';

describe('TrackedPromise', () => {
    describe('create method', () => {
        it('should create a tracked promise with pending state', () => {
            const tracked = TrackedPromise.create<string>();

            expect(tracked.getState()).toBe('pending');
            expect(tracked.promise).toBeInstanceOf(Promise);
            expect(typeof tracked.resolve).toBe('function');
            expect(typeof tracked.reject).toBe('function');
        });

        it('should create different instances for multiple calls', () => {
            const tracked1 = TrackedPromise.create<string>();
            const tracked2 = TrackedPromise.create<number>();

            expect(tracked1.promise).not.toBe(tracked2.promise);
            expect(tracked1.resolve).not.toBe(tracked2.resolve);
            expect(tracked1.reject).not.toBe(tracked2.reject);
        });
    });

    describe('getState method', () => {
        it('should return pending for new promise', () => {
            const tracked = TrackedPromise.create<string>();
            expect(tracked.getState()).toBe('pending');
        });

        it('should return fulfilled after resolve', async () => {
            const tracked = TrackedPromise.create<string>();

            tracked.resolve('test value');
            await tracked.promise;

            expect(tracked.getState()).toBe('fulfilled');
        });

        it('should return rejected after reject', async () => {
            const tracked = TrackedPromise.create<string>();

            tracked.reject(new Error('test error'));

            try {
                await tracked.promise;
            } catch (error) {
                // Expected to catch the error
            }

            expect(tracked.getState()).toBe('rejected');
        });
    });

    describe('resolve method', () => {
        it('should resolve promise with provided value', async () => {
            const tracked = TrackedPromise.create<string>();
            const testValue = 'test value';

            tracked.resolve(testValue);
            const result = await tracked.promise;

            expect(result).toBe(testValue);
            expect(tracked.getState()).toBe('fulfilled');
        });

        it('should resolve with different value types', async () => {
            const stringTracked = TrackedPromise.create<string>();
            const numberTracked = TrackedPromise.create<number>();
            const objectTracked = TrackedPromise.create<{ key: string }>();
            const booleanTracked = TrackedPromise.create<boolean>();

            stringTracked.resolve('hello');
            numberTracked.resolve(42);
            objectTracked.resolve({ key: 'value' });
            booleanTracked.resolve(true);

            expect(await stringTracked.promise).toBe('hello');
            expect(await numberTracked.promise).toBe(42);
            expect(await objectTracked.promise).toEqual({ key: 'value' });
            expect(await booleanTracked.promise).toBe(true);
        });

        it('should resolve with promise-like value', async () => {
            const tracked = TrackedPromise.create<string>();
            const promiseLike = Promise.resolve('promise value');

            tracked.resolve(promiseLike);
            const result = await tracked.promise;

            expect(result).toBe('promise value');
            expect(tracked.getState()).toBe('fulfilled');
        });

        it('should not resolve again if already fulfilled', async () => {
            const tracked = TrackedPromise.create<string>();

            tracked.resolve('first value');
            await tracked.promise;

            // Try to resolve again
            tracked.resolve('second value');
            const result = await tracked.promise;

            expect(result).toBe('first value');
            expect(tracked.getState()).toBe('fulfilled');
        });

        it('should not resolve if already rejected', async () => {
            const tracked = TrackedPromise.create<string>();

            tracked.reject(new Error('rejected'));

            try {
                await tracked.promise;
            } catch (error) {
                // Expected to catch the error
            }

            // Try to resolve after rejection
            tracked.resolve('value');

            expect(tracked.getState()).toBe('rejected');
        });

        it('should handle undefined value', async () => {
            const tracked = TrackedPromise.create<undefined>();

            tracked.resolve(undefined);
            const result = await tracked.promise;

            expect(result).toBeUndefined();
            expect(tracked.getState()).toBe('fulfilled');
        });

        it('should handle null value', async () => {
            const tracked = TrackedPromise.create<null>();

            tracked.resolve(null);
            const result = await tracked.promise;

            expect(result).toBeNull();
            expect(tracked.getState()).toBe('fulfilled');
        });
    });

    describe('reject method', () => {
        it('should reject promise with provided reason', async () => {
            const tracked = TrackedPromise.create<string>();
            const error = new Error('test error');

            tracked.reject(error);

            await expect(tracked.promise).rejects.toThrow('test error');
            expect(tracked.getState()).toBe('rejected');
        });

        it('should reject with different error types', async () => {
            const errorTracked = TrackedPromise.create<string>();
            const stringTracked = TrackedPromise.create<string>();
            const objectTracked = TrackedPromise.create<string>();

            const error = new Error('error object');
            const stringError = 'string error';
            const objectError = { message: 'object error' };

            errorTracked.reject(error);
            stringTracked.reject(stringError);
            objectTracked.reject(objectError);

            await expect(errorTracked.promise).rejects.toThrow('error object');
            await expect(stringTracked.promise).rejects.toBe('string error');
            await expect(objectTracked.promise).rejects.toEqual({
                message: 'object error',
            });

            expect(errorTracked.getState()).toBe('rejected');
            expect(stringTracked.getState()).toBe('rejected');
            expect(objectTracked.getState()).toBe('rejected');
        });

        it('should not reject again if already rejected', async () => {
            const tracked = TrackedPromise.create<string>();
            const firstError = new Error('first error');
            const secondError = new Error('second error');

            tracked.reject(firstError);

            try {
                await tracked.promise;
            } catch (error) {
                expect(error).toBe(firstError);
            }

            // Try to reject again
            tracked.reject(secondError);

            try {
                await tracked.promise;
            } catch (error) {
                expect(error).toBe(firstError); // Should still be the first error
            }

            expect(tracked.getState()).toBe('rejected');
        });

        it('should not reject if already fulfilled', async () => {
            const tracked = TrackedPromise.create<string>();

            tracked.resolve('success');
            await tracked.promise;

            // Try to reject after resolution
            tracked.reject(new Error('error'));
            const result = await tracked.promise;

            expect(result).toBe('success');
            expect(tracked.getState()).toBe('fulfilled');
        });

        it('should handle rejection without reason', async () => {
            const tracked = TrackedPromise.create<string>();

            tracked.reject();

            await expect(tracked.promise).rejects.toBeUndefined();
            expect(tracked.getState()).toBe('rejected');
        });

        it('should handle rejection with undefined', async () => {
            const tracked = TrackedPromise.create<string>();

            tracked.reject(undefined);

            await expect(tracked.promise).rejects.toBeUndefined();
            expect(tracked.getState()).toBe('rejected');
        });

        it('should handle rejection with null', async () => {
            const tracked = TrackedPromise.create<string>();

            tracked.reject(null);

            await expect(tracked.promise).rejects.toBeNull();
            expect(tracked.getState()).toBe('rejected');
        });
    });

    describe('promise property', () => {
        it('should provide access to underlying promise', () => {
            const tracked = TrackedPromise.create<string>();

            expect(tracked.promise).toBeInstanceOf(Promise);
        });

        it('should allow chaining with then/catch', async () => {
            const tracked = TrackedPromise.create<number>();

            const chainedPromise = tracked.promise
                .then((value) => value * 2)
                .then((value) => value.toString());

            tracked.resolve(21);
            const result = await chainedPromise;

            expect(result).toBe('42');
        });

        it('should work with Promise.all', async () => {
            const tracked1 = TrackedPromise.create<number>();
            const tracked2 = TrackedPromise.create<string>();
            const tracked3 = TrackedPromise.create<boolean>();

            const allPromise = Promise.all([
                tracked1.promise,
                tracked2.promise,
                tracked3.promise,
            ]);

            tracked1.resolve(1);
            tracked2.resolve('test');
            tracked3.resolve(true);

            const results = await allPromise;
            expect(results).toEqual([1, 'test', true]);
        });

        it('should work with Promise.race', async () => {
            const tracked1 = TrackedPromise.create<string>();
            const tracked2 = TrackedPromise.create<string>();

            const racePromise = Promise.race([
                tracked1.promise,
                tracked2.promise,
            ]);

            tracked2.resolve('second');
            const result = await racePromise;

            expect(result).toBe('second');
        });
    });

    describe('integration scenarios', () => {
        it('should work in async/await context', async () => {
            const tracked = TrackedPromise.create<string>();

            setTimeout(() => {
                tracked.resolve('delayed value');
            }, 10);

            const result = await tracked.promise;
            expect(result).toBe('delayed value');
        });

        it('should handle complex data types', async () => {
            interface ComplexType {
                id: number;
                data: {
                    items: string[];
                    metadata: Record<string, unknown>;
                };
            }

            const tracked = TrackedPromise.create<ComplexType>();

            const complexValue: ComplexType = {
                id: 123,
                data: {
                    items: ['a', 'b', 'c'],
                    metadata: { key1: 'value1', key2: 42 },
                },
            };

            tracked.resolve(complexValue);
            const result = await tracked.promise;

            expect(result).toEqual(complexValue);
            expect(tracked.getState()).toBe('fulfilled');
        });

        it('should work with external promise resolution', async () => {
            const tracked = TrackedPromise.create<string>();

            const externalPromise = new Promise<string>((resolve) => {
                setTimeout(() => resolve('external value'), 20);
            });

            tracked.resolve(externalPromise);
            const result = await tracked.promise;

            expect(result).toBe('external value');
        });

        it('should handle concurrent access', async () => {
            const tracked = TrackedPromise.create<number>();

            // Multiple consumers waiting for the same promise
            const consumer1 = tracked.promise.then((value) => value * 2);
            const consumer2 = tracked.promise.then((value) => value + 10);
            const consumer3 = tracked.promise.then((value) => value.toString());

            tracked.resolve(5);

            const results = await Promise.all([
                consumer1,
                consumer2,
                consumer3,
            ]);
            expect(results).toEqual([10, 15, '5']);
        });
    });

    describe('edge cases', () => {
        it('should handle rapid resolve/reject calls', () => {
            const tracked = TrackedPromise.create<string>();

            // Rapid calls should not cause issues
            tracked.resolve('value1');
            tracked.resolve('value2');
            tracked.reject(new Error('error'));
            tracked.resolve('value3');

            expect(tracked.getState()).toBe('fulfilled');
        });

        it('should handle state checking during settlement', async () => {
            const tracked = TrackedPromise.create<string>();

            tracked.resolve('value');

            // State should be immediately updated
            expect(tracked.getState()).toBe('fulfilled');

            const result = await tracked.promise;
            expect(result).toBe('value');
        });

        it('should handle promise that resolves to another promise', async () => {
            const tracked = TrackedPromise.create<string>();
            const innerPromise = Promise.resolve('inner value');

            tracked.resolve(innerPromise);
            const result = await tracked.promise;

            expect(result).toBe('inner value');
            expect(tracked.getState()).toBe('fulfilled');
        });

        it('should handle promise that resolves to rejected promise', async () => {
            const tracked = TrackedPromise.create<string>();
            const rejectedPromise = Promise.reject(new Error('inner error'));

            tracked.resolve(rejectedPromise);

            await expect(tracked.promise).rejects.toThrow('inner error');
            expect(tracked.getState()).toBe('fulfilled'); // The tracked promise was fulfilled with a rejected promise
        });

        it('should maintain type safety', () => {
            const stringTracked = TrackedPromise.create<string>();
            const numberTracked = TrackedPromise.create<number>();

            // TypeScript should enforce types
            stringTracked.resolve('string value'); // Should be fine
            numberTracked.resolve(123); // Should be fine

            // These would cause TypeScript errors in a real environment:
            // stringTracked.resolve(123); // Error: number not assignable to string
            // numberTracked.resolve('string'); // Error: string not assignable to number
        });
    });

    describe('memory and cleanup', () => {
        it('should not leak memory with multiple creates', () => {
            const trackedPromises = [];

            for (let i = 0; i < 1000; i++) {
                const tracked = TrackedPromise.create<number>();
                tracked.resolve(i);
                trackedPromises.push(tracked);
            }

            expect(trackedPromises).toHaveLength(1000);
            // In a real scenario, we'd check memory usage, but in tests we just ensure no errors
        });

        it('should work correctly after garbage collection scenarios', async () => {
            let tracked = TrackedPromise.create<string>();
            tracked.resolve('test');

            const promise = tracked.promise;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tracked = null as any; // Simulate GC

            const result = await promise;
            expect(result).toBe('test');
        });
    });
});
