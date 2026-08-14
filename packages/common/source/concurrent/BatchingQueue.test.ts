// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BatchingQueue } from './BatchingQueue';

describe('BatchingQueue', () => {
    let onFlushSpy: jest.MockedFunction<(items: string[]) => void>;

    beforeEach(() => {
        jest.useFakeTimers();
        onFlushSpy = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create queue with specified parameters', () => {
            const queue = new BatchingQueue(1000, onFlushSpy, 10);
            expect(queue).toBeInstanceOf(BatchingQueue);
        });

        it('should create queue without maxBatchSize', () => {
            const queue = new BatchingQueue(1000, onFlushSpy);
            expect(queue).toBeInstanceOf(BatchingQueue);
        });
    });

    describe('push method', () => {
        it('should add item to queue', () => {
            const queue = new BatchingQueue(1000, onFlushSpy);

            queue.push('item1');

            expect(onFlushSpy).not.toHaveBeenCalled();
        });

        it('should flush when maxBatchSize is reached', () => {
            const queue = new BatchingQueue(1000, onFlushSpy, 2);

            queue.push('item1');
            expect(onFlushSpy).not.toHaveBeenCalled();

            queue.push('item2');
            expect(onFlushSpy).toHaveBeenCalledWith(['item1', 'item2']);
        });

        it('should reset timeout when new item is added', () => {
            const queue = new BatchingQueue(1000, onFlushSpy);

            queue.push('item1');
            jest.advanceTimersByTime(500);

            queue.push('item2');
            jest.advanceTimersByTime(500);

            // Should not flush yet as timeout was reset
            expect(onFlushSpy).not.toHaveBeenCalled();

            jest.advanceTimersByTime(500);
            expect(onFlushSpy).toHaveBeenCalledWith(['item1', 'item2']);
        });

        it('should not push items when canceled', () => {
            const queue = new BatchingQueue(1000, onFlushSpy);

            queue.cancel();
            queue.push('item1');

            jest.advanceTimersByTime(1000);
            expect(onFlushSpy).not.toHaveBeenCalled();
        });
    });

    describe('timeout flushing', () => {
        it('should flush after timeout duration', () => {
            const queue = new BatchingQueue(1000, onFlushSpy);

            queue.push('item1');
            expect(onFlushSpy).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1000);
            expect(onFlushSpy).toHaveBeenCalledWith(['item1']);
        });

        it('should flush multiple items after timeout', () => {
            const queue = new BatchingQueue(1000, onFlushSpy);

            queue.push('item1');
            queue.push('item2');
            queue.push('item3');

            jest.advanceTimersByTime(1000);
            expect(onFlushSpy).toHaveBeenCalledWith([
                'item1',
                'item2',
                'item3',
            ]);
        });

        it('should handle different timeout durations', () => {
            const queue = new BatchingQueue(500, onFlushSpy);

            queue.push('item1');

            jest.advanceTimersByTime(400);
            expect(onFlushSpy).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);
            expect(onFlushSpy).toHaveBeenCalledWith(['item1']);
        });
    });

    describe('flush method', () => {
        it('should flush items immediately', () => {
            const queue = new BatchingQueue(1000, onFlushSpy);

            queue.push('item1');
            queue.push('item2');
            queue.flush();

            expect(onFlushSpy).toHaveBeenCalledWith(['item1', 'item2']);
        });

        it('should clear timeout when flushing manually', () => {
            const queue = new BatchingQueue(1000, onFlushSpy);

            queue.push('item1');
            queue.flush();

            // Advance time to see if timeout still fires
            jest.advanceTimersByTime(1000);

            expect(onFlushSpy).toHaveBeenCalledTimes(1);
        });

        it('should not flush when queue is empty', () => {
            const queue = new BatchingQueue(1000, onFlushSpy);

            queue.flush();

            expect(onFlushSpy).not.toHaveBeenCalled();
        });

        it('should clear queue after flushing', () => {
            const queue = new BatchingQueue(1000, onFlushSpy);

            queue.push('item1');
            queue.flush();
            queue.flush(); // Second flush should do nothing

            expect(onFlushSpy).toHaveBeenCalledTimes(1);
            expect(onFlushSpy).toHaveBeenCalledWith(['item1']);
        });
    });

    describe('cancel method', () => {
        it('should cancel queue and clear items', () => {
            const queue = new BatchingQueue(1000, onFlushSpy);

            queue.push('item1');
            queue.push('item2');
            queue.cancel();

            jest.advanceTimersByTime(1000);
            expect(onFlushSpy).not.toHaveBeenCalled();
        });

        it('should clear timeout when canceling', () => {
            const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
            const queue = new BatchingQueue(1000, onFlushSpy);

            queue.push('item1');
            queue.cancel();

            expect(clearTimeoutSpy).toHaveBeenCalled();
        });

        it('should prevent new items from being added after cancel', () => {
            const queue = new BatchingQueue(1000, onFlushSpy);

            queue.cancel();
            queue.push('item1');

            jest.advanceTimersByTime(1000);
            expect(onFlushSpy).not.toHaveBeenCalled();
        });
    });

    describe('reset method', () => {
        it('should reset canceled state', () => {
            const queue = new BatchingQueue(1000, onFlushSpy);

            queue.cancel();
            queue.reset();
            queue.push('item1');

            jest.advanceTimersByTime(1000);
            expect(onFlushSpy).toHaveBeenCalledWith(['item1']);
        });
    });

    describe('complex scenarios', () => {
        it('should handle mixed push and flush operations', () => {
            const queue = new BatchingQueue(1000, onFlushSpy, 3);

            queue.push('item1');
            queue.push('item2');

            // Manual flush
            queue.flush();
            expect(onFlushSpy).toHaveBeenNthCalledWith(1, ['item1', 'item2']);

            // Add more items
            queue.push('item3');
            queue.push('item4');
            queue.push('item5'); // Should trigger maxBatchSize flush

            expect(onFlushSpy).toHaveBeenNthCalledWith(2, [
                'item3',
                'item4',
                'item5',
            ]);
            expect(onFlushSpy).toHaveBeenCalledTimes(2);
        });

        it('should handle rapid consecutive pushes under maxBatchSize', () => {
            const queue = new BatchingQueue(1000, onFlushSpy, 5);

            queue.push('item1');
            queue.push('item2');
            queue.push('item3');

            jest.advanceTimersByTime(1000);
            expect(onFlushSpy).toHaveBeenCalledWith([
                'item1',
                'item2',
                'item3',
            ]);
        });

        it('should handle timeout after maxBatchSize flush', () => {
            const queue = new BatchingQueue(1000, onFlushSpy, 2);

            // Trigger maxBatchSize flush
            queue.push('item1');
            queue.push('item2');
            expect(onFlushSpy).toHaveBeenCalledWith(['item1', 'item2']);

            // Add new item that should flush on timeout
            queue.push('item3');
            jest.advanceTimersByTime(1000);
            expect(onFlushSpy).toHaveBeenCalledWith(['item3']);

            expect(onFlushSpy).toHaveBeenCalledTimes(2);
        });

        it('should handle multiple timeout resets', () => {
            const queue = new BatchingQueue(1000, onFlushSpy);

            queue.push('item1');
            jest.advanceTimersByTime(500);

            queue.push('item2');
            jest.advanceTimersByTime(500);

            queue.push('item3');
            jest.advanceTimersByTime(500);

            // Should not have flushed yet
            expect(onFlushSpy).not.toHaveBeenCalled();

            jest.advanceTimersByTime(500);
            expect(onFlushSpy).toHaveBeenCalledWith([
                'item1',
                'item2',
                'item3',
            ]);
        });
    });

    describe('edge cases', () => {
        it('should handle zero timeout duration', () => {
            const queue = new BatchingQueue(0, onFlushSpy);

            queue.push('item1');
            jest.advanceTimersByTime(0);

            expect(onFlushSpy).toHaveBeenCalledWith(['item1']);
        });

        it('should handle maxBatchSize of 1', () => {
            const queue = new BatchingQueue(1000, onFlushSpy, 1);

            queue.push('item1');
            expect(onFlushSpy).toHaveBeenCalledWith(['item1']);

            queue.push('item2');
            expect(onFlushSpy).toHaveBeenCalledWith(['item2']);

            expect(onFlushSpy).toHaveBeenCalledTimes(2);
        });

        it('should handle onFlush callback throwing error', () => {
            const errorCallback = jest.fn().mockImplementation(() => {
                throw new Error('Flush error');
            });
            const queue = new BatchingQueue(1000, errorCallback);

            expect(() => {
                queue.push('item1');
                queue.flush();
            }).toThrow('Flush error');
        });

        it('should handle different data types', () => {
            const numberQueue = new BatchingQueue<number>(1000, jest.fn());
            const objectQueue = new BatchingQueue<{ id: number }>(
                1000,
                jest.fn(),
            );

            numberQueue.push(1);
            objectQueue.push({ id: 1 });

            // Should not throw errors
            expect(() => {
                numberQueue.flush();
                objectQueue.flush();
            }).not.toThrow();
        });
    });
});
