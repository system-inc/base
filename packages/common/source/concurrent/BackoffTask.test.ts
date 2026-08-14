// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Logger } from '../logging/Logger';
import { LogLevel } from '../logging/LogLevel';
import { BackoffTask } from './BackoffTask';

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
    value: {
        randomUUID: jest.fn(() => 'test-uuid-123'),
    },
});

describe('BackoffTask', () => {
    beforeEach(() => {
        jest.clearAllTimers();
        jest.useFakeTimers();
        jest.spyOn(global, 'setTimeout');
        jest.spyOn(global, 'clearTimeout');
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create task with default options', () => {
            const task = jest.fn();
            const backoffTask = new BackoffTask(task);

            expect(backoffTask.taskId).toBe('test-uuid-123');
        });

        it('should create task with custom options', () => {
            const task = jest.fn();
            const backoffTask = new BackoffTask(task, {
                taskId: 'custom-id',
                maxBackoff: 5000,
                maxAttempts: 5,
                initialBackoff: 500,
                logLevel: 'debug',
            });

            expect(backoffTask.taskId).toBe('custom-id');
        });
    });

    describe('static run method', () => {
        it('should create and run task successfully', async () => {
            const task = jest.fn().mockResolvedValue('success');

            const resultPromise = BackoffTask.run(task);
            await Promise.resolve(); // Allow task to start
            const result = await resultPromise;

            expect(result).toBe('success');
            expect(task).toHaveBeenCalledTimes(1);
        });
    });

    describe('run method', () => {
        it('should succeed on first attempt', async () => {
            const task = jest.fn().mockResolvedValue('success');
            const backoffTask = new BackoffTask(task);

            const resultPromise = backoffTask.run();
            await Promise.resolve(); // Allow task to start
            const result = await resultPromise;

            expect(result).toBe('success');
            expect(task).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure and eventually succeed', async () => {
            const task = jest
                .fn()
                .mockRejectedValueOnce(new Error('Attempt 1 failed'))
                .mockResolvedValue('success');

            const backoffTask = new BackoffTask(task, { initialBackoff: 100 });

            const resultPromise = backoffTask.run();

            // Wait for first attempt to fail
            await Promise.resolve();

            // Advance time for backoff delay
            jest.advanceTimersByTime(100);

            const result = await resultPromise;

            expect(result).toBe('success');
            expect(task).toHaveBeenCalledTimes(2);
        });

        it('should fail after max attempts', async () => {
            const error = new Error('Task failed');
            const task = jest.fn().mockRejectedValue(error);
            const backoffTask = new BackoffTask(task, {
                maxAttempts: 2,
                initialBackoff: 100,
            });

            const resultPromise = backoffTask.run();

            // Wait for first attempt to fail
            await Promise.resolve();

            // Advance time for backoff delay
            jest.advanceTimersByTime(100);

            await expect(resultPromise).rejects.toThrow('Task failed');
            expect(task).toHaveBeenCalledTimes(2);
        });

        it('should throw error if already running', async () => {
            const task = jest
                .fn()
                .mockImplementation(() => new Promise(() => {})); // Never resolves
            const backoffTask = new BackoffTask(task);

            // purposefully not awaiting to test concurrent run
            void backoffTask.run();

            await expect(backoffTask.run()).rejects.toThrow(
                'Task is already running',
            );
        });

        it('should calculate backoff correctly', async () => {
            const task = jest
                .fn()
                .mockRejectedValueOnce(new Error('Attempt 1 failed'))
                .mockRejectedValueOnce(new Error('Attempt 2 failed'))
                .mockResolvedValue('success');

            const backoffTask = new BackoffTask(task, {
                initialBackoff: 100,
                maxAttempts: 3,
            });

            const resultPromise = backoffTask.run();

            // Wait for first attempt to fail
            await Promise.resolve();

            // First backoff should be 100ms (1 * 100)
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 100);

            // Advance time for first backoff and allow second attempt
            jest.advanceTimersByTime(100);
            await Promise.resolve();
            await Promise.resolve(); // Allow second attempt to fail

            // Second backoff should be 200ms (2 * 100)
            expect(setTimeout).toHaveBeenLastCalledWith(
                expect.any(Function),
                200,
            );

            // Advance time for second backoff
            jest.advanceTimersByTime(200);

            const result = await resultPromise;
            expect(result).toBe('success');
        });

        it('should respect max backoff', async () => {
            const task = jest
                .fn()
                .mockRejectedValueOnce(new Error('Attempt 1 failed'))
                .mockResolvedValue('success');

            const backoffTask = new BackoffTask(task, {
                initialBackoff: 1000,
                maxBackoff: 500,
                maxAttempts: 2,
            });

            const resultPromise = backoffTask.run();

            await jest.runOnlyPendingTimersAsync();

            // Should be capped at maxBackoff of 500
            expect(setTimeout).toHaveBeenLastCalledWith(
                expect.any(Function),
                500,
            );
            await jest.runOnlyPendingTimersAsync();

            const result = await resultPromise;
            expect(result).toBe('success');
        });
    });

    describe('interrupt method', () => {
        it('should interrupt running task', async () => {
            const task = jest
                .fn()
                .mockRejectedValueOnce(new Error('Attempt 1 failed'))
                .mockImplementation(() => new Promise(() => {})); // Never resolves

            const backoffTask = new BackoffTask(task, {
                maxAttempts: 3,
                initialBackoff: 100,
            });

            const resultPromise = backoffTask.run();

            // Wait for first attempt to fail
            await Promise.resolve();

            // Interrupt during delay (before timer completes)
            backoffTask.interrupt();

            await expect(resultPromise).rejects.toThrow(
                'Task was interrupted: test-uuid-123',
            );
        });

        it('should clear timeout when interrupting', async () => {
            const task = jest.fn().mockRejectedValue(new Error('Failed'));
            const backoffTask = new BackoffTask(task, {
                maxAttempts: 2,
                initialBackoff: 100,
            });

            const resultPromise = backoffTask.run();

            // Wait for first attempt to fail and start backoff delay
            await Promise.resolve();

            // Verify setTimeout was called for the backoff
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 100);

            // Now interrupt while delay is active
            backoffTask.interrupt();

            // Verify clearTimeout was called (spy was set up in beforeEach)
            expect(global.clearTimeout).toHaveBeenCalled();

            await expect(resultPromise).rejects.toThrow('Task was interrupted');
        });
    });

    describe('resetAttempts method', () => {
        it('should reset attempt count', () => {
            const task = jest.fn();
            const backoffTask = new BackoffTask(task);

            // Access private field through any to test
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (backoffTask as any).attemptCount = 5;

            backoffTask.resetAttempts();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((backoffTask as any).attemptCount).toBe(0);
        });
    });

    describe('logging', () => {
        // The task-level logLevel option picks which events the task
        // reports; the global Logger threshold decides what prints. Open
        // the global gate so these tests observe the task-level gating.
        let consoleDebugSpy: jest.SpyInstance;
        let consoleErrorSpy: jest.SpyInstance;

        beforeEach(() => {
            Logger.setLevel(LogLevel.Debug);
            consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        });

        afterEach(() => {
            Logger.setLevel(LogLevel.Info);
        });

        it('should log errors by default', async () => {
            const error = new Error('Task failed');
            const task = jest.fn().mockRejectedValue(error);
            const backoffTask = new BackoffTask(task, { maxAttempts: 1 });

            const resultPromise = backoffTask.run();
            await Promise.resolve(); // Allow task to start

            await expect(resultPromise).rejects.toThrow();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[common] Task: %s:%d %s',
                'test-uuid-123',
                1,
                'Task failed: ',
                error,
            );
        });

        it('should log debug messages when logLevel is debug', async () => {
            const task = jest.fn().mockResolvedValue('success');
            const backoffTask = new BackoffTask(task, { logLevel: 'debug' });

            const resultPromise = backoffTask.run();
            await Promise.resolve(); // Allow task to start
            await resultPromise;

            expect(consoleDebugSpy).toHaveBeenCalledWith(
                '[common] Task: %s:%d %s',
                'test-uuid-123',
                1,
                'Running',
            );
            expect(consoleDebugSpy).toHaveBeenCalledWith(
                '[common] Task: %s:%d %s',
                'test-uuid-123',
                1,
                'Task completed',
            );
        });

        it('should not log debug messages when logLevel is error', async () => {
            const task = jest.fn().mockResolvedValue('success');
            const backoffTask = new BackoffTask(task, { logLevel: 'error' });

            const resultPromise = backoffTask.run();
            await Promise.resolve(); // Allow task to start
            await resultPromise;

            expect(consoleDebugSpy).not.toHaveBeenCalled();
        });

        it('should log waiting message in debug mode', async () => {
            const task = jest
                .fn()
                .mockRejectedValueOnce(new Error('Attempt 1 failed'))
                .mockResolvedValue('success');

            const backoffTask = new BackoffTask(task, {
                logLevel: 'debug',
                initialBackoff: 100,
                maxAttempts: 2,
            });

            const resultPromise = backoffTask.run();
            await jest.runOnlyPendingTimersAsync();

            expect(consoleDebugSpy).toHaveBeenCalledWith(
                '[common] Task: %s:%d %s',
                'test-uuid-123',
                1,
                'Waiting for 100ms before retrying',
            );

            await jest.runOnlyPendingTimersAsync();
            await resultPromise;
        });
    });

    describe('edge cases', () => {
        it('should handle task that throws synchronously', async () => {
            const task = jest.fn().mockImplementation(() => {
                throw new Error('Sync error');
            });
            const backoffTask = new BackoffTask(task, { maxAttempts: 1 });

            const resultPromise = backoffTask.run();
            await Promise.resolve(); // Allow task to start

            await expect(resultPromise).rejects.toThrow('Sync error');
        });

        it('should handle maxAttempts of 1', async () => {
            const task = jest.fn().mockRejectedValue(new Error('Failed'));
            const backoffTask = new BackoffTask(task, { maxAttempts: 1 });

            const resultPromise = backoffTask.run();
            await Promise.resolve(); // Allow task to start

            await expect(resultPromise).rejects.toThrow('Failed');
            expect(task).toHaveBeenCalledTimes(1);
        });

        it('should handle zero initial backoff', async () => {
            const task = jest
                .fn()
                .mockRejectedValueOnce(new Error('Failed'))
                .mockResolvedValue('success');

            const backoffTask = new BackoffTask(task, {
                initialBackoff: 0,
                maxAttempts: 2,
            });

            const resultPromise = backoffTask.run();

            // Wait for first attempt to fail
            await Promise.resolve();

            // Advance time for backoff delay (0ms)
            jest.advanceTimersByTime(0);

            const result = await resultPromise;

            expect(result).toBe('success');
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
        });
    });
});
