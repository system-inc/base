// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';
import { isRpcFailureResponse } from '@system-inc/base-common/rpc/protocol/RpcResponse';
import { RpcClientDriver } from './RpcClientDriver';

class TestDriver extends RpcClientDriver {
    async sendRequest(): Promise<Response> {
        return new Response();
    }
}

const rpc = {
    type: 'request',
    procedure: 'doThing',
    arguments: [],
} as unknown as RpcCall;

describe('RpcClientDriver.buildRequest', () => {
    it('carries credentials/mode/cache through (needed in browsers)', () => {
        const driver = new TestDriver();
        const request = driver.buildRequest(rpc, {
            credentials: 'include',
            mode: 'cors',
            cache: 'no-store',
        });
        expect(request.credentials).toBe('include');
        expect(request.mode).toBe('cors');
        expect(request.cache).toBe('no-store');
    });
});

describe('RpcClientDriver.handleResponse', () => {
    it('returns a malformed-response failure (not a thrown bare object) for an unparseable body', async () => {
        const driver = new TestDriver();
        const response = new Response('not json <html>', {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });

        const result = await driver.handleResponse(rpc, response);

        // it is a proper RpcFailure result — the RpcClient proxy turns this
        // into an RpcError, rather than rejecting with a non-Error object
        expect(isRpcFailureResponse(result)).toBe(true);
    });

    it('rethrows an AbortError rather than masking it as malformed', async () => {
        const driver = new TestDriver();
        const abortError = Object.assign(new Error('aborted'), {
            name: 'AbortError',
        });
        const response = {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () => Promise.reject(abortError),
            bodyUsed: true,
            body: null,
        } as unknown as Response;

        await expect(driver.handleResponse(rpc, response)).rejects.toBe(
            abortError,
        );
    });
});
