// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ExecutionContext } from '@cloudflare/workers-types';

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';

/**
 * An ExecutionContext where waitUntil() work is *detached* from the
 * request lifecycle — registered, executed, but not observed by any
 * caller.
 *
 * Use on runtimes (e.g. Node) that don't have a runtime-managed
 * mechanism for "complete the response now, finish background work
 * later." On Cloudflare, the runtime handles this for you and
 * AwaitableExecutionContext is the right type; here, the registered
 * promise just runs in the background and any rejection is logged.
 *
 * If you ever want to coordinate detached work with graceful shutdown
 * or test assertions, expose the promise (as AwaitableExecutionContext
 * does) and have the consumer track it.
 */
export class DetachedExecutionContext implements ExecutionContext {
    props = undefined;

    waitUntil(promise: Promise<unknown>): void {
        promise
            .then(() => {
                Logger.debug(
                    LogCategory.Base,
                    'DetachedExecutionContext: waitUntil() - completed',
                );
            })
            .catch((error: unknown) => {
                Logger.error(
                    LogCategory.Base,
                    'DetachedExecutionContext: waitUntil() rejected:',
                    error,
                );
            });
    }

    passThroughOnException(): void {
        throw new Error('Method not implemented.');
    }
}
