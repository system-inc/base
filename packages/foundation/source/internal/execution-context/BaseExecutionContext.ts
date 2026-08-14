// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { StopWatch } from '@system-inc/base-common/time/StopWatch';

/**
 * The BaseExecutionContext provides a unified interface
 * for handling execution contexts across different platforms.
 */
export class BaseExecutionContext {
    readonly stopWatch: StopWatch;

    private _hasWaited = false;

    constructor(
        startTime: number,
        private readonly workersContext?: ExecutionContext,
    ) {
        this.stopWatch = new StopWatch(startTime);
    }

    /**
     * Calls the waitUntil method on the Cloudflare Workers execution context if it exists,
     * otherwise returns the promise to be awaited by the caller.
     *
     * @param promise
     * @returns
     */
    waitUntil(promise: Promise<unknown>): Promise<unknown> | undefined {
        if (this._hasWaited) {
            throw new Error('waitUntil() can only be called once');
        }
        this._hasWaited = true;

        // if we have a context from Cloudflare Workers, we should use the built-in waitUntil method
        if (this.workersContext) {
            this.workersContext.waitUntil(promise);
        } else {
            return promise;
        }
    }
}
