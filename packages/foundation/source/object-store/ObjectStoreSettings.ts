// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { NamedConfiguration } from '@system-inc/base-common/configuration/NamedConfiguration';

/**
 * Worker-level settings for object storage (R2 / S3-compatible buckets).
 *
 * Buckets are declared once here at the worker root and can be consumed
 * directly via {@link InjectObjectStore} without opting into the full
 * `FileStorage` module. Higher-level modules (FileStorage, etc.) read
 * buckets from this settings block by name.
 */
export interface ObjectStoreSettings {
    /**
     * The R2/S3 buckets available to this worker.
     */
    readonly buckets: ReadonlyArray<ObjectStoreBucket>;
}

/**
 * A bucket configuration. Public buckets require a domain map; private
 * buckets must not have one.
 */
export type ObjectStoreBucket =
    | PublicObjectStoreBucket
    | PrivateObjectStoreBucket;

interface ObjectStoreBucketBase {
    /**
     * The name of the bucket. Should match 'bucket_name' in wrangler.toml.
     */
    readonly name: string;

    /**
     * The binding name for the bucket. Should match 'binding' in wrangler.toml.
     */
    readonly binding: string;
}

/**
 * A public bucket with a required domain map (environment → hostname).
 */
export interface PublicObjectStoreBucket extends ObjectStoreBucketBase {
    readonly privateBucket?: false;

    /**
     * Domain map for public buckets (environment → hostname).
     */
    readonly domains: NamedConfiguration<string>;
}

/**
 * A private bucket (no public URL). Domains are not allowed.
 */
export interface PrivateObjectStoreBucket extends ObjectStoreBucketBase {
    readonly privateBucket: true;
    readonly domains?: never;
}
