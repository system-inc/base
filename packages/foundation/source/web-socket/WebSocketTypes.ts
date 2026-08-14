// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Json, JsonObject } from '@system-inc/base-common/json/Json';
import { RequestContext } from '../request/RequestContext';
import { RequestContextKey } from '../request/RequestContextKey';
import { WebSocketInfoKey } from './WebSocketInfoKey';

/**
 * Information about a WebSocket connection that is carried alongside
 * every message and across workers / durable objects.
 *
 * Values written to `context` must be JSON-serializable since
 * `WebSocketInfo` is serialized on the wire. Write and read through
 * {@link getWsContext} and {@link setWsContext} using typed
 * {@link WebSocketInfoKey}s.
 */
export interface WebSocketInfo extends JsonObject {
    readonly socketId: string;
    readonly path: string;
    context: JsonObject;
}

/**
 * Reads a value from the WebSocketInfo context bag using a typed key.
 *
 * Accepts either a {@link WebSocketInfo} directly, or a
 * {@link RequestContext} that may carry one (for middleware and other
 * consumers that only hold the request context).
 */
export function getWsContext<T extends Json>(
    source: WebSocketInfo | RequestContext,
    key: WebSocketInfoKey<T>,
): T | undefined {
    const info = isWebSocketInfo(source)
        ? source
        : source.get(WebSocketInfoRequestContextKey);
    return info ? (info.context[key.name] as T | undefined) : undefined;
}

/**
 * Writes a value to the WebSocketInfo context bag using a typed key.
 */
export function setWsContext<T extends Json>(
    info: WebSocketInfo,
    key: WebSocketInfoKey<T>,
    value: T,
): void {
    info.context[key.name] = value;
}

export function isWebSocketInfo(obj: unknown): obj is WebSocketInfo {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const record = obj as Record<string, unknown>;
    return (
        typeof record.socketId === 'string' &&
        typeof record.path === 'string' &&
        typeof record.context === 'object' &&
        record.context !== null
    );
}

/**
 * BaseWebSocket is an interface the combines the libdom WebSocket interface
 * with the Cloudflare WebSocket interface. It is used to provide a common
 * interface for WebSocket connections.
 */
export interface BaseWebSocket extends WebSocket {
    serializeAttachment(attachment: any): void;
    deserializeAttachment(): any | null;
}

/**
 * The WebSocketInfoRequestContextKey is the request context key for the WebSocketInfo.
 */
export const WebSocketInfoRequestContextKey =
    new RequestContextKey<WebSocketInfo>('base:WebSocketInfo');
