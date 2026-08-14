// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LazyInstance } from './LazyInstance';

describe('LazyInstance', () => {
    it('initializes once and caches the value', () => {
        let calls = 0;
        const lazy = new LazyInstance(() => {
            calls++;
            return { id: calls };
        });
        const first = lazy.get();
        const second = lazy.get();
        expect(first).toBe(second);
        expect(calls).toBe(1);
    });

    it('does not re-run the initializer for a falsy value', () => {
        for (const falsy of [0, '', false, null] as const) {
            let calls = 0;
            const lazy = new LazyInstance<typeof falsy>(() => {
                calls++;
                return falsy;
            });
            expect(lazy.get()).toBe(falsy);
            expect(lazy.get()).toBe(falsy);
            // before the fix a falsy cache re-ran init on every get()
            expect(calls).toBe(1);
        }
    });
});
