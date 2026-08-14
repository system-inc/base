---
title: Access Control
description: Guard handlers with session requirements; resolve identity through one provider.
---

Access control in Base has two halves: **decorators** state what a handler requires, and a single **session context provider** — the worker's identity seam — resolves who is calling. The framework enforces the meeting of the two before your handler runs, across HTTP, GraphQL, and RPC alike.

## Guard a handler

```ts
import { RequireSessionAccess } from '@system-inc/base-foundation/access-control/decorators/RequireSessionAccess';
import { SessionContext } from '@system-inc/base-foundation/access-control/SessionContext';
import { SessionContextRequestKey } from '@system-inc/base-foundation/access-control/SessionContextRequestKey';

@HttpService()
export class AccountService {
    // any authenticated session
    @RequireSessionAccess()
    @HttpRoute('GET', '/account')
    account(
        @InjectRequestContext(SessionContextRequestKey)
        session: SessionContext,
    ): Response {
        return Response.json({ accountId: session.accountId });
    }

    // any of these roles
    @RequireSessionAccess({ roles: ['Administrator', 'Support'] })
    @HttpRoute('GET', '/admin')
    admin(): Response { ... }

    // any of these entitlements
    @RequireSessionAccess({ entitlements: ['premium'] })
    @HttpRoute('GET', '/premium')
    premium(): Response { ... }
}
```

- Requirements are **any-of** for both `roles` and `entitlements`; an empty or absent list requires only authentication.
- An anonymous request fails with **401** (`AUTHENTICATION_REQUIRED`); an authenticated one missing the roles fails with **403** (`PERMISSION_DENIED`) — before your handler, before argument deserialization.
- The decorator works at **class or method** level; class-level requirements merge with per-method ones.
- Inside a guarded handler, the session arrives via `@InjectRequestContext(SessionContextRequestKey)` — typed and guaranteed present.

**`@WithSessionAccess`** is the optional variant: the session loads _if_ present, but anonymous callers pass through — the injected parameter types as `SessionContext | undefined`. Right for endpoints that personalize when signed in.

## The session context

What a provider resolves and your handlers consume:

```ts
interface SessionContext<ActorType = unknown> {
    readonly sessionId: string;
    readonly accountId: string;
    readonly actorId: string; // the acting identity — row-ownership key
    readonly accessRoles: ReadonlyArray<string>;
    readonly entitlements: ReadonlyArray<string>;
    hasAccessRole(role: string | string[]): boolean;
    hasEntitlement(entitlement: string | string[]): boolean;
    getActor(): Readonly<ActorType>;
}
```

## The provider: One identity seam

A provider implements exactly one method, and a worker has exactly **one** provider (worker settings or contributed by a module — two is a boot error):

```ts
import { SessionContextProvider } from '@system-inc/base-foundation/access-control/SessionContextProvider';

export class AppSessionContextProvider implements SessionContextProvider {
    async resolve(
        requestContext: HandlerRequestContext,
        options: Readonly<SessionAccessOptions>,
    ): Promise<SessionContext | null> {
        const sessionId = requestContext.cookies['sessionId'];
        if (!sessionId) {
            return null; // anonymous — never a throw
        }
        const session = await this.lookupSession(sessionId);
        if (!session) {
            return null;
        }
        return session; // a SessionContext
    }
}
```

```ts
    accessControl: {
        provider: AppSessionContextProvider,
    },
```

The contract's three-way discipline: a valid session returns a `SessionContext`; plain "not signed in" returns `null`; **throwing is reserved for policy failures** (malformed credentials, suspended account). The provider resolves from the request container, so it can inject services, and it's registered in `accessControl`, not `services`.

The `Account` module in System, Inc.'s companion module library ships a complete production provider (cookie sessions, roles, organizations) — register the module and the identity seam comes with it.
