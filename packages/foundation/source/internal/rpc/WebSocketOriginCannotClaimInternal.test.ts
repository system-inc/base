// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BASE_HEADER_WEB_SOCKET_FETCH } from '@system-inc/base-common/http/HttpHeaders';
import { Base } from '../../base/Base';
import { BaseSettings } from '../../base/BaseSettings';
import { BaseConfiguration } from '../../configuration/BaseConfiguration';
import { PlatformType } from '../../configuration/Platform';
import { Injectable } from '../../dependency-injection/decorators/Injectable';
import { InjectRequestContext } from '../../request/decorators/RequestContextDecorator';
import { RequestContext } from '../../request/RequestContext';
import { Rpc } from '../../rpc/decorators/Rpc';
import { RpcService } from '../../rpc/decorators/RpcService';
import { WebSocketRpc } from '../../rpc/decorators/WebSocketRpc';
import { WebSocketDelegate } from '../../web-socket/WebSocketDelegate';
import { WebSocketInfoKey } from '../../web-socket/WebSocketInfoKey';
import {
    BaseWebSocket,
    getWsContext,
    WebSocketInfo,
} from '../../web-socket/WebSocketTypes';
import { BaseWorker } from '../../worker/BaseWorker';
import { BaseExecutionContext } from '../execution-context/BaseExecutionContext';

// ---- Fixture worker ----------------------------------------------------------
// `accounts` serves an internal admin procedure (only the `gateway` worker may
// call it), a socket-only push procedure, and a public procedure that reports
// which socket session it believes it is serving.

const calls: string[] = [];
const SessionKey = WebSocketInfoKey.create<string>('origin-test.session');

@RpcService({ visibility: 'internal' })
class OriginTestAdminService {
    @Rpc()
    async originTestDeleteAllAccounts(): Promise<string> {
        calls.push('deleteAllAccounts');
        return 'deleted';
    }

    @WebSocketRpc()
    async originTestSubscribe(): Promise<void> {
        calls.push('subscribe');
    }

    @Rpc({ visibility: 'public' })
    async originTestWhoAmI(
        @InjectRequestContext() requestContext: RequestContext,
    ): Promise<string | null> {
        calls.push('whoAmI');
        return getWsContext(requestContext, SessionKey) ?? null;
    }
}

@Injectable()
class OriginTestDelegate extends WebSocketDelegate {
    constructor(configuration: BaseConfiguration) {
        super('origin-test', configuration);
    }
    async authorizeUpgrade(): Promise<string | undefined> {
        return 'socket-1';
    }
    async onWebSocketClose(): Promise<void> {}
    async onWebSocketError(): Promise<void> {}
}

const settings: BaseSettings = {
    name: 'accounts',
    title: 'Accounts',
    version: '1.0.0',
    modules: [],
    services: [OriginTestAdminService],
    rpc: { service: { allowedWorkers: ['gateway'] } },
    webSocket: {
        delegates: [
            { name: 'chat', path: '/ws', delegate: OriginTestDelegate },
        ],
    },
};

function makeBase(platform: PlatformType): Base {
    return BaseWorker.create(settings).getBase({
        PLATFORM: platform,
        ENVIRONMENT: 'Production',
    });
}

const socketInfo: WebSocketInfo = {
    path: '/ws',
    socketId: 'socket-1',
    context: { [SessionKey.name]: 'session-of-socket-1' },
};

function makeSocket(): BaseWebSocket {
    return {
        send: jest.fn(),
        close: jest.fn(),
        deserializeAttachment: () => socketInfo,
    } as unknown as BaseWebSocket;
}

function rpcBody(procedure: string, meta?: unknown): string {
    return JSON.stringify({
        id: 'call-1',
        type: 'request',
        procedure,
        arguments: [],
        meta,
        __protocol: 'BaseRPC',
        __version: '1.0',
    });
}

async function callRpc(
    base: Base,
    url: string,
    procedure: string,
    options: { headers?: Record<string, string>; meta?: unknown } = {},
): Promise<{ status: string; result?: unknown; error?: { code: string } }> {
    const response = await base.handleRequest(
        new Request(url, {
            method: 'POST',
            headers: options.headers,
            body: rpcBody(procedure, options.meta),
        }),
        new BaseExecutionContext(performance.now()),
    );
    return response.json();
}

beforeEach(() => {
    calls.splice(0);
});

