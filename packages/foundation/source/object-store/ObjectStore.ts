// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ObjectStoreBucket } from './ObjectStoreSettings';

/**
 * Interface to an Object Store, e.g. S3, GCS, R2, etc.
 * Using an S3 compatible interface.
 */
export interface ObjectStore {
    /**
     * The type of store. Could be S3, GCS, R2, etc.
     *
     * Currently only R2 is supported.
     */
    readonly type: ObjectStoreType;

    /**
     * The bucket backing this store.
     */
    readonly bucket: ObjectStoreBucket;

    /**
     * Retrieves the metadata for the object with the given key.
     *
     * @param key
     */
    head(key: string): Promise<StoredObjectMetaData | null>;

    /**
     * Retrieves the object with the given key.
     *
     * @param key
     */
    get(key: string): Promise<(StoredObjectData & StoredObjectMetaData) | null>;

    /**
     * Adds the given data to the store with the given key.
     *
     * @param key
     * @param data
     * @param options
     */
    put(
        key: string,
        data: ReadableStream | ArrayBuffer | ArrayBufferView | Blob | string,
        options?: ObjectStorePutOptions,
    ): Promise<StoredObjectMetaData | null>;

    /**
     * Deletes the object with the given key.
     *
     * @param key
     */
    delete(key: string | string[]): Promise<void>;

    /**
     * Lists objects in the store matching the given options.
     * Supports prefix filtering and delimiter-based folder browsing.
     *
     * When a delimiter is provided (typically '/'), the result includes
     * `delimitedPrefixes` — virtual folder paths at the current level.
     *
     * @param options
     */
    list(options?: ObjectStoreListOptions): Promise<ObjectStoreListResult>;
}

/**
 * Options for listing objects in the store.
 */
export interface ObjectStoreListOptions {
    /**
     * Maximum number of objects to return. Default varies by provider (R2: 1000).
     */
    limit?: number;

    /**
     * Only return objects whose keys start with this prefix.
     */
    prefix?: string;

    /**
     * Opaque token for pagination. Use the `cursor` from a
     * previous truncated result to fetch the next page.
     */
    cursor?: string;

    /**
     * Character used to group keys into virtual folders.
     * Typically '/'. When set, results include `delimitedPrefixes`
     * for keys that share a common prefix up to the delimiter.
     */
    delimiter?: string;

    /**
     * Only return objects whose keys are lexicographically after this value.
     */
    startAfter?: string;
}

/**
 * The result of a list operation.
 */
export interface ObjectStoreListResult {
    /**
     * The objects matching the list query.
     */
    objects: StoredObjectMetaData[];

    /**
     * Virtual folder prefixes when a delimiter is used.
     * For example, with prefix='photos/' and delimiter='/',
     * this might contain ['photos/2025/', 'photos/2026/'].
     */
    delimitedPrefixes: string[];

    /**
     * Whether there are more results beyond this page.
     */
    truncated: boolean;

    /**
     * Opaque cursor for fetching the next page.
     * Only present when `truncated` is true.
     */
    cursor?: string;
}

/**
 * The data of a stored object. It could be stored in
 * a variety of formats, e.g. binary, text, json, etc.
 */
export interface StoredObjectData {
    get body(): ReadableStream;
    get bodyUsed(): boolean;
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    json<T>(): Promise<T>;
    blob(): Promise<Blob>;
}

/**
 * Metadata about a stored object.
 */
export interface StoredObjectMetaData {
    readonly key: string;
    readonly version: string;
    readonly size: number;
    readonly etag: string;
    readonly httpEtag: string;
    readonly uploaded: Date;
}

/**
 * Options for the `put()` method.
 */
export interface ObjectStorePutOptions {
    httpMetadata?: ObjectStoreHttpMetadata;
    customMetadata?: Record<string, string>;
    storageClass?: 'Standard' | 'InfrequentAccess';
}

/**
 * HTTP metadata to associate with the stored object.
 * These are returned as HTTP headers when the object is fetched.
 */
export interface ObjectStoreHttpMetadata {
    contentType?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    contentLanguage?: string;
    cacheControl?: string;
    cacheExpiry?: Date;
}

/**
 * The type of store. Could be S3, GCS, R2, etc.
 */
export enum ObjectStoreType {
    R2 = 'R2',
    Stub = 'Stub',
    // S3 = "S3",
    // GCS = "GCS",
}
