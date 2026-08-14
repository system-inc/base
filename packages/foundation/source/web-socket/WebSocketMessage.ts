// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 *
 */
export interface WebSocketEvent {
    /**
     * The type of the event. This determines how the event should be handled.
     */
    readonly type: string;

    /**
     * The origin of the event.
     *
     * This is the worker that the event originated from.
     */
    readonly origin: string;

    /**
     * The arguments that were passed as part of the event.
     * These will be passed to the event handler.
     */
    readonly arguments?: any[];
}

export namespace WebSocketEvent {
    export function isWebSocketEvent(event: any): event is WebSocketEvent {
        return (
            event && typeof event === 'object' && typeof event.type === 'string'
        );
    }

    export function isWebSocketErrorEvent(
        event: WebSocketEvent,
    ): event is WebSocketErrorEvent {
        return event.type === 'error';
    }

    export function isWebSocketForwardingEvent(
        event: WebSocketEvent,
    ): event is WebSocketForwardingEvent {
        return event.type === 'forwarding';
    }
}

export interface WebSocketForwardingEvent extends WebSocketEvent {
    /**
     * Designates this event as a forwarding event.
     */
    readonly type: 'forwarding';

    /**
     * The event that is being forwarded.
     */
    readonly originatingType: string;

    /**
     * The target of the event.
     *
     * This is the worker that the event is being forwarded to.
     */
    readonly target: string;

    /**
     * The rpc endpoint on the target.
     */
    readonly rpcEndpoint?: string;
}

/**
 *
 */
export interface WebSocketErrorEvent extends WebSocketEvent {
    /**
     * Designates this event as an error event.
     */
    readonly type: 'error';

    /**
     * The error that occurred.
     */
    readonly errorType: string;

    /**
     * The error message.
     */
    readonly message?: string;

    /**
     * The web socket event that was being handled when the error occurred.
     */
    readonly originatingType?: string;
}
