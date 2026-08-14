// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '../logging/LogCategory';
import { Logger } from '../logging/Logger';

/**
 * A queue that batches items and flushes them after a
 * timeout or when the queue reaches a maximum size.
 */
export class BatchingQueue<T> {
    private queue: T[] = [];
    private timeoutId: ReturnType<typeof setTimeout> | null = null;
    private isCanceled = false;

    constructor(
        private timeoutDuration: number,
        private onFlush: (items: T[]) => void | Promise<void>,
        private maxBatchSize?: number,
    ) {}

    push(item: T): void {
        if (this.isCanceled) return;

        this.queue.push(item);

        if (this.maxBatchSize && this.queue.length >= this.maxBatchSize) {
            this.flush();
            return;
        }

        this.resetTimeout();
    }

    flush(): void {
        if (this.queue.length === 0) return;
        const itemsToProcess = [...this.queue];
        this.queue = [];
        this.clearTimeout();
        const result = this.onFlush(itemsToProcess);
        // The callback may be async; surface a rejection that the
        // callback didn't handle itself instead of letting it become an
        // unhandled promise rejection.
        if (result instanceof Promise) {
            result.catch((error: unknown) => {
                Logger.error(
                    LogCategory.Common,
                    '[BatchingQueue] onFlush rejected:',
                    error,
                );
            });
        }
    }

    cancel(): void {
        this.clearTimeout();
        this.queue = [];
        this.isCanceled = true;
    }

    reset(): void {
        this.isCanceled = false;
    }

    private resetTimeout(): void {
        this.clearTimeout();
        this.timeoutId = setTimeout(() => this.flush(), this.timeoutDuration);
    }

    private clearTimeout(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }
}
