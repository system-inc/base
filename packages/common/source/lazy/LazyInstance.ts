// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Lazy } from './Lazy';

/**
 * Helper class for instantiating a type lazily.
 */
export class LazyInstance<T> implements Lazy<T> {
    private value: T | undefined;
    private initialized = false;

    constructor(private readonly init: () => T) {}

    get(): T {
        // Track initialization with a flag, not a truthiness check on the
        // value — a legitimately falsy result (0, '', false, null) would
        // otherwise re-run the initializer on every get().
        if (!this.initialized) {
            this.value = this.init();
            this.initialized = true;
        }
        return this.value as T;
    }
}