describe('a socket client cannot claim an internal origin', () => {
    it('cannot call an internal procedure by naming an allowed worker as origin', async () => {
        const base = makeBase(PlatformType.Node);

        await base.webSocketMessage(
            makeSocket(),
            JSON.stringify({
                type: 'originTestDeleteAllAccounts',
                origin: 'gateway',
                arguments: [],
            }),
        );

        expect(calls).toEqual([]);
    });

    it('cannot call an internal procedure through a forwarding event that targets this worker', async () => {
        const base = makeBase(PlatformType.Node);

        await base.webSocketMessage(
            makeSocket(),
            JSON.stringify({
                type: 'forwarding',
                originatingType: 'originTestDeleteAllAccounts',
                origin: 'gateway',
                target: 'accounts',
                arguments: [],
            }),
        );

        expect(calls).toEqual([]);
    });

    it('can call a @WebSocketRpc procedure, with the socket info the server holds', async () => {
        const base = makeBase(PlatformType.Node);

        await base.webSocketMessage(
            makeSocket(),
            JSON.stringify({ type: 'originTestSubscribe', origin: 'x' }),
        );

        expect(calls).toEqual(['subscribe']);
    });

    it('can call a public procedure', async () => {
        const base = makeBase(PlatformType.Node);

        await base.webSocketMessage(
            makeSocket(),
            JSON.stringify({ type: 'originTestWhoAmI', origin: 'x' }),
        );

        expect(calls).toEqual(['whoAmI']);
    });
});

describe('the internal hostname is trusted only where the platform delivers it', () => {
    it('on Node, a forged .base-internal Host is a public caller', async () => {
        const base = makeBase(PlatformType.Node);

        const result = await callRpc(
            base,
            'http://gateway.base-internal/__rpc',
            'originTestDeleteAllAccounts',
        );

        expect(result.status).toBe('failure');
        expect(result.error?.code).toBe('NOT_ALLOWED');
        expect(calls).toEqual([]);
    });

    it('on Cloudflare, an allowed bound worker can call an internal procedure', async () => {
        const base = makeBase(PlatformType.CloudflareWorker);

        const result = await callRpc(
            base,
            'https://gateway.base-internal/__rpc',
            'originTestDeleteAllAccounts',
        );

        expect(result.status).toBe('success');
        expect(calls).toEqual(['deleteAllAccounts']);
    });

    it('on Cloudflare, a socket call relayed by an allowed worker is not internal', async () => {
        const base = makeBase(PlatformType.CloudflareWorker);

        const result = await callRpc(
            base,
            'https://gateway.base-internal/__rpc',
            'originTestDeleteAllAccounts',
            { headers: { [BASE_HEADER_WEB_SOCKET_FETCH]: 'true' } },
        );

        expect(result.error?.code).toBe('NOT_ALLOWED');
        expect(calls).toEqual([]);
    });

    it('on Cloudflare, an allowed relay reaches @WebSocketRpc procedures and carries its socket info', async () => {
        const base = makeBase(PlatformType.CloudflareWorker);
        const relay = { headers: { [BASE_HEADER_WEB_SOCKET_FETCH]: 'true' } };

        const subscribe = await callRpc(
            base,
            'https://gateway.base-internal/__rpc',
            'originTestSubscribe',
            relay,
        );
        const whoAmI = await callRpc(
            base,
            'https://gateway.base-internal/__rpc',
            'originTestWhoAmI',
            { ...relay, meta: socketInfo },
        );

        expect(subscribe.status).toBe('success');
        expect(whoAmI.result).toBe('session-of-socket-1');
    });

    it('on Cloudflare, a relay from a worker not on allowedWorkers cannot reach @WebSocketRpc', async () => {
        const base = makeBase(PlatformType.CloudflareWorker);

        const result = await callRpc(
            base,
            'https://stranger.base-internal/__rpc',
            'originTestSubscribe',
            { headers: { [BASE_HEADER_WEB_SOCKET_FETCH]: 'true' } },
        );

        expect(result.error?.code).toBe('NOT_ALLOWED');
        expect(calls).toEqual([]);
    });
});

describe('socket-only and socket-identity rules over HTTP', () => {
    it('a public HTTP caller cannot call a @WebSocketRpc procedure', async () => {
        const base = makeBase(PlatformType.Node);

        const result = await callRpc(
            base,
            'https://api.example.com/__rpc',
            'originTestSubscribe',
            // the header is ignored on a public request
            { headers: { [BASE_HEADER_WEB_SOCKET_FETCH]: 'true' } },
        );

        expect(result.error?.code).toBe('NOT_ALLOWED');
        expect(calls).toEqual([]);
    });

    it('a public caller cannot claim a socket identity through rpc.meta', async () => {
        const base = makeBase(PlatformType.Node);

        const result = await callRpc(
            base,
            'https://api.example.com/__rpc',
            'originTestWhoAmI',
            { meta: socketInfo },
        );

        expect(result.status).toBe('success');
        expect(result.result).toBeNull();
    });
});
