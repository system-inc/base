// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { PlatformType } from '../../configuration/Platform';
import { Rpc } from '../../rpc/decorators/Rpc';
import { RpcArgument } from '../../rpc/decorators/RpcArgument';
import { RpcService } from '../../rpc/decorators/RpcService';
import { BaseWorker } from '../../worker/BaseWorker';
import { BaseExecutionContext } from '../execution-context/BaseExecutionContext';

/**
 * Imported by this file (so its decorators run) but never registered: it
 * must not affect which `identityCharge` a registered service serves.
 */
@RpcService({ visibility: 'public' })
class UnregisteredBillingRpc {
    @Rpc()
    async identityCharge(): Promise<string> {
        return 'unregistered';
    }
}

@RpcService({ visibility: 'public' })
class RegisteredBillingRpc {
    @Rpc()
    async identityCharge(): Promise<string> {
        return 'registered';
    }

    /**
     * Carries an argument decorator but no `@Rpc()`, so it was never
     * declared a procedure.
     */
    async identityUndeclared(
        @RpcArgument(() => String) value: string,
    ): Promise<string> {
        return `undeclared ${value}`;
    }
}

@RpcService({ visibility: 'public' })
class OtherBillingRpc {
    @Rpc()
    async identityCharge(): Promise<string> {
        return 'other';
    }
}

function createWorker(services: Constructor<object>[]): BaseWorker {
    return BaseWorker.create({
        name: 'rpc-identity-test',
        title: 'RPC Identity Test',
        version: '1.0.0',
        modules: [],
        services,
        rpc: { service: {} },
    });
}

async function callRpc(
    worker: BaseWorker,
    procedure: string,
    args: unknown[] = [],
): Promise<{ status: string; result?: unknown; error?: { code: string } }> {
    const response = await worker
        .getBase({
            PLATFORM: PlatformType.CloudflareWorker,
            ENVIRONMENT: 'Production',
        })
        .handleRequest(
            new Request('https://api.example.com/__rpc', {
                method: 'POST',
                body: JSON.stringify({
                    id: 'call-1',
                    type: 'request',
                    procedure,
                    arguments: args,
                    __protocol: 'BaseRPC',
                    __version: '1.0',
                }),
            }),
            new BaseExecutionContext(performance.now()),
        );
    return response.json();
}

describe('RPC procedure identity', () => {
    it('serves the registered service when an unregistered one declares the same procedure', async () => {
        const result = await callRpc(
            createWorker([RegisteredBillingRpc]),
            'identityCharge',
        );

        expect(result).toMatchObject({
            status: 'success',
            result: 'registered',
        });
    });

    it('does not expose a method that has an @RpcArgument but no @Rpc', async () => {
        const result = await callRpc(
            createWorker([RegisteredBillingRpc]),
            'identityUndeclared',
            ['x'],
        );

        expect(result).toMatchObject({
            status: 'failure',
            error: { code: 'NOT_FOUND' },
        });
    });

    it('fails boot when two registered services declare the same procedure', async () => {
        const worker = createWorker([RegisteredBillingRpc, OtherBillingRpc]);

        await expect(
            worker
                .getBase({
                    PLATFORM: PlatformType.CloudflareWorker,
                    ENVIRONMENT: 'Production',
                })
                .initialize(),
        ).rejects.toThrow(
            /identityCharge.*RegisteredBillingRpc.*OtherBillingRpc/,
        );
    });

    it('keeps the unregistered service importable without registering it', () => {
        // referenced so the import (and its decorators) isn't elided
        expect(UnregisteredBillingRpc).toBeDefined();
    });
});
