---
title: Key-Value Storage
description: 'Cloudflare KV through a typed store: get, put, list, delete.'
---

KV is Cloudflare's eventually-consistent key-value store — the right tool for caches, feature flags, and read-heavy configuration. Base wraps it in a typed `KeyValueStorage` interface behind the usual binding-and-inject pattern.

## Declare the store

Three names line up on one identity. In `wrangler.toml`:

```toml
[env.Production]
kv_namespaces = [{ binding = "CACHE", id = "<namespace-id>" }]
```

In `settings.ts`:

```ts
import { KeyValueStorageType } from '@system-inc/base-foundation/key-value-storage/KeyValueStorage';

    keyValueStorage: {
        stores: [{ name: 'CACHE', storageType: KeyValueStorageType.CloudflareKV }],
    },
```

The settings `name` **is** the wrangler `binding` — `base check` verifies the pairing exists.

## Inject and use

```ts
import { InjectKeyValueStorage } from '@system-inc/base-foundation/key-value-storage/decorators/InjectKeyValueStorage';
import { KeyValueStorage } from '@system-inc/base-foundation/key-value-storage/KeyValueStorage';
import { KeyValueStorageBinding } from '@system-inc/base-foundation/key-value-storage/KeyValueStorageBinding';

export namespace AppInjections {
    export const Cache = new KeyValueStorageBinding('CACHE');
}

@Injectable()
export class PricingService {
    constructor(
        @InjectKeyValueStorage(AppInjections.Cache)
        private readonly cache: KeyValueStorage,
    ) {}

    async getPriceTable(region: string): Promise<PriceTable> {
        const cached = await this.cache.get<PriceTable>(`prices:${region}`);
        if (cached) {
            return cached;
        }
        const fresh = await this.computePriceTable(region);
        await this.cache.put(`prices:${region}`, fresh, {
            expirationTtl: 3600,
        });
        return fresh;
    }
}
```

The API surface:

- **`get<T>(key)`** → `T | null`. Objects round-trip as JSON; strings as strings.
- **`put(key, value, options?)`** — options: `expirationTtl` (seconds), `expiration` (absolute epoch), `metadata`.
- **`delete(key)`**: single key.
- **`list(options?)`**: `prefix`, `limit`, `cursor`; the result is a discriminated union on `hasMore`, so the `cursor` for the next page only exists when there _is_ a next page:

```ts
const page = await this.cache.list({ prefix: 'prices:', limit: 100 });
if (page.hasMore) {
    const next = await this.cache.list({
        prefix: 'prices:',
        cursor: page.cursor,
    });
}
```

## What KV is and isn't

KV reads are fast and globally cached; writes are **eventually consistent** — a read moments after a write may see the old value, especially in another region. Perfect for caches and configuration; wrong for counters, inventories, or anything transactional — that's the [ORM](../orm/01-define-an-entity.md) or a [Durable Object](./03-durable-objects.md).
