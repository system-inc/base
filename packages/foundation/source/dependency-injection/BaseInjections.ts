// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DeferredActions } from '../request/DeferredActions';
import { TypedInjectionKey } from './TypedInjectionKey';

/**
 * System level injections allow Base applications or
 * modules to provide dependencies to Base via Providers.
 */
export namespace BaseInjections {
    /**
     * The Injection Token for the ResponseTransformer implementation.
     *
     * Kept as a string token because `BaseRouter` performs string
     * equality comparisons against this value when resolving error
     * tokens — a `TypedInjectionKey` instance would fail those checks.
     */
    export const ResponseTransformer = 'BaseInjections.ResponseTransformer';

    /**
     * The Injection Token for the per-request {@link DeferredActions}
     * implementation. Resolves to the current request's deferred
     * executor — use it to schedule work that runs after the response
     * has been returned.
     */
    export const DeferredActions = new TypedInjectionKey<DeferredActions>(
        'BaseInjections.DeferredActions',
    );
}
