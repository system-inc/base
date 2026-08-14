// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    KeyValueListOptions,
    KeyValueListResult,
    KeyValuePutOptions,
    KeyValueStorage,
} from '../../KeyValueStorage';

export class CloudflareKeyValueStorage implements KeyValueStorage {
    private readonly kvNamespace: KVNamespace;
    constructor(binding: KVNamespace) {
        this.kvNamespace = binding;
    }

    async get<ValueType>(key: string): Promise<ValueType | null> {
        const value = await this.kvNamespace.get(key);
        // Cloudflare KV returns null only for a missing key; a stored empty
        // string comes back as '""'. Distinguishing on `=== null` keeps a
        // stored empty string from masquerading as absent.
        if (value === null) {
            return null;
        }
        // Values are always JSON-encoded on put(), so parsing is unambiguous:
        // a stored string "42" round-trips as the string "42", not the number.
        return JSON.parse(value) as ValueType;
    }

    async list<ListKeyType = KVNamespaceListKey<unknown, string>>(
        options?: KeyValueListOptions,
    ): Promise<KeyValueListResult<ListKeyType>> {
        const listResult = await this.kvNamespace.list(options);
        if (listResult.list_complete) {
            return {
                hasMore: false,
                keys: listResult.keys as ListKeyType[],
                cacheStatus: listResult.cacheStatus,
            };
        } else {
            return {
                hasMore: true,
                keys: listResult.keys as ListKeyType[],
                cursor: listResult.cursor,
                cacheStatus: listResult.cacheStatus,
            };
        }
    }

    async put<ValueType>(
        key: string,
        value: ValueType,
        options?: KeyValuePutOptions | undefined,
    ): Promise<void> {
        // Always JSON-encode (including strings), so get() can always parse
        // and the string/object round-trip is injective — storing a string
        // like "42" or "true" must not read back as a number or boolean.
        await this.kvNamespace.put(key, JSON.stringify(value), options);
    }

    async delete(key: string): Promise<void> {
        await this.kvNamespace.delete(key);
    }
}
