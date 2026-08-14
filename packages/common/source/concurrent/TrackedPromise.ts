// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * The possible states of a tracked promise.
 */
export type TrackedPromiseState = 'pending' | 'fulfilled' | 'rejected';

/**
 * A promise that tracks its state,
 * it can be resolved or rejected from outside.
 */
export type TrackedPromise<T> = {
    /**
     * Gets the current state of the promise.
     *
     * @returns The current state of the promise.
     */
    getState: () => TrackedPromiseState;

    /**
     * Resolves the promise with the given value if it is still pending.
     *
     * @param value The value to resolve the promise with.
     * @returns
     */
    resolve: (value: T | PromiseLike<T>) => void;

    /**
     * Rejects the promise with the given reason if it is still pending.
     *
     * @param reason The reason for rejecting the promise.
     * @returns
     */
    reject: (reason?: unknown) => void;

    /**
     * The promise itself.
     */
    promise: Promise<T>;
};

export namespace TrackedPromise {
    /**
     * Creates a new tracked promise.
     *
     * @returns A new tracked promise.
     */
    export function create<T>(): TrackedPromise<T> {
        let state: TrackedPromiseState = 'pending';
        let resolveFn: (value: T | PromiseLike<T>) => void;
        let rejectFn: (reason?: unknown) => void;

        const promise = new Promise<T>((resolve, reject) => {
            resolveFn = (value) => {
                if (state === 'pending') {
                    state = 'fulfilled';
                    resolve(value);
                }
            };
            rejectFn = (reason) => {
                if (state === 'pending') {
                    state = 'rejected';
                    reject(reason);
                }
            };
        });

        return {
            getState: () => state,
            resolve: resolveFn!,
            reject: rejectFn!,
            promise,
        };
    }
}
