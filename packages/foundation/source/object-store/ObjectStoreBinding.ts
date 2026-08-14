// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TypedBinding } from '../dependency-injection/TypedBinding';

/**
 * Binding for a Cloudflare R2 bucket. The name matches the binding
 * declared in `wrangler.toml`. Used with `@InjectObjectStore(...)`.
 */
export class ObjectStoreBinding extends TypedBinding {
    declare private readonly __objectStore: 'ObjectStore';
}
