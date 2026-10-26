// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Base } from '../../base/Base';
import { PlatformType } from '../../configuration/Platform';
import { HttpErrors } from '../../error/HttpErrors';
import { Rpc } from '../../rpc/decorators/Rpc';
import { RpcService } from '../../rpc/decorators/RpcService';
import { BaseWorker } from '../../worker/BaseWorker';
import { BaseExecutionContext } from '../execution-context/BaseExecutionContext';

@RpcService({ visibility: 'public' })
class StackTestService {
    @Rpc()
    async stackTestRejects(): Promise<void> {
        throw HttpErrors.badRequest({
            message:
                'DatabaseError: target: db.-0.primary: vttablet: rpc error: code = AlreadyExists desc = Duplicate entry (errno 1062) (sqlstate 23000) (CallerID: x): Sql: "insert into users values (:v1)", BindVars: {v1: "alice@example.com"}',
        });
    }
}

function makeBase(): Base {
    return BaseWorker.create({
        name: 'stack-test',
        title: 'Stack Test',
        version: '1.0.0',
        modules: [],
        services: [StackTestService],
        rpc: { service: { allowedWorkers: ['gateway'] } },
    }).getBase({
        PLATFORM: PlatformType.CloudflareWorker,
        ENVIRONMENT: 'Production',
    });
}

async function callRpc(
    host: string,
    procedure: string,
): Promise<{ error: { cause?: Record<string, unknown> } }> {
    const response = await makeBase().handleRequest(
        new Request(`https://${host}/__rpc`, {
            method: 'POST',
            body: JSON.stringify({
                id: 'call-1',
                type: 'request',
                procedure,
                arguments: [],
                __protocol: 'BaseRPC',
                __version: '1.0',
            }),
        }),
        new BaseExecutionContext(performance.now()),
    );
    return response.json();
}

/**
 * RPC failures carried the handler error's full serializer record —
 * stack trace (internal file paths and line numbers) and unredacted
 * database messages included — to every caller. Only a bound worker
 * gets that detail now.
 */
describe('RPC error detail by caller', () => {
    it('gives a public caller no stack and a redacted database message', async () => {
        const result = await callRpc('api.example.com', 'stackTestRejects');

        expect(result.error.cause).toBeDefined();
        expect(result.error.cause).not.toHaveProperty('stack');
        expect(result.error.cause!.message).toBe(
            'DatabaseError: Duplicate entry',
        );
    });

    it('gives a bound worker the full error, stack included', async () => {
        const result = await callRpc(
            'gateway.base-internal',
            'stackTestRejects',
        );

        expect(typeof result.error.cause!.stack).toBe('string');
    });
});
