// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { getBaseMetadata } from '../base/BaseMetadata';
import { BaseInjectionContainer } from '../dependency-injection/BaseInjectionContainer';
import { BaseInjections } from '../dependency-injection/BaseInjections';
import { LazyResolve } from '../dependency-injection/LazyResolve';
import { DeferredActions } from '../request/DeferredActions';
import { BaseEvent } from './BaseEvent';
import { BaseEventListener } from './BaseEventListener';

/**
 * The base event bus for Base applications.
 */
export class BaseEventBus {
    private listeners: Map<
        string,
        LazyResolve<BaseEventListener<BaseEvent>>[]
    > = new Map();

    constructor(
        listeners: ReadonlyArray<Constructor<BaseEventListener<BaseEvent>>>,
        readonly container: BaseInjectionContainer,
    ) {
        this.setupMetadata(listeners);
    }

    /**
     * Emits the given event immediately to all listeners.
     *
     * @param event
     */
    async publish<T extends BaseEvent>(event: T): Promise<void> {
        await this._publish(event);
    }

    /**
     * Emits the event as a deferredAction, meaning it will be
     * emitted after the current request is finished.
     *
     * @param event The event to emit.
     */
    defer<T extends BaseEvent>(event: T): void {
        const eventListeners = this.getEventListeners(event.name);
        if (eventListeners.length === 0) {
            return;
        }
        const deferred = this.container.resolve<DeferredActions>(
            BaseInjections.DeferredActions.toString(),
        );
        deferred.append(async () => {
            try {
                await this._publish(event, eventListeners);
            } catch (error) {
                // Deferred emission runs after the response is sent, so there
                // is no caller to receive the error — log and continue (each
                // listener failure is already logged in _publish). publish(),
                // which a caller awaits, propagates instead.
                Logger.error(
                    LogCategory.Event,
                    `Error while emitting deferred event ${event.name}`,
                    error,
                );
            }
        });
    }

    /**
     * Emits the given event immediately to all listeners.
     *
     * @param event
     */
    private async _publish<T extends BaseEvent>(
        event: T,
        listeners?: LazyResolve<BaseEventListener<BaseEvent>>[],
    ): Promise<void> {
        if (!listeners) {
            listeners = this.getEventListeners(event.name);
        }
        // Emit to every listener (a failing one must not skip the rest),
        // collecting failures — including LazyResolve DI failures — then
        // propagate so an awaited publish() reports the failure instead of a
        // false success. The deferred path (defer) catches this.
        const errors: unknown[] = [];
        for (const lazyResolve of listeners) {
            try {
                const listener = lazyResolve.get(this.container);
                await listener.onEvent(event);
            } catch (e) {
                Logger.error(
                    LogCategory.Event,
                    `Error while emitting event ${event.name} to listener ${lazyResolve}`,
                    e,
                );
                errors.push(e);
            }
        }
        if (errors.length === 1) {
            throw errors[0];
        }
        if (errors.length > 1) {
            throw new AggregateError(
                errors,
                `${errors.length} listeners failed for event ${event.name}`,
            );
        }
    }

    private getEventListeners(
        eventName: string,
    ): LazyResolve<BaseEventListener<BaseEvent>>[] {
        return this.listeners.get(eventName) || [];
    }

    private setupMetadata(
        listeners: ReadonlyArray<Constructor<BaseEventListener<BaseEvent>>>,
    ): void {
        const listenerBindings = getBaseMetadata()
            .eventBus.getListeners()
            .filter((binding) => listeners.includes(binding.listener));
        if (listenerBindings.length === 0) {
            return;
        }
        for (const binding of listenerBindings) {
            const lazyResolve = new LazyResolve<BaseEventListener<BaseEvent>>(
                binding.listener,
            );
            for (const event of binding.events) {
                let listeners = this.listeners.get(event);
                if (!listeners) {
                    listeners = [];
                    this.listeners.set(event, listeners);
                }
                listeners.push(lazyResolve);
            }
        }
    }
}
