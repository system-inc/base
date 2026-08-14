---
title: Object Storage
description: 'R2 buckets through a typed store: upload, download, and list with folder semantics.'
---

Object storage holds files: uploads, generated assets, exports. Base wraps R2 in a typed `ObjectStore` with the same declare-bind-inject shape as every other resource.

## Declare the bucket

In `wrangler.toml` — note R2 has **two** names, the bucket and its binding:

```toml
[env.Production]
r2_buckets = [{ binding = "UPLOADS", bucket_name = "app-uploads" }]
```

In `settings.ts`, mirror both, and declare visibility:

```ts
    objectStore: {
        buckets: [
            {
                name: 'app-uploads',      // wrangler bucket_name
                binding: 'UPLOADS',       // wrangler binding
                domains: { '@default': 'https://cdn.example.com' },
            },
        ],
    },
```

A **public** bucket requires its `domains` map (environment → public hostname). A **private** bucket declares `privateBucket: true` instead, and the types then forbid `domains` entirely, so the "private bucket with a public URL" mistake doesn't compile.

## Inject and use

```ts
import { InjectObjectStore } from '@system-inc/base-foundation/object-store/decorators/InjectObjectStore';
import { ObjectStore } from '@system-inc/base-foundation/object-store/ObjectStore';
import { ObjectStoreBinding } from '@system-inc/base-foundation/object-store/ObjectStoreBinding';

export namespace AppInjections {
    export const Uploads = new ObjectStoreBinding('UPLOADS');
}

@Injectable()
export class ReportService {
    constructor(
        @InjectObjectStore(AppInjections.Uploads)
        private readonly uploads: ObjectStore,
    ) {}

    async storeReport(id: string, csv: string): Promise<void> {
        await this.uploads.put(`reports/${id}.csv`, csv, {
            httpMetadata: { contentType: 'text/csv' },
        });
    }

    async readReport(id: string): Promise<string | null> {
        const object = await this.uploads.get(`reports/${id}.csv`);
        return object ? await object.text() : null;
    }
}
```

The surface:

- **`put(key, data, options?)`**: data as string, Blob, ArrayBuffer, or ReadableStream (streams pass through unbuffered); options carry `httpMetadata` (content type etc.), `customMetadata`, and `storageClass`.
- **`get(key)`** → object data + metadata, readable as `body` (stream), `text()`, `json<T>()`, `arrayBuffer()`, or `blob()`; **`head(key)`** for metadata only.
- **`delete(key | key[])`**: accepts an array for bulk deletion.
- **`list(options?)`** — `prefix` + `cursor` paging, plus `delimiter` for folder-style browsing: with `delimiter: '/'`, the result's `delimitedPrefixes` are the "subfolders" at that level.

```ts
const page = await this.uploads.list({ prefix: 'reports/', delimiter: '/' });
// page.objects → files at this level; page.delimitedPrefixes → "folders"
```

## Choosing a store

Objects are for **payloads** — things with a size and a content type. Keep the _reference_ (key, size, owner) in the [database](../orm/01-define-an-entity.md), the _bytes_ in the bucket, and hand public files out via the bucket's domain rather than proxying them through your worker.
