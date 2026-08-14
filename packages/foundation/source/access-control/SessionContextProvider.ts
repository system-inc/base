// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HandlerRequestContext } from '../request/HandlerRequestContext';
import { SessionAccessOptions } from './SessionAccessOptions';
import { SessionContext } from './SessionContext';

/**
 * The seam an application implements to plug its identity system into
 * the framework's access control.
 *
 * Register exactly one implementation via `accessControl: { provider }`
 * in the worker settings or a module's settings. The session-access
 * middleware resolves it from the request-scoped container to load the
 * identity for handlers decorated with `@RequireSessionAccess` /
 * `@WithSessionAccess`; authorization itself (role/entitlement matching,
 * 401/403) is generic and stays in the middleware.
 */
export interface SessionContextProvider {
    /**
     * Resolve the request into a {@link SessionContext}, or `null` when no
     * valid session is present. Throwing is reserved for provider-policy
     * failures (e.g. a required device identifier is missing, or the
     * account is suspended) — plain "not signed in" is `null`.
     *
     * Called once per decorated handler (a request that dispatches several
     * decorated handlers, e.g. a GraphQL query, resolves each one), with
     * that handler's merged {@link SessionAccessOptions}. This lets a
     * provider apply option-dependent policy — e.g. enforce a device
     * requirement only when authorization will run
     * (`skipAuthorization` false). Providers whose identity lookup is
     * expensive should cache it per request, e.g. by reading
     * `SessionContextRequestKey` (where the middleware stores the previous
     * resolution) before hitting the session store.
     */
    resolve(
        requestContext: HandlerRequestContext,
        options: Readonly<SessionAccessOptions>,
    ): Promise<SessionContext | null>;
}
