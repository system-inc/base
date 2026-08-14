// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RequestContextKey } from './RequestContextKey';

describe('RequestContextKey', () => {
    it('creates a key with the given name', () => {
        const key = RequestContextKey.create<string>('rc-test-alpha');
        expect(key.name).toBe('rc-test-alpha');
    });

    it('throws on duplicate names', () => {
        RequestContextKey.create<string>('rc-test-dup');
        expect(() => RequestContextKey.create<number>('rc-test-dup')).toThrow(
            /Duplicate RequestContextKey "rc-test-dup"/,
        );
    });
});
