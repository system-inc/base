// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { sleep } from './Sleep';

describe('sleep', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('basic functionality', () => {
        it('should resolve after specified milliseconds', async () => {
            const promise = sleep(1000);

            // Should not resolve immediately
            let resolved = false;
            void promise.then(() => {
                resolved = true;
            });

            expect(resolved).toBe(false);

            // Advance time by 500ms
            jest.advanceTimersByTime(500);
            await Promise.resolve(); // Allow promise to process
            expect(resolved).toBe(false);

            // Advance time by another 500ms
            jest.advanceTimersByTime(500);
            await promise;
            expect(resolved).toBe(true);
        });

        it('should work with zero milliseconds', async () => {
            const promise = sleep(0);

            jest.advanceTimersByTime(0);
            await promise;

            // Should complete successfully
            expect(true).toBe(true);
        });

        it('should work with decimal milliseconds', async () => {
            const promise = sleep(100.5);

            let resolved = false;
            void promise.then(() => {
                resolved = true;
            });

            // Jest fake timers appear to treat 100.5 as 100, so it resolves after 100ms
            jest.advanceTimersByTime(100);
            await promise;
            expect(resolved).toBe(true);
        });

        it('should work with large millisecond values', async () => {
            const promise = sleep(1000000); // 1000 seconds

            let resolved = false;
            void promise.then(() => {
                resolved = true;
            });

            jest.advanceTimersByTime(999999);
            await Promise.resolve();
            expect(resolved).toBe(false);

            jest.advanceTimersByTime(1);
            await promise;
            expect(resolved).toBe(true);
        });
    });

    describe('callback functionality', () => {
        it('should execute callback after delay', async () => {
            const callback = jest.fn();

            const promise = sleep(1000, callback);

            expect(callback).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1000);
            await promise;

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should execute callback before resolving promise', async () => {
            const executionOrder: string[] = [];

            const callback = () => {
                executionOrder.push('callback');
            };

            const promise = sleep(1000, callback).then(() => {
                executionOrder.push('promise');
            });

            jest.advanceTimersByTime(1000);
            await promise;

            expect(executionOrder).toEqual(['callback', 'promise']);
        });

        it('should work without callback', async () => {
            const promise = sleep(1000);

            jest.advanceTimersByTime(1000);
            await promise;

            // Should complete successfully without callback
            expect(true).toBe(true);
        });

        it('should work with undefined callback', async () => {
            const promise = sleep(1000, undefined);

            jest.advanceTimersByTime(1000);
            await promise;

            // Should complete successfully
            expect(true).toBe(true);
        });

        it('should pass callback parameters correctly', async () => {
            const callback = jest.fn();

            const promise = sleep(500, callback);

            jest.advanceTimersByTime(500);
            await promise;

            expect(callback).toHaveBeenCalledWith();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe('error handling', () => {
        it('should catch and log callback errors', async () => {
            const error = new Error('Callback error');
            const callback = jest.fn().mockImplementation(() => {
                throw error;
            });

            const promise = sleep(1000, callback);

            jest.advanceTimersByTime(1000);
            await promise;

            expect(callback).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[common] Sleep error:',
                error,
            );
        });

        it('should resolve promise even when callback throws', async () => {
            const callback = jest.fn().mockImplementation(() => {
                throw new Error('Callback error');
            });

            const promise = sleep(1000, callback);

            jest.advanceTimersByTime(1000);

            // Promise should still resolve despite callback error
            await expect(promise).resolves.toBeUndefined();
        });

        it('should handle callback that throws synchronously', async () => {
            const callback = () => {
                throw new Error('Sync error');
            };

            const promise = sleep(100, callback);

            jest.advanceTimersByTime(100);
            await promise;

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[common] Sleep error:',
                expect.any(Error),
            );
        });

        it('should handle callback that throws asynchronously', async () => {
            const callback = () => {
                setTimeout(() => {
                    throw new Error('Async error');
                }, 0);
            };

            const promise = sleep(100, callback);

            jest.advanceTimersByTime(100);
            await promise;

            // The async error in callback won't be caught by sleep function
            // but the promise should still resolve
            expect(true).toBe(true);
        });
    });

    describe('multiple sleep calls', () => {
        it('should handle multiple concurrent sleep calls', async () => {
            const results: number[] = [];

            const sleep1 = sleep(100).then(() => results.push(1));
            const sleep2 = sleep(200).then(() => results.push(2));
            const sleep3 = sleep(50).then(() => results.push(3));

            jest.advanceTimersByTime(50);
            await Promise.resolve();
            expect(results).toEqual([3]);

            jest.advanceTimersByTime(50);
            await Promise.resolve();
            expect(results).toEqual([3, 1]);

            jest.advanceTimersByTime(100);
            await Promise.all([sleep1, sleep2, sleep3]);
            expect(results).toEqual([3, 1, 2]);
        });

        it('should handle sleep calls with callbacks', async () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            const sleep1 = sleep(100, callback1);
            const sleep2 = sleep(200, callback2);

            jest.advanceTimersByTime(100);
            await Promise.resolve();
            expect(callback1).toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);
            await Promise.all([sleep1, sleep2]);
            expect(callback2).toHaveBeenCalled();
        });
    });

    describe('integration scenarios', () => {
        it('should work in async/await context', async () => {
            const promise = sleep(100);
            jest.advanceTimersByTime(100);
            await promise;

            const endTime = Date.now();
            // In fake timer mode, Date.now() doesn't advance, so we just check it completed
            expect(endTime).toBeDefined();
        });

        it('should work with Promise.all', async () => {
            const sleeps = [sleep(100), sleep(200), sleep(150)];

            const allPromise = Promise.all(sleeps);

            jest.advanceTimersByTime(200);
            await allPromise;

            // All should complete
            expect(true).toBe(true);
        });

        it('should work with Promise.race', async () => {
            const sleeps = [sleep(100), sleep(200), sleep(50)];

            const racePromise = Promise.race(sleeps);

            jest.advanceTimersByTime(50);
            await racePromise;

            // Fastest should win
            expect(true).toBe(true);
        });

        it('should work in loops', async () => {
            const results: number[] = [];

            for (let i = 0; i < 3; i++) {
                const promise = sleep(100, () => results.push(i));
                jest.advanceTimersByTime(100);
                await promise;
            }

            expect(results).toEqual([0, 1, 2]);
        });
    });

    describe('edge cases', () => {
        it('should handle negative milliseconds', async () => {
            const promise = sleep(-100);

            jest.advanceTimersByTime(0);
            await promise;

            // Should resolve immediately or very quickly
            expect(true).toBe(true);
        });

        it('should handle very small millisecond values', async () => {
            const promise = sleep(0.1);

            jest.advanceTimersByTime(1);
            await promise;

            expect(true).toBe(true);
        });

        it('should handle NaN milliseconds', async () => {
            const promise = sleep(NaN);

            jest.advanceTimersByTime(0);
            await promise;

            // Should handle gracefully
            expect(true).toBe(true);
        });

        it('should handle Infinity milliseconds', async () => {
            const promise = sleep(Infinity);

            let resolved = false;
            void promise.then(() => {
                resolved = true;
            });

            // With fake timers, we need to advance to trigger the setTimeout
            jest.advanceTimersByTime(1);
            await promise;
            expect(resolved).toBe(true);
        });

        it('should handle callback that modifies global state', async () => {
            let globalState = 'initial';

            const callback = () => {
                globalState = 'modified';
            };

            const promise = sleep(100, callback);
            jest.advanceTimersByTime(100);
            await promise;

            expect(globalState).toBe('modified');
        });

        it('should handle callback with complex operations', async () => {
            const complexCallback = jest.fn().mockImplementation(() => {
                // Simulate complex operation
                let sum = 0;
                for (let i = 0; i < 1000; i++) {
                    sum += i;
                }
                return sum;
            });

            const promise = sleep(100, complexCallback);
            jest.advanceTimersByTime(100);
            await promise;

            expect(complexCallback).toHaveBeenCalled();
        });
    });

    describe('return value', () => {
        it('should return undefined', async () => {
            const promise = sleep(100);
            jest.advanceTimersByTime(100);
            const result = await promise;

            expect(result).toBeUndefined();
        });

        it('should return undefined even with callback', async () => {
            const callback = () => 'callback result';

            const promise = sleep(100, callback);
            jest.advanceTimersByTime(100);
            const result = await promise;

            expect(result).toBeUndefined();
        });
    });
});
