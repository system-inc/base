// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import { RequestContext } from './RequestContext';

/**
 * A {@link RequestContext} narrowed to guarantee the handler has been
 * resolved. Passed to handler-scoped middleware so implementations do
 * not have to null-check `rc.handler` — the dispatcher has already
 * established the invariant by the time handler middleware runs.
 */
export interface HandlerRequestContext extends RequestContext {
    readonly handler: BaseHandler;
}
