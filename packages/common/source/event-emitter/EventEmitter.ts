// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { LogCategory } from '../logging/LogCategory';
import { Logger } from '../logging/Logger';

/**
 * Type definition for event handlers mapped to event names.
 * This allows for different event types to have different handler signatures.
 */
export type EventMap = Record<string, any>;

/**
 * Generic type for an event handler based on the event name and event map.
 */
export type EventHandler<T extends EventMap, K extends keyof T> = (
    event: T[K],
) => Promise<void> | void;

// /**
//  * Interface for an event handler.
//  */
// export type GenericEventHandler = (...args: any[]) => Promise<void> | void;

/**
 * A generic event emitter class that provides type safety and autocompletion.
 *
 * @example
 * // Define your events
 * interface MyEvents {
 *   'data-loaded': { id: string; data: any };
 *   'error': Error;
 *   'progress': { percent: number };
 * }
 *
 * // Create a typed emitter
 * const emitter = new EventEmitter<MyEvents>();
 *
 * // Type-safe event handlers
 * emitter.on('data-loaded', ({ id, data }) => console.log(id, data));
 * emitter.on('error', (error) => console.error(error));
 * emitter.on('progress', ({ percent }) => console.log(`${percent}%`));
 *
 * // Type-safe event emission
 * emitter.emit('data-loaded', { id: '123', data: { name: 'Example' } });
 * emitter.emit('error', new Error('Something went wrong'));
 * emitter.emit('progress', { percent: 50 });
 */
export class EventEmitter<T extends EventMap = Record<string, any>> {
    private events = new Map<keyof T, Function[]>();

    /**
     * Add an event listener with proper typing based on the event name.
     *
     * @param event The event name
     * @param handler The event handler function
     * @returns this instance for chaining
     */
    on<K extends keyof T>(event: K, handler: EventHandler<T, K>): this {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        this.events.get(event)!.push(handler);
        return this;
    }

    /**
     * Remove an event listener.
     *
     * @param event The event name
     * @param handler The event handler to remove
     * @returns this instance for chaining
     */
    off<K extends keyof T>(event: K, handler: EventHandler<T, K>): this {
        const handlers = this.events.get(event);

        if (handlers) {
            const index = handlers.indexOf(handler as Function);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }

        return this;
    }

    /**
     * Emit an event to all registered listeners with proper typing.
     *
     * @param event The event name
     * @param args The event data
     * @returns true if handlers existed for this event, false otherwise
     */
    emit<K extends keyof T>(
        event: K,
        ...args: T[K] extends void ? [] : [T[K]]
    ): boolean {
        const handlers = this.events.get(event);

        if (!handlers || handlers.length === 0) {
            return false;
        }

        // Iterate a copy: a `once` handler calls off() (splice) on this same
        // array while we iterate, and splicing during a forEach would shift
        // later handlers into visited slots and skip them.
        [...handlers].forEach((handler) => {
            try {
                const result = handler(...args);
                if (result instanceof Promise) {
                    result.catch((err) =>
                        Logger.error(
                            LogCategory.Common,
                            'Error in async event handler for "%s":',
                            String(event),
                            err,
                        ),
                    );
                }
            } catch (err) {
                Logger.error(
                    LogCategory.Common,
                    'Error in event handler for "%s":',
                    String(event),
                    err,
                );
            }
        });

        return true;
    }

    /**
     * Add a one-time event listener that will be automatically removed after being called.
     *
     * @param event The event name
     * @param handler The event handler function
     * @returns this instance for chaining
     */
    once<K extends keyof T>(event: K, handler: EventHandler<T, K>): this {
        const onceHandler = (...args: any[]) => {
            this.off(event, onceHandler as any);
            return (handler as Function)(...args);
        };

        return this.on(event, onceHandler as any);
    }

    /**
     * Remove all listeners for a specific event or all events.
     *
     * @param event Optional event name - if provided, only listeners for this event are removed
     * @returns this instance for chaining
     */
    removeAllListeners(event?: keyof T): this {
        if (event) {
            // Remove all listeners for the specified event
            this.events.delete(event);
        } else {
            // Remove all listeners for all events
            this.events.clear();
        }

        return this;
    }
}
