// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { PromiseBarrier } from './PromiseBarrier';

describe('PromiseBarrier', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create empty barrier', () => {
            const barrier = new PromiseBarrier();
            expect(barrier.size).toBe(0);
        });
    });

    describe('size property', () => {
        it('should return current number of promises', () => {
            const barrier = new PromiseBarrier();
            expect(barrier.size).toBe(0);

            barrier.add(Promise.resolve(1));
            expect(barrier.size).toBe(1);

            barrier.add(Promise.resolve(2));
            expect(barrier.size).toBe(2);
        });

        it('should decrease after promises settle', async () => {
            const barrier = new PromiseBarrier();

            barrier.add(Promise.resolve(1));
            barrier.add(Promise.resolve(2));
            expect(barrier.size).toBe(2);

            const timeoutPromise = new Promise((resolve) =>
                setTimeout(resolve, 10),
            );
            jest.advanceTimersByTime(10);
            await timeoutPromise;
            expect(barrier.size).toBe(0);
        });
    });

    describe('add method', () => {
        it('should add resolved promise', async () => {
            const barrier = new PromiseBarrier();
            const promise = Promise.resolve('test');

            barrier.add(promise);
            expect(barrier.size).toBe(1);

            const timeoutPromise = new Promise((resolve) =>
                setTimeout(resolve, 10),
            );
            jest.advanceTimersByTime(10);
            await timeoutPromise;
            expect(barrier.size).toBe(0);
        });

        it('should add rejected promise', async () => {
            const barrier = new PromiseBarrier();

            // Create a promise that's already rejected and catch it
            const promise = Promise.reject(new Error('test error')).catch(
                () => {},
            );

            barrier.add(promise);
            expect(barrier.size).toBe(1);

            // Wait for promise to settle
            await promise;
            expect(barrier.size).toBe(0);
        });

        it('should add pending promise', async () => {
            const barrier = new PromiseBarrier();
            let resolvePromise: (value: string) => void;
            const promise = new Promise<string>((resolve) => {
                resolvePromise = resolve;
            });

            barrier.add(promise);
            expect(barrier.size).toBe(1);

            const timeoutPromise1 = new Promise((resolve) =>
                setTimeout(resolve, 10),
            );
            jest.advanceTimersByTime(10);
            await timeoutPromise1;
            expect(barrier.size).toBe(1); // Still pending

            resolvePromise!('resolved');
            const timeoutPromise2 = new Promise((resolve) =>
                setTimeout(resolve, 10),
            );
            jest.advanceTimersByTime(10);
            await timeoutPromise2;
            expect(barrier.size).toBe(0);
        });

        it('should throw error when adding after wait has resolved', async () => {
            const barrier = new PromiseBarrier();

            barrier.add(Promise.resolve(1));
            await barrier.wait();

            expect(() => {
                barrier.add(Promise.resolve(2));
            }).toThrow('Cannot add promises after wait() has resolved');
        });

        it('should handle multiple promise types', async () => {
            const barrier = new PromiseBarrier();

            barrier.add(Promise.resolve('string'));
            barrier.add(Promise.resolve(42));
            barrier.add(Promise.resolve(true));
            barrier.add(Promise.resolve({ key: 'value' }));

            expect(barrier.size).toBe(4);

            const timeoutPromise = new Promise((resolve) =>
                setTimeout(resolve, 10),
            );
            jest.advanceTimersByTime(10);
            await timeoutPromise;
            expect(barrier.size).toBe(0);
        });
    });

    describe('wait method', () => {
        it('should resolve immediately when no promises added', async () => {
            const barrier = new PromiseBarrier();

            const startTime = Date.now();
            await barrier.wait();
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(10);
        });

        it('should resolve when all promises settle', async () => {
            const barrier = new PromiseBarrier();

            let resolve1: (value: string) => void;
            let resolve2: (value: number) => void;

            const promise1 = new Promise<string>((resolve) => {
                resolve1 = resolve;
            });
            const promise2 = new Promise<number>((resolve) => {
                resolve2 = resolve;
            });

            barrier.add(promise1);
            barrier.add(promise2);

            let waitResolved = false;
            const waitPromise = barrier.wait().then(() => {
                waitResolved = true;
            });

            const timeout1 = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout1;
            expect(waitResolved).toBe(false);

            resolve1!('test');
            const timeout2 = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout2;
            expect(waitResolved).toBe(false);

            resolve2!(42);
            await waitPromise;
            expect(waitResolved).toBe(true);
        });

        it('should resolve when promises reject', async () => {
            const barrier = new PromiseBarrier();

            let reject1: (reason: unknown) => void;
            let reject2: (reason: unknown) => void;

            const promise1 = new Promise<string>((resolve, reject) => {
                reject1 = reject;
            }).catch(() => {});
            const promise2 = new Promise<number>((resolve, reject) => {
                reject2 = reject;
            }).catch(() => {});

            barrier.add(promise1);
            barrier.add(promise2);

            let waitResolved = false;
            const waitPromise = barrier.wait().then(() => {
                waitResolved = true;
            });

            const timeout1 = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout1;
            expect(waitResolved).toBe(false);

            reject1!(new Error('error1'));
            const timeout2 = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout2;
            expect(waitResolved).toBe(false);

            reject2!(new Error('error2'));
            await waitPromise;
            expect(waitResolved).toBe(true);
        });

        it('should resolve with mixed resolved and rejected promises', async () => {
            const barrier = new PromiseBarrier();

            barrier.add(Promise.resolve('success'));
            barrier.add(Promise.reject(new Error('failure')).catch(() => {}));

            let waitResolved = false;
            await barrier.wait().then(() => {
                waitResolved = true;
            });

            expect(waitResolved).toBe(true);
        });

        it('should handle promises added after wait is called', async () => {
            const barrier = new PromiseBarrier();

            let resolve1: (value: string) => void;
            const promise1 = new Promise<string>((resolve) => {
                resolve1 = resolve;
            });

            barrier.add(promise1);

            let waitResolved = false;
            const waitPromise = barrier.wait().then(() => {
                waitResolved = true;
            });

            // Add another promise while waiting
            let resolve2: (value: number) => void;
            const promise2 = new Promise<number>((resolve) => {
                resolve2 = resolve;
            });
            barrier.add(promise2);

            resolve1!('test');
            const timeout3 = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout3;
            expect(waitResolved).toBe(false);

            resolve2!(42);
            await waitPromise;
            expect(waitResolved).toBe(true);
        });

        it('should be callable multiple times', async () => {
            const barrier = new PromiseBarrier();

            barrier.add(Promise.resolve(1));
            barrier.add(Promise.resolve(2));

            await barrier.wait();

            // Should resolve immediately on subsequent calls
            const startTime = Date.now();
            await barrier.wait();
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(10);
        });
    });

    describe('integration scenarios', () => {
        it('should coordinate multiple async operations', async () => {
            const barrier = new PromiseBarrier();
            const results: string[] = [];

            const operation1 = async () => {
                const timeout = new Promise((resolve) =>
                    setTimeout(resolve, 50),
                );
                jest.advanceTimersByTime(50);
                await timeout;
                results.push('op1');
            };

            const operation2 = async () => {
                const timeout = new Promise((resolve) =>
                    setTimeout(resolve, 30),
                );
                jest.advanceTimersByTime(30);
                await timeout;
                results.push('op2');
            };

            const operation3 = async () => {
                const timeout = new Promise((resolve) =>
                    setTimeout(resolve, 20),
                );
                jest.advanceTimersByTime(20);
                await timeout;
                results.push('op3');
            };

            barrier.add(operation1());
            barrier.add(operation2());
            barrier.add(operation3());

            await barrier.wait();

            expect(results).toHaveLength(3);
            expect(results).toContain('op1');
            expect(results).toContain('op2');
            expect(results).toContain('op3');
        });

        it('should handle dynamic promise addition', async () => {
            const barrier = new PromiseBarrier();
            const results: number[] = [];

            // Add initial promises
            barrier.add(
                Promise.resolve(1).then((val) => {
                    results.push(val);
                }),
            );
            barrier.add(
                Promise.resolve(2).then((val) => {
                    results.push(val);
                }),
            );

            // Add more promises synchronously to avoid race conditions
            barrier.add(
                Promise.resolve(3).then((val) => {
                    results.push(val);
                }),
            );
            barrier.add(
                Promise.resolve(4).then((val) => {
                    results.push(val);
                }),
            );

            await barrier.wait();

            expect(results).toHaveLength(4);
            expect(results).toContain(1);
            expect(results).toContain(2);
            expect(results).toContain(3);
            expect(results).toContain(4);
        });

        it('should work with different promise types and timings', async () => {
            const barrier = new PromiseBarrier();

            // Fast resolving promise
            barrier.add(Promise.resolve('fast'));

            // Slow resolving promise
            barrier.add(
                new Promise((resolve) => {
                    setTimeout(() => resolve('slow'), 50);
                }),
            );

            // Rejecting promise
            barrier.add(Promise.reject(new Error('rejected')).catch(() => {}));

            // Promise that resolves after rejection
            barrier.add(
                new Promise((resolve) => {
                    setTimeout(() => resolve('after-reject'), 25);
                }),
            );

            // Advance timers to resolve all promises
            jest.advanceTimersByTime(50);

            await barrier.wait();

            expect(barrier.size).toBe(0);
        });
    });

    describe('edge cases', () => {
        it('should handle empty barrier wait', async () => {
            const barrier = new PromiseBarrier();

            let resolved = false;
            await barrier.wait().then(() => {
                resolved = true;
            });

            expect(resolved).toBe(true);
        });

        it('should handle promises that resolve synchronously', async () => {
            const barrier = new PromiseBarrier();

            // Create promises that resolve synchronously
            const promise1 = Promise.resolve(1);
            const promise2 = Promise.resolve(2);

            barrier.add(promise1);
            barrier.add(promise2);

            await barrier.wait();

            expect(barrier.size).toBe(0);
        });

        it('should handle large number of promises', async () => {
            const barrier = new PromiseBarrier();

            // Add many promises
            for (let i = 0; i < 1000; i++) {
                barrier.add(Promise.resolve(i));
            }

            expect(barrier.size).toBe(1000);

            await barrier.wait();

            expect(barrier.size).toBe(0);
        });

        it('should handle promise addition race condition', async () => {
            const barrier = new PromiseBarrier();

            let resolve1: (value: string) => void;
            const promise1 = new Promise<string>((resolve) => {
                resolve1 = resolve;
            });

            barrier.add(promise1);

            const waitPromise = barrier.wait();

            // Resolve the promise and add a new one almost simultaneously
            resolve1!('test');

            try {
                barrier.add(Promise.resolve('new'));
            } catch (error) {
                // This might throw if the barrier settled between resolve and add
                expect((error as Error).message).toBe(
                    'Cannot add promises after wait() has resolved',
                );
            }

            await waitPromise;
        });

        it('should maintain settled state correctly', async () => {
            const barrier = new PromiseBarrier();

            barrier.add(Promise.resolve(1));
            await barrier.wait();

            // Barrier should be settled
            expect(() => {
                barrier.add(Promise.resolve(2));
            }).toThrow();

            // Multiple wait calls should still work
            await barrier.wait();
            await barrier.wait();
        });
    });
});
