// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RequireSessionAccess } from '@system-inc/base-foundation/access-control/decorators/RequireSessionAccess';
import { WithSessionAccess } from '@system-inc/base-foundation/access-control/decorators/WithSessionAccess';
import { SessionAccessOptions } from '@system-inc/base-foundation/access-control/SessionAccessOptions';
import { SessionContext } from '@system-inc/base-foundation/access-control/SessionContext';
import { SessionContextProvider } from '@system-inc/base-foundation/access-control/SessionContextProvider';
import { SessionContextRequestKey } from '@system-inc/base-foundation/access-control/SessionContextRequestKey';
import { HttpErrors } from '@system-inc/base-foundation/error/HttpErrors';
import { InjectRequestContext } from '@system-inc/base-foundation/request/decorators/RequestContextDecorator';
import { HandlerRequestContext } from '@system-inc/base-foundation/request/HandlerRequestContext';
import { HttpRoute } from '@system-inc/base-foundation/router/decorators/HttpRoute';
import { HttpService } from '@system-inc/base-foundation/router/decorators/HttpService';

/**
 * The reference implementation of the framework's access-control seam
 * (see `access-control/CLAUDE.md` in foundation). A real application
 * resolves the session from a cookie or token against its identity
 * store; this test provider reads it from the `x-test-session` header:
 *
 * ```
 * x-test-session: {"accountId":"a1","actorId":"p1","roles":["Administrator"],"entitlements":["premium"]}
 * ```
 */
interface TestSessionHeader {
    accountId: string;
    actorId: string;
    roles?: string[];
    entitlements?: string[];
}

interface TestActor {
    actorId: string;
}

class TestSessionContext implements SessionContext<TestActor> {
    readonly sessionId = 'test-session';

    constructor(
        readonly accountId: string,
        readonly actorId: string,
        readonly accessRoles: ReadonlyArray<string>,
        readonly entitlements: ReadonlyArray<string>,
    ) {}

    hasAccessRole(role: string | string[]): boolean {
        return (Array.isArray(role) ? role : [role]).some((value) =>
            this.accessRoles.includes(value),
        );
    }

    hasEntitlement(entitlement: string | string[]): boolean {
        return (Array.isArray(entitlement) ? entitlement : [entitlement]).some(
            (value) => this.entitlements.includes(value),
        );
    }

    getActor(): Readonly<TestActor> {
        return { actorId: this.actorId };
    }
}

export class TestSessionContextProvider implements SessionContextProvider {
    /**
     * Called once per decorated handler with that handler's merged
     * options — a real provider can use `options` for policy (e.g. only
     * enforce a device requirement when `skipAuthorization` is false)
     * and should cache expensive identity lookups per request via
     * `SessionContextRequestKey`. Parsing a header is cheap, so this
     * provider does neither.
     */
    resolve(
        requestContext: HandlerRequestContext,
        options: Readonly<SessionAccessOptions>,
    ): Promise<SessionContext | null> {
        void options;
        const header = requestContext.headers.get('x-test-session');

        // no header — plain "not signed in" is null, never a throw
        if (!header) {
            return Promise.resolve(null);
        }

        // a malformed session is a provider-policy failure — the provider
        // throws (contrast with the anonymous case above)
        let session: TestSessionHeader;
        try {
            session = JSON.parse(header) as TestSessionHeader;
        } catch {
            throw HttpErrors.badRequest({
                message: 'Malformed x-test-session header.',
            });
        }

        return Promise.resolve(
            new TestSessionContext(
                session.accountId,
                session.actorId,
                session.roles ?? [],
                session.entitlements ?? [],
            ),
        );
    }
}

@HttpService()
export class AccessControlTestService {
    /**
     * Undecorated — proves handlers without access-control metadata pass
     * straight through the enforcement middleware.
     */
    @HttpRoute('GET', '/test/access-control/public')
    publicRoute(): Response {
        return new Response('public');
    }

    @RequireSessionAccess()
    @HttpRoute('GET', '/test/access-control/authenticated')
    authenticatedRoute(
        @InjectRequestContext(SessionContextRequestKey)
        sessionContext: SessionContext,
    ): Response {
        return Response.json({
            accountId: sessionContext.accountId,
            actorId: sessionContext.actorId,
        });
    }

    @RequireSessionAccess({ roles: ['Administrator', 'Support'] })
    @HttpRoute('GET', '/test/access-control/staff')
    staffRoute(
        @InjectRequestContext(SessionContextRequestKey)
        sessionContext: SessionContext,
    ): Response {
        return Response.json({
            accountId: sessionContext.accountId,
            isAdministrator: sessionContext.hasAccessRole('Administrator'),
        });
    }

    @RequireSessionAccess({ entitlements: ['premium'] })
    @HttpRoute('GET', '/test/access-control/premium')
    premiumRoute(): Response {
        return new Response('premium content');
    }

    @WithSessionAccess()
    @HttpRoute('GET', '/test/access-control/optional')
    optionalRoute(
        @InjectRequestContext(SessionContextRequestKey)
        sessionContext: SessionContext | undefined,
    ): Response {
        return Response.json({
            authenticated: !!sessionContext,
            accountId: sessionContext?.accountId ?? null,
        });
    }
}
