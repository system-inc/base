// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '../logging/LogCategory';
import { Logger } from '../logging/Logger';

/**
 * A group of promises that when awaited returns when the first
 * promise in the group resolves.
 */
export class PromiseGroup<T> {
    private promises: Set<Promise<T>> = new Set();
    private waiting: {
        resolve: (value: T) => void;
        reject: (reason?: unknown) => void;
    }[] = [];

    get size(): number {
        return this.promises.size;
    }

    add(promise: Promise<T>): void {
        this.promises.add(promise);

        promise
            .then((result) => {
                this.promises.delete(promise);
                const waiter = this.waiting.shift();
                if (waiter) {
                    waiter.resolve(result);
                }
            })
            .catch((error) => {
                Logger.error(
                    LogCategory.Common,
                    'PromiseGroup: unexpected error in Promise:',
                    error,
                );
                this.promises.delete(promise);
                const waiter = this.waiting.shift();
                if (waiter) {
                    waiter.reject(error);
                }
            });
    }

    async next(): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (this.promises.size === 0) {
                reject(new Error('No promises in group'));
                return;
            }

            this.waiting.push({ resolve, reject });
        });
    }
}
