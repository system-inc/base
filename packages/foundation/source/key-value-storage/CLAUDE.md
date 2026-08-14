# key-value-storage/ — KV storage

A simple no-SQL key/value store for fast reads/writes (Cloudflare KV), distinct from the SQL ORM. Declared per worker, injected by binding.

## Interface (`KeyValueStorage`)

`get(key)`, `put(key, value, options?)`, `delete(key)`, `list(options?)`. Values are `string | object`. `put` options: `expiration`, `expirationTtl`, `metadata`. `list` options: `limit`, `prefix`, `cursor` → a paginated `KeyValueListResult` (`hasMore` + `keys` + `cursor`). `KeyValueStorageType` enumerates the backends.

## Injecting a store

```ts
class Stores { static readonly Sessions = new KeyValueStorageBinding('SESSIONS') }
constructor(@InjectKeyValueStorage(Stores.Sessions) private sessions: KeyValueStorage) {}
```

Same **binding + factory + inject** pattern used across the framework's external-resource bindings: `KeyValueStorageBinding` (a `TypedBinding` whose name matches `wrangler.toml`), `@InjectKeyValueStorage(binding)` resolves through `KeyValueStorageFactory` (via an `injectWithTransform`). The Cloudflare implementation is `internal/cloudflare/CloudflareKeyValueStorage`.

## Settings (`KeyValueStorageSettings`)

`stores: { name, storageType }[]` — declare the KV namespaces the worker can access (`BaseSettings.keyValueStorage`).

## See also

[`object-store/`](../object-store/CLAUDE.md) (the parallel R2/blob-storage binding) · [`dependency-injection/`](../dependency-injection/CLAUDE.md) (`TypedBinding`).
