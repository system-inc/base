// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { CloudflareKeyValueStorage } from './CloudflareKeyValueStorage';

// In-memory stand-in that mirrors Cloudflare KV: get() returns the stored
// string, or null only for a missing key.
class FakeKvNamespace {
    private readonly store = new Map<string, string>();
    get(key: string): Promise<string | null> {
        return Promise.resolve(
            this.store.has(key) ? this.store.get(key)! : null,
        );
    }
    put(key: string, value: string): Promise<void> {
        this.store.set(key, value);
        return Promise.resolve();
    }
    delete(key: string): Promise<void> {
        this.store.delete(key);
        return Promise.resolve();
    }
}

function makeStorage(): CloudflareKeyValueStorage {
    return new CloudflareKeyValueStorage(
        new FakeKvNamespace() as unknown as KVNamespace,
    );
}

describe('CloudflareKeyValueStorage', () => {
    it('round-trips JSON-looking strings as strings, not parsed values', async () => {
        const kv = makeStorage();
        await kv.put('num', '42');
        await kv.put('bool', 'true');
        await kv.put('json', '{"a":1}');
        await kv.put('plain', 'hello');

        expect(await kv.get('num')).toBe('42');
        expect(await kv.get('bool')).toBe('true');
        expect(await kv.get('json')).toBe('{"a":1}');
        expect(await kv.get('plain')).toBe('hello');
    });

    it('distinguishes a stored empty string and the literal "null" from a missing key', async () => {
        const kv = makeStorage();
        await kv.put('empty', '');
        await kv.put('nullish', 'null');

        expect(await kv.get('empty')).toBe('');
        expect(await kv.get('nullish')).toBe('null');
        // a genuinely absent key is the only thing that returns null
        expect(await kv.get('missing')).toBeNull();
    });

    it('round-trips objects', async () => {
        const kv = makeStorage();
        await kv.put('obj', { a: 1, b: ['x', 'y'] });
        expect(await kv.get('obj')).toEqual({ a: 1, b: ['x', 'y'] });
    });
});
