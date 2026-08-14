// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    ObjectStore,
    ObjectStoreListOptions,
    ObjectStoreListResult,
    ObjectStorePutOptions,
    ObjectStoreType,
    StoredObjectData,
    StoredObjectMetaData,
} from '../../ObjectStore';
import { ObjectStoreBucket } from '../../ObjectStoreSettings';

/**
 * Implementation of the ObjectStore interface for
 * Cloudflare Workers using Cloudflare's R2 storage.
 */
export class CloudflareObjectStore implements ObjectStore {
    readonly type = ObjectStoreType.R2;
    readonly bucket: ObjectStoreBucket;

    private readonly r2: R2Bucket;

    constructor(bucket: ObjectStoreBucket, r2: R2Bucket) {
        this.r2 = r2;
        this.bucket = bucket;
    }

    async head(key: string): Promise<StoredObjectMetaData | null> {
        return await this.r2.head(key);
    }

    async get(
        key: string,
    ): Promise<(StoredObjectData & StoredObjectMetaData) | null> {
        return await this.r2.get(key);
    }

    async put(
        key: string,
        data:
            | ReadableStream
            | ArrayBuffer
            | ArrayBufferView
            | string
            | null
            | Blob,
        options?: ObjectStorePutOptions,
    ): Promise<StoredObjectMetaData | null> {
        return await this.r2.put(key, data, {
            httpMetadata: options?.httpMetadata,
            customMetadata: options?.customMetadata,
            storageClass: options?.storageClass,
        });
    }

    async delete(key: string | string[]): Promise<void> {
        await this.r2.delete(key);
    }

    async list(
        options?: ObjectStoreListOptions,
    ): Promise<ObjectStoreListResult> {
        const result = await this.r2.list(options);
        return {
            objects: result.objects.map((obj) => ({
                key: obj.key,
                version: obj.version,
                size: obj.size,
                etag: obj.etag,
                httpEtag: obj.httpEtag,
                uploaded: obj.uploaded,
            })),
            delimitedPrefixes: result.delimitedPrefixes,
            truncated: result.truncated,
            cursor: result.truncated ? result.cursor : undefined,
        };
    }
}
