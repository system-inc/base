// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InjectionToken } from 'tsyringe';

import { BaseInjectionContainer } from './BaseInjectionContainer';
import { LazyResolve } from './LazyResolve';

function fakeContainer(resolve: (token: unknown) => unknown) {
    return { resolve } as unknown as BaseInjectionContainer;
}

describe('LazyResolve', () => {
    it('resolves once and caches the instance', () => {
        let calls = 0;
        const container = fakeContainer(() => {
            calls++;
            return { id: calls };
        });
        const lazy = new LazyResolve<object>('token' as InjectionToken<object>);
        const first = lazy.get(container);
        const second = lazy.get(container);
        expect(first).toBe(second);
        expect(calls).toBe(1);
    });

    it('does not re-resolve a token whose value is falsy', () => {
        let calls = 0;
        const container = fakeContainer(() => {
            calls++;
            return 0;
        });
        const lazy = new LazyResolve<number>('n' as InjectionToken<number>);
        expect(lazy.get(container)).toBe(0);
        expect(lazy.get(container)).toBe(0);
        // before the fix a falsy resolution re-hit the container every get()
        expect(calls).toBe(1);
    });
});
