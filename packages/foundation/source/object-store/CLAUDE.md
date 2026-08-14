# object-store/ — object storage (R2 / S3)

Blob storage over an S3-compatible interface (currently Cloudflare R2). Buckets are declared once at the worker root and injected by binding — usable directly without the higher-level `FileStorage` module.

## Interface (`ObjectStore`)

`head(key)`, `get(key)`, `put(key, data, options?)`, `delete(key)` (and listing) over `type` (R2 today) + `bucket`. `put` accepts `ReadableStream | ArrayBuffer | ArrayBufferView | Blob | string`; `get`/`head` return stored data + metadata.

## Injecting a store

```ts
class Buckets { static readonly Uploads = new ObjectStoreBinding('UPLOADS') }
constructor(@InjectObjectStore(Buckets.Uploads) private uploads: ObjectStore) {}
```

Same **binding + factory + inject** pattern as the other resource bindings: `ObjectStoreBinding` (a `TypedBinding` matching `wrangler.toml`), `@InjectObjectStore(binding)` resolves through `ObjectStoreFactory`. Cloudflare implementation: `internal/cloudflare/CloudflareObjectStore`.

## Settings (`ObjectStoreSettings`)

`buckets: ObjectStoreBucket[]` (`BaseSettings.objectStore`). Each bucket has `name` + `binding` (both matching `wrangler.toml`) and is either:

- **public** (`PublicObjectStoreBucket`) — requires a domain map (environment → hostname) for serving objects; or
- **private** (`PrivateObjectStoreBucket`) — must not have a domain map.

Declaring buckets here lets them be injected directly; higher-level modules (e.g. FileStorage) also read buckets from this block by name.

## See also

[`key-value-storage/`](../key-value-storage/CLAUDE.md) (the parallel KV binding) · [`dependency-injection/`](../dependency-injection/CLAUDE.md) (`TypedBinding`).
