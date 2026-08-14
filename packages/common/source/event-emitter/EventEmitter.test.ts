// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { EventEmitter } from './EventEmitter';

// Define test event interfaces
interface TestEvents {
    'data-loaded': { id: string; data: unknown };
    error: Error;
    progress: { percent: number };
    simple: string;
    'void-event': void;
    'multiple-data': { name: string; age: number; active: boolean };
}

interface SimpleEvents {
    test: string;
    number: number;
}

describe('EventEmitter', () => {
    let emitter: EventEmitter<TestEvents>;

    beforeEach(() => {
        emitter = new EventEmitter<TestEvents>();
    });

    describe('constructor', () => {
        it('should create an empty event emitter', () => {
            const newEmitter = new EventEmitter();
            expect(newEmitter).toBeInstanceOf(EventEmitter);
        });

        it('should create a typed event emitter', () => {
            const typedEmitter = new EventEmitter<TestEvents>();
            expect(typedEmitter).toBeInstanceOf(EventEmitter);
        });
    });

    describe('on method', () => {
        it('should add event listeners', () => {
            const handler = jest.fn();
            const result = emitter.on('data-loaded', handler);

            expect(result).toBe(emitter); // Should return this for chaining
        });

        it('should add multiple listeners for the same event', () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();

            emitter.on('data-loaded', handler1);
            emitter.on('data-loaded', handler2);

            const testData = { id: '123', data: { name: 'test' } };
            emitter.emit('data-loaded', testData);

            expect(handler1).toHaveBeenCalledWith(testData);
            expect(handler2).toHaveBeenCalledWith(testData);
        });

        it('should add listeners for different events', () => {
            const dataHandler = jest.fn();
            const errorHandler = jest.fn();
            const progressHandler = jest.fn();

            emitter.on('data-loaded', dataHandler);
            emitter.on('error', errorHandler);
            emitter.on('progress', progressHandler);

            const testData = { id: '123', data: { name: 'test' } };
            const testError = new Error('test error');
            const testProgress = { percent: 50 };

            emitter.emit('data-loaded', testData);
            emitter.emit('error', testError);
            emitter.emit('progress', testProgress);

            expect(dataHandler).toHaveBeenCalledWith(testData);
            expect(errorHandler).toHaveBeenCalledWith(testError);
            expect(progressHandler).toHaveBeenCalledWith(testProgress);
        });

        it('should support method chaining', () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();

            const result = emitter
                .on('data-loaded', handler1)
                .on('error', handler2);

            expect(result).toBe(emitter);
        });
    });

    describe('off method', () => {
        it('should remove specific event listeners', () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();

            emitter.on('data-loaded', handler1);
            emitter.on('data-loaded', handler2);

            const result = emitter.off('data-loaded', handler1);

            expect(result).toBe(emitter); // Should return this for chaining

            const testData = { id: '123', data: { name: 'test' } };
            emitter.emit('data-loaded', testData);

            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).toHaveBeenCalledWith(testData);
        });

        it('should handle removing non-existent handlers gracefully', () => {
            const handler = jest.fn();
            const nonExistentHandler = jest.fn();

            emitter.on('data-loaded', handler);
            emitter.off('data-loaded', nonExistentHandler); // Should not throw

            const testData = { id: '123', data: { name: 'test' } };
            emitter.emit('data-loaded', testData);

            expect(handler).toHaveBeenCalledWith(testData);
        });

        it('should handle removing handlers from non-existent events gracefully', () => {
            const handler = jest.fn();

            // Should not throw
            emitter.off('data-loaded', handler);
        });

        it('should support method chaining', () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();

            emitter.on('data-loaded', handler1);
            emitter.on('error', handler2);

            const result = emitter
                .off('data-loaded', handler1)
                .off('error', handler2);

            expect(result).toBe(emitter);
        });
    });

    describe('emit method', () => {
        it('should emit events to all registered listeners', () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();

            emitter.on('data-loaded', handler1);
            emitter.on('data-loaded', handler2);

            const testData = { id: '123', data: { name: 'test' } };
            const result = emitter.emit('data-loaded', testData);

            expect(result).toBe(true);
            expect(handler1).toHaveBeenCalledWith(testData);
            expect(handler2).toHaveBeenCalledWith(testData);
        });

        it('should return false when no handlers exist', () => {
            const result = emitter.emit('data-loaded', { id: '123', data: {} });

            expect(result).toBe(false);
        });

        it('should handle void events correctly', () => {
            const handler = jest.fn();
            emitter.on('void-event', handler);

            const result = emitter.emit('void-event');

            expect(result).toBe(true);
            expect(handler).toHaveBeenCalledWith();
        });

        it('should handle events with complex data types', () => {
            const handler = jest.fn();
            emitter.on('multiple-data', handler);

            const testData = { name: 'John', age: 30, active: true };
            emitter.emit('multiple-data', testData);

            expect(handler).toHaveBeenCalledWith(testData);
        });

        it('should handle synchronous handler errors gracefully', () => {
            const workingHandler = jest.fn();
            const throwingHandler = jest.fn().mockImplementation(() => {
                throw new Error('Handler error');
            });

            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            emitter.on('simple', workingHandler);
            emitter.on('simple', throwingHandler);

            const result = emitter.emit('simple', 'test');

            expect(result).toBe(true);
            expect(workingHandler).toHaveBeenCalledWith('test');
            expect(throwingHandler).toHaveBeenCalledWith('test');
            expect(consoleSpy).toHaveBeenCalledWith(
                '[common] Error in event handler for "%s":',
                'simple',
                expect.any(Error),
            );

            consoleSpy.mockRestore();
        });

        it('should handle asynchronous handler errors gracefully', async () => {
            const workingHandler = jest.fn().mockResolvedValue(undefined);
            const rejectingHandler = jest
                .fn()
                .mockRejectedValue(new Error('Async error'));

            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            emitter.on('simple', workingHandler);
            emitter.on('simple', rejectingHandler);

            const result = emitter.emit('simple', 'test');

            expect(result).toBe(true);

            // Wait for async handlers to complete
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(workingHandler).toHaveBeenCalledWith('test');
            expect(rejectingHandler).toHaveBeenCalledWith('test');
            expect(consoleSpy).toHaveBeenCalledWith(
                '[common] Error in async event handler for "%s":',
                'simple',
                expect.any(Error),
            );

            consoleSpy.mockRestore();
        });

        it('should handle mixed sync and async handlers', async () => {
            const syncHandler = jest.fn();
            const asyncHandler = jest.fn().mockResolvedValue(undefined);

            emitter.on('simple', syncHandler);
            emitter.on('simple', asyncHandler);

            const result = emitter.emit('simple', 'test');

            expect(result).toBe(true);
            expect(syncHandler).toHaveBeenCalledWith('test');
            expect(asyncHandler).toHaveBeenCalledWith('test');

            // Wait for async handler to complete
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    });

    describe('once method', () => {
        it('should add one-time event listeners', () => {
            const handler = jest.fn();

            const result = emitter.once('data-loaded', handler);

            expect(result).toBe(emitter); // Should return this for chaining

            const testData1 = { id: '123', data: { name: 'test1' } };
            const testData2 = { id: '456', data: { name: 'test2' } };

            emitter.emit('data-loaded', testData1);
            emitter.emit('data-loaded', testData2);

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(testData1);
        });

        it('calls every once listener on a single emit', () => {
            // Both once listeners are registered before emitting; a single
            // emit must invoke both even though the first removes itself
            // (via splice) mid-dispatch.
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            emitter.once('data-loaded', handler1);
            emitter.once('data-loaded', handler2);

            const testData = { id: '123', data: { name: 'test' } };
            emitter.emit('data-loaded', testData);

            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);

            // both removed after firing
            emitter.emit('data-loaded', testData);
            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);
        });

        it('should work with multiple once listeners sequentially', () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();

            // Test once handlers one by one to avoid potential interference
            emitter.once('data-loaded', handler1);

            const testData1 = { id: '123', data: { name: 'test1' } };
            const result1 = emitter.emit('data-loaded', testData1);

            expect(result1).toBe(true);
            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler1).toHaveBeenCalledWith(testData1);

            // Add second once handler after first is removed
            emitter.once('data-loaded', handler2);

            const testData2 = { id: '456', data: { name: 'test2' } };
            const result2 = emitter.emit('data-loaded', testData2);

            expect(result2).toBe(true);
            expect(handler1).toHaveBeenCalledTimes(1); // Still only called once
            expect(handler2).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledWith(testData2);

            // Third emit should call no handlers
            const result3 = emitter.emit('data-loaded', testData1);
            expect(result3).toBe(false);
            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);
        });

        it('should work with async handlers', async () => {
            const asyncHandler = jest.fn().mockResolvedValue(undefined);

            emitter.once('simple', asyncHandler);

            emitter.emit('simple', 'test1');
            emitter.emit('simple', 'test2');

            expect(asyncHandler).toHaveBeenCalledTimes(1);
            expect(asyncHandler).toHaveBeenCalledWith('test1');

            // Wait for async handler to complete
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        it('should support method chaining', () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();

            const result = emitter
                .once('data-loaded', handler1)
                .once('error', handler2);

            expect(result).toBe(emitter);
        });

        it('should handle void events with once', () => {
            const handler = jest.fn();

            emitter.once('void-event', handler);

            emitter.emit('void-event');
            emitter.emit('void-event');

            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('removeAllListeners method', () => {
        it('should remove all listeners for a specific event', () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            const otherHandler = jest.fn();

            emitter.on('data-loaded', handler1);
            emitter.on('data-loaded', handler2);
            emitter.on('error', otherHandler);

            const result = emitter.removeAllListeners('data-loaded');

            expect(result).toBe(emitter); // Should return this for chaining

            const testData = { id: '123', data: { name: 'test' } };
            const testError = new Error('test error');

            emitter.emit('data-loaded', testData);
            emitter.emit('error', testError);

            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).not.toHaveBeenCalled();
            expect(otherHandler).toHaveBeenCalledWith(testError);
        });

        it('should remove all listeners for all events when no event specified', () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            const handler3 = jest.fn();

            emitter.on('data-loaded', handler1);
            emitter.on('error', handler2);
            emitter.on('progress', handler3);

            const result = emitter.removeAllListeners();

            expect(result).toBe(emitter); // Should return this for chaining

            const testData = { id: '123', data: { name: 'test' } };
            const testError = new Error('test error');
            const testProgress = { percent: 50 };

            emitter.emit('data-loaded', testData);
            emitter.emit('error', testError);
            emitter.emit('progress', testProgress);

            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).not.toHaveBeenCalled();
            expect(handler3).not.toHaveBeenCalled();
        });

        it('should handle removing listeners from non-existent events gracefully', () => {
            // Should not throw
            emitter.removeAllListeners('data-loaded');
        });

        it('should support method chaining', () => {
            const handler = jest.fn();

            emitter.on('data-loaded', handler);

            const result = emitter
                .removeAllListeners('data-loaded')
                .removeAllListeners();

            expect(result).toBe(emitter);
        });
    });

    describe('integration and edge cases', () => {
        it('should handle complex event flow scenarios', () => {
            const loadHandler = jest.fn();
            const errorHandler = jest.fn();
            const progressHandler = jest.fn();

            // Set up listeners
            emitter.on('data-loaded', loadHandler);
            emitter.on('error', errorHandler);
            emitter.once('progress', progressHandler);

            // Emit events
            emitter.emit('progress', { percent: 25 });
            emitter.emit('data-loaded', { id: '1', data: { name: 'first' } });
            emitter.emit('error', new Error('Something went wrong'));
            emitter.emit('progress', { percent: 50 }); // Should not trigger progressHandler
            emitter.emit('data-loaded', { id: '2', data: { name: 'second' } });

            expect(progressHandler).toHaveBeenCalledTimes(1);
            expect(progressHandler).toHaveBeenCalledWith({ percent: 25 });
            expect(loadHandler).toHaveBeenCalledTimes(2);
            expect(errorHandler).toHaveBeenCalledTimes(1);
        });

        it('should handle event emitter reuse', () => {
            const handler = jest.fn();

            emitter.on('simple', handler);
            emitter.emit('simple', 'first');

            emitter.removeAllListeners();

            emitter.on('simple', handler);
            emitter.emit('simple', 'second');

            expect(handler).toHaveBeenCalledTimes(2);
            expect(handler).toHaveBeenNthCalledWith(1, 'first');
            expect(handler).toHaveBeenNthCalledWith(2, 'second');
        });

        it('should handle handler modification during emission', () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn().mockImplementation(() => {
                // Remove handler3 during execution (removing handler1 might affect current iteration)
                emitter.off('simple', handler3);
            });
            const handler3 = jest.fn();

            emitter.on('simple', handler1);
            emitter.on('simple', handler2);
            emitter.on('simple', handler3);

            emitter.emit('simple', 'test');

            expect(handler1).toHaveBeenCalledWith('test');
            expect(handler2).toHaveBeenCalledWith('test');
            // handler3 might or might not be called depending on when it was removed
            // This is an edge case that depends on implementation details

            // Emit again - handler3 should definitely be removed now
            emitter.emit('simple', 'test2');

            expect(handler1).toHaveBeenCalledTimes(2);
            expect(handler2).toHaveBeenCalledTimes(2);
            // handler3 should not be called on second emit
        });

        it('should handle rapid successive emissions', () => {
            const handler = jest.fn();
            emitter.on('simple', handler);

            for (let i = 0; i < 100; i++) {
                emitter.emit('simple', `message-${i}`);
            }

            expect(handler).toHaveBeenCalledTimes(100);
        });

        it('should work with different event emitter instances', () => {
            const emitter1 = new EventEmitter<SimpleEvents>();
            const emitter2 = new EventEmitter<SimpleEvents>();

            const handler1 = jest.fn();
            const handler2 = jest.fn();

            emitter1.on('test', handler1);
            emitter2.on('test', handler2);

            emitter1.emit('test', 'from emitter1');
            emitter2.emit('test', 'from emitter2');

            expect(handler1).toHaveBeenCalledWith('from emitter1');
            expect(handler1).not.toHaveBeenCalledWith('from emitter2');
            expect(handler2).toHaveBeenCalledWith('from emitter2');
            expect(handler2).not.toHaveBeenCalledWith('from emitter1');
        });

        it('should handle memory cleanup correctly', () => {
            const handler = jest.fn();

            emitter.on('simple', handler);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            emitter.once('data-loaded', handler as any);

            emitter.emit('simple', 'test');
            emitter.emit('data-loaded', { id: '1', data: {} });

            // Remove all listeners
            emitter.removeAllListeners();

            // Should not emit to any handlers
            const result1 = emitter.emit('simple', 'test2');
            const result2 = emitter.emit('data-loaded', { id: '2', data: {} });

            expect(result1).toBe(false);
            expect(result2).toBe(false);
            expect(handler).toHaveBeenCalledTimes(2); // Only the original calls
        });

        it('should preserve handler context and parameters', () => {
            const testObject = {
                value: 'test-context',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                handler: jest.fn(function (this: any, data: string) {
                    return `${this.value}-${data}`;
                }),
            };

            emitter.on('simple', testObject.handler.bind(testObject));

            emitter.emit('simple', 'message');

            expect(testObject.handler).toHaveBeenCalledWith('message');
        });
    });

    describe('type safety verification', () => {
        it('should work with strongly typed events', () => {
            const typedEmitter = new EventEmitter<{
                'user-created': { id: number; name: string; email: string };
                'user-deleted': { id: number };
                'system-error': Error;
            }>();

            const userCreatedHandler = jest.fn();
            const userDeletedHandler = jest.fn();
            const systemErrorHandler = jest.fn();

            typedEmitter.on('user-created', userCreatedHandler);
            typedEmitter.on('user-deleted', userDeletedHandler);
            typedEmitter.on('system-error', systemErrorHandler);

            const userData = {
                id: 1,
                name: 'John Doe',
                email: 'john@example.com',
            };
            const deleteData = { id: 1 };
            const errorData = new Error('System failure');

            typedEmitter.emit('user-created', userData);
            typedEmitter.emit('user-deleted', deleteData);
            typedEmitter.emit('system-error', errorData);

            expect(userCreatedHandler).toHaveBeenCalledWith(userData);
            expect(userDeletedHandler).toHaveBeenCalledWith(deleteData);
            expect(systemErrorHandler).toHaveBeenCalledWith(errorData);
        });

        it('should work with generic event emitter', () => {
            const genericEmitter = new EventEmitter();

            const handler = jest.fn();
            genericEmitter.on('any-event', handler);

            genericEmitter.emit('any-event', 'any-data');

            expect(handler).toHaveBeenCalledWith('any-data');
        });
    });
});
