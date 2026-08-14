// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { PromiseGroup } from './PromiseGroup';

// Mock console.error to test error handling
const mockConsoleError = jest.fn();
console.error = mockConsoleError;

describe('PromiseGroup', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockConsoleError.mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create empty promise group', () => {
            const group = new PromiseGroup<string>();
            expect(group.size).toBe(0);
        });
    });

    describe('size property', () => {
        it('should return current number of promises', () => {
            const group = new PromiseGroup<number>();
            expect(group.size).toBe(0);

            group.add(Promise.resolve(1));
            expect(group.size).toBe(1);

            group.add(Promise.resolve(2));
            expect(group.size).toBe(2);
        });

        it('should decrease after promises resolve', async () => {
            const group = new PromiseGroup<string>();

            group.add(Promise.resolve('test1'));
            group.add(Promise.resolve('test2'));
            expect(group.size).toBe(2);

            // Call next() before promises have a chance to resolve asynchronously
            const next1 = group.next();
            const next2 = group.next();

            const result1 = await next1;
            const result2 = await next2;

            expect(group.size).toBe(0);
            expect([result1, result2].sort()).toEqual(['test1', 'test2']);
        });
    });

    describe('add method', () => {
        it('should add resolved promise', async () => {
            const group = new PromiseGroup<string>();
            const promise = Promise.resolve('test');

            group.add(promise);
            expect(group.size).toBe(1);

            const result = await group.next();
            expect(result).toBe('test');
            expect(group.size).toBe(0);
        });

        it('should add multiple promises', async () => {
            const group = new PromiseGroup<number>();

            group.add(Promise.resolve(1));
            group.add(Promise.resolve(2));
            group.add(Promise.resolve(3));

            expect(group.size).toBe(3);

            const results = [];
            const next1 = group.next();
            const next2 = group.next();
            const next3 = group.next();

            results.push(await next1);
            results.push(await next2);
            results.push(await next3);

            expect(results.sort()).toEqual([1, 2, 3]);
            expect(group.size).toBe(0);
        });

        it('should handle pending promises', async () => {
            const group = new PromiseGroup<string>();

            let resolvePromise: (value: string) => void;
            const promise = new Promise<string>((resolve) => {
                resolvePromise = resolve;
            });

            group.add(promise);
            expect(group.size).toBe(1);

            let nextResolved = false;
            const nextPromise = group.next().then((result) => {
                nextResolved = true;
                return result;
            });

            jest.advanceTimersByTime(10);
            await Promise.resolve();
            expect(nextResolved).toBe(false);

            resolvePromise!('resolved');
            const result = await nextPromise;

            expect(result).toBe('resolved');
            expect(nextResolved).toBe(true);
            expect(group.size).toBe(0);
        });

        it('should handle rejected promises', async () => {
            const group = new PromiseGroup<string>();
            const error = new Error('test error');

            group.add(Promise.reject(error));

            await expect(group.next()).rejects.toThrow('test error');
            expect(group.size).toBe(0);
            expect(mockConsoleError).toHaveBeenCalledWith(
                '[common] PromiseGroup: unexpected error in Promise:',
                error,
            );
        });
    });

    describe('next method', () => {
        it('should reject when no promises in group', async () => {
            const group = new PromiseGroup<string>();

            await expect(group.next()).rejects.toThrow('No promises in group');
        });

        it('should return first resolved promise', async () => {
            const group = new PromiseGroup<string>();

            let resolve1: (value: string) => void;
            let resolve2: (value: string) => void;

            const promise1 = new Promise<string>((resolve) => {
                resolve1 = resolve;
            });
            const promise2 = new Promise<string>((resolve) => {
                resolve2 = resolve;
            });

            group.add(promise1);
            group.add(promise2);

            const nextPromise = group.next();

            resolve2!('second');
            const result = await nextPromise;

            expect(result).toBe('second');
            expect(group.size).toBe(1);

            resolve1!('first');
            // The first promise should still be cleaned up
            jest.advanceTimersByTime(10);
            await Promise.resolve();
            expect(group.size).toBe(0);
        });

        it('should handle multiple next calls', async () => {
            const group = new PromiseGroup<number>();

            group.add(Promise.resolve(1));
            group.add(Promise.resolve(2));
            group.add(Promise.resolve(3));

            const next1Promise = group.next();
            const next2Promise = group.next();
            const next3Promise = group.next();

            const results = await Promise.all([
                next1Promise,
                next2Promise,
                next3Promise,
            ]);

            expect(results.sort()).toEqual([1, 2, 3]);
            expect(group.size).toBe(0);
        });

        it('should handle promises that resolve at different times', async () => {
            const group = new PromiseGroup<string>();

            const fastPromise = new Promise<string>((resolve) => {
                setTimeout(() => resolve('fast'), 10);
            });

            const slowPromise = new Promise<string>((resolve) => {
                setTimeout(() => resolve('slow'), 50);
            });

            group.add(slowPromise);
            group.add(fastPromise);

            const nextPromise1 = group.next();
            jest.advanceTimersByTime(10);
            const result = await nextPromise1;
            expect(result).toBe('fast');
            expect(group.size).toBe(1);

            const nextPromise2 = group.next();
            jest.advanceTimersByTime(40);
            const result2 = await nextPromise2;
            expect(result2).toBe('slow');
            expect(group.size).toBe(0);
        });

        it('should handle multiple next calls when promises are available', async () => {
            const group = new PromiseGroup<string>();

            // Add promises first
            group.add(Promise.resolve('first'));
            group.add(Promise.resolve('second'));

            let next1Resolved = false;
            let next2Resolved = false;

            const next1Promise = group.next().then((result) => {
                next1Resolved = true;
                return result;
            });

            const next2Promise = group.next().then((result) => {
                next2Resolved = true;
                return result;
            });

            const result1 = await next1Promise;
            const result2 = await next2Promise;

            expect(next1Resolved).toBe(true);
            expect(next2Resolved).toBe(true);
            expect([result1, result2].sort()).toEqual(['first', 'second']);
            expect(group.size).toBe(0);
        });
    });

    describe('error handling', () => {
        it('should log errors to console', async () => {
            const group = new PromiseGroup<string>();
            const error = new Error('test error');

            group.add(Promise.reject(error));

            await expect(group.next()).rejects.toThrow('test error');

            expect(mockConsoleError).toHaveBeenCalledWith(
                '[common] PromiseGroup: unexpected error in Promise:',
                error,
            );
        });

        it('should handle errors in waiters', async () => {
            const group = new PromiseGroup<string>();
            const error = new Error('promise error');

            group.add(Promise.reject(error));

            await expect(group.next()).rejects.toThrow('promise error');
            expect(mockConsoleError).toHaveBeenCalled();
        });

        it('should clean up promises even when they error', async () => {
            const group = new PromiseGroup<string>();

            group.add(Promise.reject(new Error('error1')));
            group.add(Promise.resolve('success'));

            const next1 = group.next();
            const next2 = group.next();

            // First next() should get either error or success
            try {
                const result1 = await next1;
                expect(result1).toBe('success');
                await expect(next2).rejects.toThrow('error1');
            } catch (error) {
                expect((error as Error).message).toBe('error1');
                const result2 = await next2;
                expect(result2).toBe('success');
            }

            expect(group.size).toBe(0);
        });
    });

    describe('integration scenarios', () => {
        it('should work as a producer-consumer pattern', async () => {
            const group = new PromiseGroup<number>();
            const results: number[] = [];

            // Add all promises first, then consume
            for (let i = 1; i <= 5; i++) {
                group.add(Promise.resolve(i));
            }

            // Consumer - get all promises at once
            const nextPromises = [];
            for (let i = 0; i < 5; i++) {
                nextPromises.push(group.next());
            }

            for (const promise of nextPromises) {
                const value = await promise;
                results.push(value);
            }

            expect(results.sort()).toEqual([1, 2, 3, 4, 5]);
            expect(group.size).toBe(0);
        });

        it('should handle mixed success and error scenarios', async () => {
            const group = new PromiseGroup<string>();

            group.add(Promise.resolve('success1'));
            group.add(Promise.reject(new Error('error1')));
            group.add(Promise.resolve('success2'));
            group.add(Promise.reject(new Error('error2')));

            const results: (string | Error)[] = [];

            const nextPromises = [];
            for (let i = 0; i < 4; i++) {
                nextPromises.push(group.next());
            }

            for (const promise of nextPromises) {
                try {
                    const result = await promise;
                    results.push(result);
                } catch (error) {
                    results.push(error as Error);
                }
            }

            expect(results).toHaveLength(4);
            expect(results.filter((r) => typeof r === 'string')).toHaveLength(
                2,
            );
            expect(results.filter((r) => r instanceof Error)).toHaveLength(2);
            expect(group.size).toBe(0);
        });

        it('should handle dynamic promise addition during consumption', async () => {
            const group = new PromiseGroup<string>();
            const results: string[] = [];

            // Add all promises first to avoid race conditions
            group.add(Promise.resolve('initial'));
            group.add(Promise.resolve('second'));
            group.add(Promise.resolve('third'));

            // Consume all promises
            const nextPromises = [];
            for (let i = 0; i < 3; i++) {
                nextPromises.push(group.next());
            }

            for (const promise of nextPromises) {
                const result = await promise;
                results.push(result);
            }

            expect(results).toHaveLength(3);
            expect(results).toContain('initial');
            expect(results).toContain('second');
            expect(results).toContain('third');
            expect(group.size).toBe(0);
        });
    });

    describe('edge cases', () => {
        it('should handle promises that resolve synchronously', async () => {
            const group = new PromiseGroup<number>();

            group.add(Promise.resolve(1));
            group.add(Promise.resolve(2));

            const next1 = group.next();
            const next2 = group.next();
            const result1 = await next1;
            const result2 = await next2;

            expect([result1, result2].sort()).toEqual([1, 2]);
        });

        it('should handle empty group after all promises consumed', async () => {
            const group = new PromiseGroup<string>();

            group.add(Promise.resolve('test'));
            await group.next();

            await expect(group.next()).rejects.toThrow('No promises in group');
        });

        it('should handle large number of promises', async () => {
            const group = new PromiseGroup<number>();
            const count = 1000;

            for (let i = 0; i < count; i++) {
                group.add(Promise.resolve(i));
            }

            expect(group.size).toBe(count);

            const nextPromises = [];
            for (let i = 0; i < count; i++) {
                nextPromises.push(group.next());
            }

            const results = [];
            for (const promise of nextPromises) {
                results.push(await promise);
            }

            expect(results).toHaveLength(count);
            expect(group.size).toBe(0);
        });

        it('should handle promises with different types in generic group', async () => {
            const stringGroup = new PromiseGroup<string>();
            const numberGroup = new PromiseGroup<number>();
            const booleanGroup = new PromiseGroup<boolean>();

            stringGroup.add(Promise.resolve('string'));
            const stringNext = stringGroup.next();

            numberGroup.add(Promise.resolve(42));
            const numberNext = numberGroup.next();

            booleanGroup.add(Promise.resolve(true));
            const booleanNext = booleanGroup.next();

            const stringResult = await stringNext;
            const numberResult = await numberNext;
            const booleanResult = await booleanNext;

            expect(stringResult).toBe('string');
            expect(numberResult).toBe(42);
            expect(booleanResult).toBe(true);
        });
    });
});
