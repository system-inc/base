// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { WebSocketInfoKey } from './WebSocketInfoKey';

describe('WebSocketInfoKey', () => {
    it('creates a key with the given name', () => {
        const key = WebSocketInfoKey.create<string>('ws-test-alpha');
        expect(key.name).toBe('ws-test-alpha');
    });

    it('throws on duplicate names', () => {
        WebSocketInfoKey.create<string>('ws-test-dup');
        expect(() => WebSocketInfoKey.create<string>('ws-test-dup')).toThrow(
            /Duplicate WebSocketInfoKey "ws-test-dup"/,
        );
    });
});
