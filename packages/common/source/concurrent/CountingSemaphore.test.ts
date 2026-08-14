// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { CountingSemaphore } from './CountingSemaphore';

describe('CountingSemaphore', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create semaphore with initial count', () => {
            const semaphore = new CountingSemaphore(3);
            expect(semaphore.getCount()).toBe(3);
        });

        it('should create semaphore with zero count', () => {
            const semaphore = new CountingSemaphore(0);
            expect(semaphore.getCount()).toBe(0);
        });
    });

    describe('getCount method', () => {
        it('should return current count', () => {
            const semaphore = new CountingSemaphore(5);
            expect(semaphore.getCount()).toBe(5);
        });

        it('should return updated count after acquire', async () => {
            const semaphore = new CountingSemaphore(3);

            await semaphore.acquire();
            expect(semaphore.getCount()).toBe(2);

            await semaphore.acquire();
            expect(semaphore.getCount()).toBe(1);
        });

        it('should return updated count after release', () => {
            const semaphore = new CountingSemaphore(2);

            semaphore.release();
            expect(semaphore.getCount()).toBe(3);
        });
    });

    describe('acquire method', () => {
        it('should acquire immediately when count is available', async () => {
            const semaphore = new CountingSemaphore(2);

            const startTime = Date.now();
            await semaphore.acquire();
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(10);
            expect(semaphore.getCount()).toBe(1);
        });

        it('should decrement count when acquiring', async () => {
            const semaphore = new CountingSemaphore(3);

            await semaphore.acquire();
            expect(semaphore.getCount()).toBe(2);

            await semaphore.acquire();
            expect(semaphore.getCount()).toBe(1);

            await semaphore.acquire();
            expect(semaphore.getCount()).toBe(0);
        });

        it('should block when no permits available', async () => {
            const semaphore = new CountingSemaphore(0);

            let acquired = false;
            const acquirePromise = semaphore.acquire().then(() => {
                acquired = true;
            });

            // Should not acquire immediately
            const timeout = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout;
            expect(acquired).toBe(false);

            // Release to unblock
            semaphore.release();
            await acquirePromise;
            expect(acquired).toBe(true);
        });

        it('should queue multiple waiters', async () => {
            const semaphore = new CountingSemaphore(0);

            let acquired1 = false;
            let acquired2 = false;
            let acquired3 = false;

            const acquire1 = semaphore.acquire().then(() => {
                acquired1 = true;
            });
            const acquire2 = semaphore.acquire().then(() => {
                acquired2 = true;
            });
            const acquire3 = semaphore.acquire().then(() => {
                acquired3 = true;
            });

            // None should acquire yet
            const timeout1 = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout1;
            expect(acquired1).toBe(false);
            expect(acquired2).toBe(false);
            expect(acquired3).toBe(false);

            // Release permits one by one
            semaphore.release();
            await Promise.resolve(); // Allow promise resolution to process
            await Promise.resolve(); // Extra tick for .then() callbacks
            expect(acquired1).toBe(true);
            expect(acquired2).toBe(false);
            expect(acquired3).toBe(false);

            semaphore.release();
            await Promise.resolve(); // Allow promise resolution to process
            await Promise.resolve(); // Extra tick for .then() callbacks
            expect(acquired2).toBe(true);
            expect(acquired3).toBe(false);

            semaphore.release();
            await Promise.all([acquire1, acquire2, acquire3]);
            expect(acquired3).toBe(true);
        });
    });

    describe('release method', () => {
        it('should increment count when no waiters', () => {
            const semaphore = new CountingSemaphore(2);

            semaphore.release();
            expect(semaphore.getCount()).toBe(3);

            semaphore.release();
            expect(semaphore.getCount()).toBe(4);
        });

        it('should unblock waiting tasks instead of incrementing count', async () => {
            const semaphore = new CountingSemaphore(0);

            let acquired = false;
            const acquirePromise = semaphore.acquire().then(() => {
                acquired = true;
            });

            expect(semaphore.getCount()).toBe(0);

            semaphore.release();
            await acquirePromise;

            expect(acquired).toBe(true);
            expect(semaphore.getCount()).toBe(0); // Should not increment, waiter took the permit
        });

        it('should handle multiple releases', async () => {
            const semaphore = new CountingSemaphore(0);

            let acquired1 = false;
            let acquired2 = false;

            const acquire1 = semaphore.acquire().then(() => {
                acquired1 = true;
            });
            const acquire2 = semaphore.acquire().then(() => {
                acquired2 = true;
            });

            semaphore.release();
            semaphore.release();

            await Promise.all([acquire1, acquire2]);

            expect(acquired1).toBe(true);
            expect(acquired2).toBe(true);
            expect(semaphore.getCount()).toBe(0);
        });

        it('should maintain FIFO order for waiters', async () => {
            const semaphore = new CountingSemaphore(0);
            const acquisitionOrder: number[] = [];

            const acquire1 = semaphore
                .acquire()
                .then(() => acquisitionOrder.push(1));
            const acquire2 = semaphore
                .acquire()
                .then(() => acquisitionOrder.push(2));
            const acquire3 = semaphore
                .acquire()
                .then(() => acquisitionOrder.push(3));

            // Release permits
            semaphore.release();
            const timeout1 = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout1;

            semaphore.release();
            const timeout2 = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout2;

            semaphore.release();
            await Promise.all([acquire1, acquire2, acquire3]);

            expect(acquisitionOrder).toEqual([1, 2, 3]);
        });
    });

    describe('integration scenarios', () => {
        it('should limit concurrent access', async () => {
            const semaphore = new CountingSemaphore(2);
            let currentlyRunning = 0;
            let maxConcurrent = 0;
            const results: number[] = [];

            const task = async (id: number) => {
                await semaphore.acquire();

                currentlyRunning++;
                maxConcurrent = Math.max(maxConcurrent, currentlyRunning);

                // Simulate work
                const timeout = new Promise((resolve) =>
                    setTimeout(resolve, 20),
                );
                jest.advanceTimersByTime(20);
                await timeout;

                results.push(id);
                currentlyRunning--;

                semaphore.release();
            };

            // Start 5 concurrent tasks
            const tasks = Array.from({ length: 5 }, (_, i) => task(i));
            await Promise.all(tasks);

            expect(maxConcurrent).toBeLessThanOrEqual(2);
            expect(results).toHaveLength(5);
            expect(semaphore.getCount()).toBe(2); // Should return to original count
        });

        it('should handle mixed acquire and release operations', async () => {
            const semaphore = new CountingSemaphore(1);

            // Initial acquire
            await semaphore.acquire();
            expect(semaphore.getCount()).toBe(0);

            // Try to acquire while count is 0
            let blocked = true;
            const acquirePromise = semaphore.acquire().then(() => {
                blocked = false;
            });

            const timeout = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout;
            expect(blocked).toBe(true);

            // Release to unblock
            semaphore.release();
            await acquirePromise;
            expect(blocked).toBe(false);
            expect(semaphore.getCount()).toBe(0);

            // Final release
            semaphore.release();
            expect(semaphore.getCount()).toBe(1);
        });

        it('should work as a binary semaphore', async () => {
            const semaphore = new CountingSemaphore(1);
            let criticalSectionActive = false;
            let violations = 0;

            const criticalSection = async (_id: number) => {
                await semaphore.acquire();

                if (criticalSectionActive) {
                    violations++;
                }

                criticalSectionActive = true;
                const timeout = new Promise((resolve) =>
                    setTimeout(resolve, 10),
                );
                jest.advanceTimersByTime(10);
                await timeout;
                criticalSectionActive = false;

                semaphore.release();
            };

            const tasks = Array.from({ length: 10 }, (_, i) =>
                criticalSection(i),
            );
            await Promise.all(tasks);

            expect(violations).toBe(0);
            expect(semaphore.getCount()).toBe(1);
        });
    });

    describe('edge cases', () => {
        it('should handle large initial counts', async () => {
            const semaphore = new CountingSemaphore(1000);

            for (let i = 0; i < 100; i++) {
                await semaphore.acquire();
            }

            expect(semaphore.getCount()).toBe(900);
        });

        it('should handle zero initial count', async () => {
            const semaphore = new CountingSemaphore(0);

            let acquired = false;
            const acquirePromise = semaphore.acquire().then(() => {
                acquired = true;
            });

            const timeout1 = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout1;
            expect(acquired).toBe(false);

            semaphore.release();
            await acquirePromise;
            expect(acquired).toBe(true);
        });

        it('should handle rapid acquire/release cycles', async () => {
            const semaphore = new CountingSemaphore(5);

            const tasks = Array.from({ length: 100 }, async () => {
                await semaphore.acquire();
                // Immediate release
                semaphore.release();
            });

            await Promise.all(tasks);
            expect(semaphore.getCount()).toBe(5);
        });

        it('should handle release without prior acquire', () => {
            const semaphore = new CountingSemaphore(2);

            semaphore.release();
            expect(semaphore.getCount()).toBe(3);

            semaphore.release();
            expect(semaphore.getCount()).toBe(4);
        });

        it('should handle negative initial count gracefully', async () => {
            const semaphore = new CountingSemaphore(-1);

            let acquired = false;
            const acquirePromise = semaphore.acquire().then(() => {
                acquired = true;
            });

            const timeout1 = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout1;
            expect(acquired).toBe(false);

            // First release brings count to 0, still not enough
            semaphore.release();
            const timeout2 = new Promise((resolve) => setTimeout(resolve, 10));
            jest.advanceTimersByTime(10);
            await timeout2;
            expect(acquired).toBe(false);

            // Second release brings count to 1, now acquisition can proceed
            semaphore.release();
            await acquirePromise;
            expect(acquired).toBe(true);
        });
    });

    describe('queue management', () => {
        it('should properly manage internal queue', async () => {
            const semaphore = new CountingSemaphore(0);

            // Add multiple waiters
            const waiters = Array.from({ length: 5 }, () =>
                semaphore.acquire(),
            );

            // Release them one by one and verify order
            for (let i = 0; i < 5; i++) {
                semaphore.release();
                const timeout = new Promise((resolve) =>
                    setTimeout(resolve, 10),
                );
                jest.advanceTimersByTime(10);
                await timeout;
            }

            await Promise.all(waiters);
            expect(semaphore.getCount()).toBe(0);
        });

        it('should handle undefined callback gracefully', () => {
            const semaphore = new CountingSemaphore(0);

            // This tests the optional chaining in release method
            expect(() => {
                semaphore.release();
            }).not.toThrow();

            expect(semaphore.getCount()).toBe(1);
        });
    });
});
