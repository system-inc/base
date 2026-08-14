// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InjectionToken } from 'tsyringe';

import { BaseInjectionContainer } from './BaseInjectionContainer';

/**
 * Helper class for instantiating a type lazily via a container.
 */
export class LazyResolve<T> {
    private value: T | undefined;
    private resolved = false;

    constructor(private readonly token: InjectionToken<T>) {}

    get(container: BaseInjectionContainer): T {
        // Track resolution with a flag, not a truthiness check — a token that
        // resolves to a falsy value (0, '', false, null) would otherwise be
        // re-resolved from the container on every get().
        if (!this.resolved) {
            this.value = container.resolve(this.token);
            this.resolved = true;
        }
        return this.value as T;
    }
}
