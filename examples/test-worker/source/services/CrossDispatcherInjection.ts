// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RequestContext } from '@system-inc/base-foundation/request/RequestContext';
import { RequestContextKey } from '@system-inc/base-foundation/request/RequestContextKey';

/**
 * RC bag key used by the cross-dispatcher regression test. A small
 * global middleware reads the `x-cross-dispatcher-token` header and
 * writes it under this key; the test then asserts that
 * `@InjectRequestContext(crossDispatcherTokenKey)` extracts the same
 * value through both the HTTP and GraphQL dispatchers.
 *
 * Foundation-only — no modules required. Replaces a similar test in
 * the original test-worker that depended on
 * `DeviceIdRequestContextKey` from the access-log module.
 */
export const CrossDispatcherTokenKey = new RequestContextKey<string>(
    'CrossDispatcherTokenKey',
);

export function crossDispatcherTokenMiddleware(
    requestContext: RequestContext,
): void {
    const headerValue = requestContext.headers.get('x-cross-dispatcher-token');
    if (headerValue) {
        requestContext.set(CrossDispatcherTokenKey, headerValue);
    }
}
