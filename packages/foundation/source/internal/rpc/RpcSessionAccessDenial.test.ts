// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RequireSessionAccess } from '../../access-control/decorators/RequireSessionAccess';
import { SessionContext } from '../../access-control/SessionContext';
import { SessionContextProvider } from '../../access-control/SessionContextProvider';
import { PlatformType } from '../../configuration/Platform';
import { HandlerRequestContext } from '../../request/HandlerRequestContext';
import { Rpc } from '../../rpc/decorators/Rpc';
import { RpcArgument } from '../../rpc/decorators/RpcArgument';
import { RpcService } from '../../rpc/decorators/RpcService';
import { SerializableField } from '../../serialization/decorators/SerializableField';
import { SerializableObject } from '../../serialization/decorators/SerializableObject';
import { VerifyIsEmail } from '../../validation/decorators/VerifyIsEmail';
import { BaseWorker } from '../../worker/BaseWorker';
import { BaseExecutionContext } from '../execution-context/BaseExecutionContext';

/**
 * Signs the caller in with the roles named in `x-test-roles`; no header is
 * anonymous.
 */
class HeaderSessionProvider implements SessionContextProvider {
    resolve(
        requestContext: HandlerRequestContext,
    ): Promise<SessionContext | null> {
        const roles = requestContext.headers.get('x-test-roles');
        if (roles === null) {
            return Promise.resolve(null);
        }
        const accessRoles = roles.split(',');
        return Promise.resolve({
            sessionId: 's1',
            accountId: 'a1',
            actorId: 'a1',
            accessRoles,
            entitlements: [],
            hasAccessRole: (role: string | string[]) =>
                (Array.isArray(role) ? role : [role]).some((value) =>
                    accessRoles.includes(value),
                ),
            hasEntitlement: () => false,
            getActor: () => ({}),
        });
    }
}

@SerializableObject()
class GuardedInput {
    @VerifyIsEmail()
    @SerializableField(() => String)
    email: string;
}

@RpcService({ visibility: 'public' })
class GuardedRpc {
    @RequireSessionAccess({ roles: ['Administrator'] })
    @Rpc()
    async guardedInvite(
        @RpcArgument(() => GuardedInput) input: GuardedInput,
    ): Promise<string> {
        return `invited ${input.email}`;
    }
}

async function callGuarded(
    roles: string | undefined,
    input: unknown,
): Promise<Response> {
    const headers: Record<string, string> = {};
    if (roles !== undefined) {
        headers['x-test-roles'] = roles;
    }
    return BaseWorker.create({
        name: 'rpc-session-denial-test',
        title: 'RPC Session Denial Test',
        version: '1.0.0',
        modules: [],
        services: [GuardedRpc],
        rpc: { service: {} },
        accessControl: { provider: HeaderSessionProvider },
    })
        .getBase({
            PLATFORM: PlatformType.CloudflareWorker,
            ENVIRONMENT: 'Production',
        })
        .handleRequest(
            new Request('https://api.example.com/__rpc', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    id: 'call-1',
                    type: 'request',
                    procedure: 'guardedInvite',
                    arguments: [input],
                    __protocol: 'BaseRPC',
                    __version: '1.0',
                }),
            }),
            new BaseExecutionContext(performance.now()),
        );
}

/**
 * The dispatcher throws a session-access denial rather than folding it into
 * an RPC failure, so any surface built on `dispatch()` can tell it apart
 * from other handler-middleware short-circuits (which become NOT_ALLOWED).
 * On the RPC route that surfaces as the HTTP error itself.
 */
describe('RPC session-access denial', () => {
    it('answers an anonymous caller with 401 before validating arguments', async () => {
        const response = await callGuarded(undefined, { email: 'not-email' });

        expect(response.status).toBe(401);
        expect(await response.json()).toMatchObject({
            errorCode: 'AUTHENTICATION_REQUIRED',
        });
    });

    it('answers a caller without the role with 403', async () => {
        const response = await callGuarded('Member', {
            email: 'a@example.com',
        });

        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            errorCode: 'PERMISSION_DENIED',
        });
    });

    it('runs the procedure for a caller with the role', async () => {
        const response = await callGuarded('Administrator', {
            email: 'a@example.com',
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            status: 'success',
            result: 'invited a@example.com',
        });
    });
});
