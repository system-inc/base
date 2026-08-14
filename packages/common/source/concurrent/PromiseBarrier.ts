// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * A barrier that waits for a set of promises to settle.
 */
export class PromiseBarrier {
    private promises: Set<Promise<unknown>> = new Set();
    private resolveFn?: () => void;
    private settled = false;

    get size(): number {
        return this.promises.size;
    }

    add<T>(promise: Promise<T>): void {
        if (this.settled) {
            throw new Error('Cannot add promises after wait() has resolved');
        }

        this.promises.add(promise);

        // The original promise is observed by the caller; this chain only
        // runs the barrier-internal cleanup. Swallow rejections on the
        // chain itself so a rejected member doesn't surface twice (once
        // to the caller, once as an unhandled rejection here).
        promise
            .finally(() => {
                this.promises.delete(promise);
                if (this.promises.size === 0 && this.resolveFn) {
                    this.settled = true;
                    this.resolveFn();
                }
            })
            .catch(() => {});
    }

    async wait(): Promise<void> {
        if (this.promises.size === 0) {
            return;
        }

        return new Promise<void>((resolve) => {
            this.resolveFn = resolve;
        });
    }
}
