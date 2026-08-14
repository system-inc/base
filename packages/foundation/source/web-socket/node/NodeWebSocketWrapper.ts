// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    type EventListenerOrEventListenerObject,
    type WebSocketEventMap,
} from '@cloudflare/workers-types';
import {
    MessageEvent as WebSocketMessage,
    CloseEvent as WsCloseEvent,
    ErrorEvent as WsErrorEvent,
    Event as WsEvent,
} from 'ws';

import { BaseWebSocket } from '../WebSocketTypes';
import { NodeWebSocket } from './NodeWebSocketTypes';

/**
 * A wrapper that takes a NodeWebSocket and wraps it in the BaseWebSocket interface
 * so that it can be used in the rest of the Base socket systems.
 */
export class NodeWebSocketWrapper implements BaseWebSocket {
    static wrap(ws: NodeWebSocket): BaseWebSocket {
        return new NodeWebSocketWrapper(ws);
    }

    readonly CONNECTING = 0 as const;
    readonly OPEN = 1 as const;
    readonly CLOSING = 2 as const;
    readonly CLOSED = 3 as const;

    private _onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
    private _onerror: ((this: WebSocket, ev: Event) => any) | null = null;
    private _onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null =
        null;
    private _onopen: ((this: WebSocket, ev: Event) => any) | null = null;
    private _attachment: any | null = null;

    constructor(private readonly ws: NodeWebSocket) {}

    get binaryType(): BinaryType {
        return 'arraybuffer';
    }

    set binaryType(value: BinaryType) {
        throw new Error('Method not implemented.');
    }

    get bufferedAmount(): number {
        return this.ws.bufferedAmount;
    }

    get extensions(): string {
        return this.ws.extensions;
    }

    get protocol(): string {
        return this.ws.protocol;
    }

    get readyState(): number {
        return this.ws.readyState;
    }

    get url(): string {
        return this.ws.url;
    }

    get onclose(): ((this: WebSocket, ev: CloseEvent) => any) | null {
        return this._onclose;
    }

    set onclose(handler: ((this: WebSocket, ev: CloseEvent) => any) | null) {
        this._onclose = handler;
        this.ws.onclose = (ev: WsCloseEvent) => {
            this._onclose?.call(this, new CloseEvent(ev.type, ev));
        };
    }

    get onerror(): ((this: WebSocket, ev: Event) => any) | null {
        return this._onerror;
    }

    set onerror(handler: ((this: WebSocket, ev: Event) => any) | null) {
        this._onerror = handler;
        this.ws.onerror = (ev: WsErrorEvent) => {
            this._onerror?.call(this, new ErrorEvent(ev.type, ev));
        };
    }

    get onmessage(): ((this: WebSocket, ev: MessageEvent) => any) | null {
        return this._onmessage;
    }

    set onmessage(
        handler: ((this: WebSocket, ev: MessageEvent) => any) | null,
    ) {
        this._onmessage = handler;
        this.ws.onmessage = (ev: WebSocketMessage) => {
            this._onmessage?.call(this, new MessageEvent(ev.type, ev));
        };
    }

    get onopen(): ((this: WebSocket, ev: Event) => any) | null {
        return this._onopen;
    }

    set onopen(handler: ((this: WebSocket, ev: Event) => any) | null) {
        this._onopen = handler;
        this.ws.onopen = (ev: WsEvent) => {
            this._onopen?.call(this, new Event(ev.type));
        };
    }

    close(code?: number, reason?: string): void;
    close(code?: number, reason?: string): void {
        this.ws.close(code, reason);
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
    send(message: (ArrayBuffer | ArrayBufferView) | string): void;
    send(message: unknown): void {
        if (typeof message === 'string' || message instanceof ArrayBuffer) {
            this.ws.send(message);
        } else if (message instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
                this.ws.send(reader.result as ArrayBuffer);
            };
            reader.readAsArrayBuffer(message);
        } else if (ArrayBuffer.isView(message)) {
            this.ws.send(message.buffer);
        }
    }

    accept(): void {}

    /**
     *
     * @param type
     * @param listener
     * @param options
     */
    addEventListener<K extends keyof WebSocketEventMap>(
        type: K,
        listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener<K extends keyof WebSocketEventMap>(
        type: K,
        listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any,
        _options?: boolean | AddEventListenerOptions,
    ): void {
        switch (type) {
            case 'open':
                this.ws.on('open', listener as (event: any) => void);
                break;
            case 'message':
                this.ws.on('message', (data: any) => {
                    const event: Partial<MessageEvent> = {
                        type: 'message',
                        data: data.toString(),
                    };
                    listener.call(this, event as any);
                });
                break;
            case 'error':
                this.ws.on('error', (error: any) => {
                    const event: Partial<ErrorEvent> = {
                        type: 'error',
                        error: error,
                    };
                    listener.call(this, event as any);
                });
                break;
            case 'close':
                this.ws.on('close', (code: number, reason: string) => {
                    const event: Partial<CloseEvent> = {
                        type: 'close',
                        code,
                        reason,
                        wasClean: code === 1000, // 1000 means normal closure
                    };
                    listener.call(this, event as any);
                });
                break;
            default: {
                // For any other event types, we can fall back to a generic event
                const event = new Event(type);
                listener.call(this, event as any);
                break;
            }
        }
    }

    removeEventListener<K extends keyof WebSocketEventMap>(
        type: K,
        listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any,
        options?: boolean | EventListenerOptions,
    ): void;
    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions,
    ): void;
    removeEventListener<Type extends keyof WebSocketEventMap>(
        type: Type,
        handler: EventListenerOrEventListenerObject<WebSocketEventMap[Type]>,
        options?: EventTargetEventListenerOptions | boolean,
    ): void;
    removeEventListener<K extends keyof WebSocketEventMap>(
        _type: K,
        _listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any,
        _options?: boolean | EventListenerOptions,
    ): void {
        throw new Error('Not implemented');
    }

    dispatchEvent(event: Event): boolean;
    dispatchEvent(
        event: CloseEvent | ErrorEvent | MessageEvent | Event,
    ): boolean;
    dispatchEvent(
        event: CloseEvent | ErrorEvent | MessageEvent | Event,
    ): boolean {
        return this.ws.emit(event.type, event);
    }

    //#region Cloudflare WebSocket API

    serializeAttachment(attachment: any): void {
        this._attachment = attachment;
    }

    deserializeAttachment() {
        return this._attachment;
    }

    //#endregion
}
