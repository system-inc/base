// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { CountdownLatch } from './CountDownLatch';

describe('CountdownLatch', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create latch with initial count', () => {
            const latch = new CountdownLatch(3);
            expect(latch.getCount()).toBe(3);
        });

        it('should create latch with zero count', () => {
            const latch = new CountdownLatch(0);
            expect(latch.getCount()).toBe(0);
        });
    });

    describe('getCount method', () => {
        it('should return current count', () => {
            const latch = new CountdownLatch(5);
            expect(latch.getCount()).toBe(5);
        });

        it('should return updated count after countdown', () => {
            const latch = new CountdownLatch(3);

            latch.countDown();
            expect(latch.getCount()).toBe(2);

            latch.countDown();
            expect(latch.getCount()).toBe(1);
        });
    });

    describe('countDown method', () => {
        it('should decrement count', () => {
            const latch = new CountdownLatch(3);

            latch.countDown();
            expect(latch.getCount()).toBe(2);

            latch.countDown();
            expect(latch.getCount()).toBe(1);

            latch.countDown();
            expect(latch.getCount()).toBe(0);
        });

        it('should allow count to go below zero', () => {
            const latch = new CountdownLatch(1);

            latch.countDown();
            expect(latch.getCount()).toBe(0);

            latch.countDown();
            expect(latch.getCount()).toBe(-1);
        });
    });

    describe('wait method', () => {
        it('resolves immediately for a zero initial count', async () => {
            const latch = new CountdownLatch(0);
            // A latch of 0 is already satisfied — waiting for zero operations
            // completes at once, rather than hanging forever (would time out).
            await expect(latch.wait()).resolves.toBeUndefined();
        });

        it('should resolve when count reaches zero', async () => {
            const latch = new CountdownLatch(2);

            let resolved = false;
            const waitPromise = latch.wait().then(() => {
                resolved = true;
            });

            // Should not resolve yet
            const timeout1 = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout1;
            expect(resolved).toBe(false);

            latch.countDown();
            const timeout2 = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout2;
            expect(resolved).toBe(false);

            latch.countDown(); // Count reaches zero
            await waitPromise;
            expect(resolved).toBe(true);
        });

        it('should resolve multiple waiters when count reaches zero', async () => {
            const latch = new CountdownLatch(1);

            let resolved1 = false;
            let resolved2 = false;
            let resolved3 = false;

            const waitPromise1 = latch.wait().then(() => {
                resolved1 = true;
            });
            const waitPromise2 = latch.wait().then(() => {
                resolved2 = true;
            });
            const waitPromise3 = latch.wait().then(() => {
                resolved3 = true;
            });

            // None should resolve yet
            const timeout = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout;
            expect(resolved1).toBe(false);
            expect(resolved2).toBe(false);
            expect(resolved3).toBe(false);

            latch.countDown();

            await Promise.all([waitPromise1, waitPromise2, waitPromise3]);

            expect(resolved1).toBe(true);
            expect(resolved2).toBe(true);
            expect(resolved3).toBe(true);
        });

        it('should resolve new waiters immediately after count reaches zero', async () => {
            const latch = new CountdownLatch(1);

            latch.countDown(); // Count reaches zero

            let resolved = false;
            await latch.wait().then(() => {
                resolved = true;
            });

            expect(resolved).toBe(true);
        });
    });

    describe('integration scenarios', () => {
        it('should coordinate multiple async operations', async () => {
            const latch = new CountdownLatch(3);
            const results: string[] = [];

            // Simulate three async operations
            const operation1 = async () => {
                const timeout = new Promise((resolve) =>
                    setTimeout(resolve, 50),
                );
                jest.advanceTimersByTime(50);
                await timeout;
                results.push('op1');
                latch.countDown();
            };

            const operation2 = async () => {
                const timeout = new Promise((resolve) =>
                    setTimeout(resolve, 30),
                );
                jest.advanceTimersByTime(30);
                await timeout;
                results.push('op2');
                latch.countDown();
            };

            const operation3 = async () => {
                const timeout = new Promise((resolve) =>
                    setTimeout(resolve, 20),
                );
                jest.advanceTimersByTime(20);
                await timeout;
                results.push('op3');
                latch.countDown();
            };

            // Start all operations
            const ops = [operation1(), operation2(), operation3()];

            // Wait for all to complete
            await latch.wait();

            // Ensure all operations completed
            await Promise.all(ops);

            expect(results).toHaveLength(3);
            expect(results).toContain('op1');
            expect(results).toContain('op2');
            expect(results).toContain('op3');
            expect(latch.getCount()).toBe(0);
        });

        it('should handle rapid countdown calls', async () => {
            const latch = new CountdownLatch(100);

            let resolved = false;
            const waitPromise = latch.wait().then(() => {
                resolved = true;
            });

            // Rapidly countdown
            for (let i = 0; i < 100; i++) {
                latch.countDown();
            }

            await waitPromise;
            expect(resolved).toBe(true);
            expect(latch.getCount()).toBe(0);
        });

        it('should work with concurrent wait and countdown operations', async () => {
            const latch = new CountdownLatch(5);
            const waitResults: boolean[] = [];

            // Start multiple waiters
            const waiters = Array.from({ length: 3 }, (_, i) =>
                latch.wait().then(() => {
                    waitResults[i] = true;
                }),
            );

            // Countdown in a separate async context
            const countdown = async () => {
                for (let i = 0; i < 5; i++) {
                    const timeout = new Promise((resolve) =>
                        setTimeout(resolve, 10),
                    );
                    jest.advanceTimersByTime(10);
                    await timeout;
                    latch.countDown();
                }
            };

            await Promise.all([...waiters, countdown()]);

            expect(waitResults).toEqual([true, true, true]);
            expect(latch.getCount()).toBe(0);
        });
    });

    describe('edge cases', () => {
        it('should handle large initial counts', () => {
            const latch = new CountdownLatch(1000000);
            expect(latch.getCount()).toBe(1000000);

            for (let i = 0; i < 1000000; i++) {
                latch.countDown();
            }

            expect(latch.getCount()).toBe(0);
        });

        it('should handle negative initial count', () => {
            const latch = new CountdownLatch(-5);
            expect(latch.getCount()).toBe(-5);

            latch.countDown();
            expect(latch.getCount()).toBe(-6);
        });

        it('resolves immediately for a negative initial count', async () => {
            const latch = new CountdownLatch(-1);
            // Already-satisfied (count <= 0) resolves at once rather than
            // hanging. countDown still decrements the raw count as before.
            await expect(latch.wait()).resolves.toBeUndefined();

            latch.countDown();
            expect(latch.getCount()).toBe(-2);
        });

        it('should maintain state after resolution', async () => {
            const latch = new CountdownLatch(1);

            // Countdown first, then wait
            latch.countDown();
            await latch.wait();

            expect(latch.getCount()).toBe(0);

            // Additional countdown after resolution
            latch.countDown();
            expect(latch.getCount()).toBe(-1);

            // New waiters should still resolve immediately
            let newWaiterResolved = false;
            await latch.wait().then(() => {
                newWaiterResolved = true;
            });
            expect(newWaiterResolved).toBe(true);
        });
    });

    describe('promise behavior', () => {
        it('should return different promise instances for wait calls (async function behavior)', async () => {
            const latch = new CountdownLatch(1);

            const promise1 = latch.wait();
            const promise2 = latch.wait();

            // Since wait() is an async function, each call returns a new promise
            expect(promise1).not.toBe(promise2);

            // But both should resolve when latch counts down
            latch.countDown();
            await Promise.all([promise1, promise2]);
        });

        it('should create new promise after latch is resolved and new instance created', async () => {
            const latch1 = new CountdownLatch(1);
            const promise1 = latch1.wait();

            latch1.countDown();
            await promise1;

            const latch2 = new CountdownLatch(1);
            const promise2 = latch2.wait();

            expect(promise1).not.toBe(promise2);
        });
    });
});
