// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InjectionToken } from 'tsyringe';

import { BaseEnvironmentKey } from '../configuration/BaseEnvironmentKey';
import { Inject } from '../dependency-injection/decorators/Inject';
import { Injectable } from '../dependency-injection/decorators/Injectable';
import { BaseWorkerContext } from '../worker/BaseWorkerContext';
import { CloudflareObjectStore } from './internal/cloudflare/CloudflareObjectStore';
import { ObjectStore } from './ObjectStore';

/**
 * Factory to create ObjectStore instances bound to specific buckets.
 *
 * Prefer to use the `@InjectObjectStore()` decorator when possible.
 */
@Injectable()
export class ObjectStoreFactory {
    constructor(
        @Inject(BaseWorkerContext)
        private readonly workerContext: BaseWorkerContext,
    ) {}

    /**
     * Resolves an {@link ObjectStore} bound to the bucket identified by
     * `bucketToken` (typically an {@link ObjectStoreBinding} instance, but
     * any DI token that resolves to a bucket name works).
     */
    createObjectStore(bucketToken: InjectionToken): ObjectStore {
        const bucketName = this.resolveBucketName(bucketToken);
        const objectStoreSettings =
            this.workerContext.configuration.objectStore;
        const bucketMetadata = objectStoreSettings?.buckets.find(
            (bucket) => bucket.name === bucketName,
        );

        if (!bucketMetadata) {
            throw new Error(
                `No bucket found with name '${bucketName}'. Did you declare it in the worker's 'objectStore.buckets' settings?`,
            );
        }

        if (this.workerContext.configuration.runtime.platform.isCloudflare) {
            const bucket =
                this.workerContext.configuration.getEnvironmentVariable(
                    BaseEnvironmentKey.create(bucketMetadata.binding),
                );
            if (bucket) {
                return new CloudflareObjectStore(
                    bucketMetadata,
                    bucket as R2Bucket,
                );
            }
            throw new Error(
                `No R2 binding found for bucket '${bucketName}' (binding '${bucketMetadata.binding}'). Did you bind it in wrangler.toml?`,
            );
        }

        throw new Error(
            `ObjectStore is currently not supported by platform: ${this.workerContext.configuration.runtime.platform.type}`,
        );
    }

    /**
     * Checks whether the bucket identified by `bucketToken` is both declared
     * in `objectStore.buckets` and bound in the current worker environment.
     */
    hasBucket(bucketToken: InjectionToken): boolean {
        const bucketName = this.resolveBucketName(bucketToken);
        const bucketMetadata =
            this.workerContext.configuration.objectStore?.buckets.find(
                (bucket) => bucket.name === bucketName,
            );
        if (!bucketMetadata) {
            return false;
        }

        if (this.workerContext.configuration.runtime.platform.isCloudflare) {
            const bucket =
                this.workerContext.configuration.getEnvironmentVariable(
                    BaseEnvironmentKey.create(bucketMetadata.binding),
                );
            return bucket !== undefined;
        }
        return false;
    }

    private resolveBucketName(bucketToken: InjectionToken): string {
        try {
            return this.workerContext.container.resolve(bucketToken);
        } catch (e) {
            return bucketToken.toString();
        }
    }
}
