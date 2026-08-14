// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TypedKey } from './TypedKey';

class TestKey<T> extends TypedKey<T, 'test'> {
    static create<T>(name: string): TestKey<T> {
        return new TestKey<T>(name);
    }
}

describe('TypedKey', () => {
    it('stores the name', () => {
        expect(TestKey.create<string>('alpha').name).toBe('alpha');
    });

    it('permits duplicate names at the base level', () => {
        // TypedKey itself does not enforce uniqueness — subclasses that
        // write to keyed stores (RequestContextKey, WebSocketInfoKey)
        // do that themselves. Subclasses that read from shared stores
        // (BaseEnvironmentKey, BaseModuleKey) allow duplicates because
        // repeated lookups with the same name are benign and sometimes
        // required (dynamic bindings).
        expect(() => TestKey.create<string>('shared')).not.toThrow();
        expect(() => TestKey.create<string>('shared')).not.toThrow();
    });
});
