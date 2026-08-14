// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TypedBinding } from '../dependency-injection/TypedBinding';

/**
 * Binding for a Cloudflare KV namespace. The name matches the binding
 * declared in `wrangler.toml`. Used with
 * `@InjectKeyValueStorage(...)`.
 */
export class KeyValueStorageBinding extends TypedBinding {
    declare private readonly __keyValueStorage: 'KeyValueStorage';
}
