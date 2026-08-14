// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseErrorData } from '@system-inc/base-common/error/interfaces/BaseErrorData';
import { IntegrationTestEnvironment } from '@system-inc/base-foundation/test/IntegrationTestEnvironment';

const baseUrl = IntegrationTestEnvironment.get().client.getServerBaseUrl();

function sessionHeader(session: {
    accountId: string;
    actorId: string;
    roles?: string[];
    entitlements?: string[];
}): Record<string, string> {
    return { 'x-test-session': JSON.stringify(session) };
}

async function get(path: string, headers?: Record<string, string>) {
    return IntegrationTestEnvironment.get().client.sendRequest(
        baseUrl + path,
        headers ? { headers } : undefined,
    );
}

describe('Access Control Test', () => {
    test('undecorated route passes through without a session', async () => {
        const result = await get('/test/access-control/public');
        expect(result.status).toBe(200);
        expect(await result.text()).toBe('public');
    });

    test('@RequireSessionAccess rejects an anonymous request with 401 AUTHENTICATION_REQUIRED', async () => {
        const result = await get('/test/access-control/authenticated');
        const jsonError = await result.json<BaseErrorData>();
        expect(result.status).toBe(401);
        expect(jsonError.statusCode).toBe(401);
        expect(jsonError.errorCode).toBe('AUTHENTICATION_REQUIRED');
        expect(jsonError.message).toBe('User is not authenticated.');
    });

    test('@RequireSessionAccess loads the session for an authenticated request', async () => {
        const result = await get(
            '/test/access-control/authenticated',
            sessionHeader({ accountId: 'account-1', actorId: 'actor-1' }),
        );
        const resultObject = await result.json<{
            accountId: string;
            actorId: string;
        }>();
        expect(result.status).toBe(200);
        expect(resultObject.accountId).toBe('account-1');
        expect(resultObject.actorId).toBe('actor-1');
    });

    test('role-gated route rejects a session without a required role with 403 PERMISSION_DENIED', async () => {
        const result = await get(
            '/test/access-control/staff',
            sessionHeader({
                accountId: 'account-1',
                actorId: 'actor-1',
                roles: ['User'],
            }),
        );
        const jsonError = await result.json<BaseErrorData>();
        expect(result.status).toBe(403);
        expect(jsonError.statusCode).toBe(403);
        expect(jsonError.errorCode).toBe('PERMISSION_DENIED');
        expect(jsonError.message).toBe('Required access roles not present.');
    });

    test('role-gated route matches any-of the required roles', async () => {
        // the route requires Administrator OR Support; Support suffices
        const result = await get(
            '/test/access-control/staff',
            sessionHeader({
                accountId: 'account-1',
                actorId: 'actor-1',
                roles: ['Support'],
            }),
        );
        const resultObject = await result.json<{
            accountId: string;
            isAdministrator: boolean;
        }>();
        expect(result.status).toBe(200);
        expect(resultObject.accountId).toBe('account-1');
        expect(resultObject.isAdministrator).toBe(false);
    });

    test('entitlement-gated route rejects a session without the entitlement with 403 INSUFFICIENT_ENTITLEMENTS', async () => {
        const result = await get(
            '/test/access-control/premium',
            sessionHeader({
                accountId: 'account-1',
                actorId: 'actor-1',
                entitlements: ['free'],
            }),
        );
        const jsonError = await result.json<BaseErrorData>();
        expect(result.status).toBe(403);
        expect(jsonError.statusCode).toBe(403);
        expect(jsonError.errorCode).toBe('INSUFFICIENT_ENTITLEMENTS');
        expect(jsonError.message).toBe('Required entitlement not present.');
    });

    test('entitlement-gated route passes with the required entitlement', async () => {
        const result = await get(
            '/test/access-control/premium',
            sessionHeader({
                accountId: 'account-1',
                actorId: 'actor-1',
                entitlements: ['premium'],
            }),
        );
        expect(result.status).toBe(200);
        expect(await result.text()).toBe('premium content');
    });

    test('@WithSessionAccess lets an anonymous request through', async () => {
        const result = await get('/test/access-control/optional');
        const resultObject = await result.json<{
            authenticated: boolean;
            accountId: string | null;
        }>();
        expect(result.status).toBe(200);
        expect(resultObject.authenticated).toBe(false);
        expect(resultObject.accountId).toBeNull();
    });

    test('@WithSessionAccess loads the session when one is present', async () => {
        const result = await get(
            '/test/access-control/optional',
            sessionHeader({ accountId: 'account-2', actorId: 'actor-2' }),
        );
        const resultObject = await result.json<{
            authenticated: boolean;
            accountId: string | null;
        }>();
        expect(result.status).toBe(200);
        expect(resultObject.authenticated).toBe(true);
        expect(resultObject.accountId).toBe('account-2');
    });

    test('a provider-policy failure surfaces with the provider’s error', async () => {
        const result = await get('/test/access-control/authenticated', {
            'x-test-session': 'not-json',
        });
        const jsonError = await result.json<BaseErrorData>();
        expect(result.status).toBe(400);
        expect(jsonError.message).toBe('Malformed x-test-session header.');
    });
});
