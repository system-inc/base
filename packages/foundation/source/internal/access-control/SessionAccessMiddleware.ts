// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import { SessionAccessOptions } from '../../access-control/SessionAccessOptions';
import { SessionContext } from '../../access-control/SessionContext';
import { SessionContextProvider } from '../../access-control/SessionContextProvider';
import { SessionContextRequestKey } from '../../access-control/SessionContextRequestKey';
import {
    ERROR_CODE_AUTHENTICATION_REQUIRED,
    ERROR_CODE_INSUFFICIENT_ENTITLEMENTS,
    ERROR_CODE_PERMISSION_DENIED,
} from '../../error/ErrorCode';
import { HttpErrors } from '../../error/HttpErrors';
import { HandlerRequestContext } from '../../request/HandlerRequestContext';
import { getAccessControlMetadata } from './AccessControlMetadata';

/**
 * Enforces session-based access control for the request's current handler.
 *
 * Runs for every handler (before all other handler middleware, across
 * HTTP, RPC, and GraphQL dispatch): a handler without access-control
 * metadata passes straight through, so decorating a handler is the only
 * registration needed for it to be enforced.
 *
 * For a decorated handler:
 *   1. Resolves the identity via the registered
 *      {@link SessionContextProvider} (from `accessControl.provider` in
 *      worker/module settings), passing the handler's merged options so
 *      the provider can apply option-dependent policy. The resolved
 *      context is stored under {@link SessionContextRequestKey}. The
 *      provider is called once per decorated handler — providers own any
 *      identity caching (see the interface docs).
 *   2. If the options skip authorization (`@WithSessionAccess`), done.
 *   3. Otherwise: no session → 401 AUTHENTICATION_REQUIRED; session
 *      present but required roles unmatched → 403 PERMISSION_DENIED;
 *      required entitlements unmatched → 403 INSUFFICIENT_ENTITLEMENTS.
 *      Role and entitlement matching is any-of.
 */
export async function runSessionAccessMiddleware(
    requestContext: HandlerRequestContext,
    // The dispatcher passes the resolved handler explicitly so concurrent
    // GraphQL sibling fields don't race on the shared `rc.handler` slot;
    // callers with a single handler per request may omit it.
    handler: BaseHandler = requestContext.handler,
): Promise<void> {
    // read the handler's effective options from metadata — absent means
    // the handler carries no access-control decorators
    const options =
        getAccessControlMetadata().getSessionAccessOptionsForHandler(handler);
    if (!options) {
        return;
    }

    // resolve the session for the request through the registered provider
    const provider = resolveSessionContextProvider(requestContext);
    const sessionContext = await provider.resolve(requestContext, options);
    if (sessionContext) {
        requestContext.set(SessionContextRequestKey, sessionContext);
    }

    // if we're skipping authorization, we're done after loading the session
    if (options.skipAuthorization) {
        return;
    }

    if (!sessionContext) {
        throw HttpErrors.unauthorized({
            message: 'User is not authenticated.',
            errorCode: ERROR_CODE_AUTHENTICATION_REQUIRED,
        });
    }

    verifySessionAccess(sessionContext, options);
}

/**
 * Verifies the session against the handler's access requirements.
 * Matching is any-of for both roles and entitlements; an absent or empty
 * requirement list passes.
 */
function verifySessionAccess(
    sessionContext: SessionContext,
    options: SessionAccessOptions,
): void {
    if (
        options.roles &&
        options.roles.length > 0 &&
        !matchesAny(sessionContext.accessRoles, options.roles)
    ) {
        throw HttpErrors.forbidden({
            message: 'Required access roles not present.',
            errorCode: ERROR_CODE_PERMISSION_DENIED,
        });
    }

    if (
        options.entitlements &&
        options.entitlements.length > 0 &&
        !matchesAny(sessionContext.entitlements, options.entitlements)
    ) {
        throw HttpErrors.forbidden({
            message: 'Required entitlement not present.',
            errorCode: ERROR_CODE_INSUFFICIENT_ENTITLEMENTS,
        });
    }
}

function matchesAny(
    granted: ReadonlyArray<string>,
    required: ReadonlyArray<string>,
): boolean {
    return required.some((value) => granted.includes(value));
}

/**
 * Resolves the registered {@link SessionContextProvider}: the manifest
 * carries the provider class (from `accessControl.provider` in worker or
 * module settings) and the instance is resolved from the request-scoped
 * container so it gets full DI. Registration is validated at boot
 * (`BaseAppManifest.validate()`), so a missing provider here means the
 * handler's decorators were registered after boot — still a pointed
 * error, never a silently-unprotected handler.
 */
function resolveSessionContextProvider(
    requestContext: HandlerRequestContext,
): SessionContextProvider {
    const providerClass = requestContext.configuration.accessControl.provider;
    if (!providerClass) {
        throw new Error(
            '@RequireSessionAccess/@WithSessionAccess decorators are in use, ' +
                'but no SessionContextProvider is registered. Register exactly ' +
                'one implementation via `accessControl: { provider: ... }` in ' +
                "the worker settings or a module's settings.",
        );
    }
    return requestContext.container.resolve(providerClass);
}
