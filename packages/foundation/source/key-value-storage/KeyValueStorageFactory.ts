// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InjectionToken } from 'tsyringe';

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { BaseEnvironmentKey } from '../configuration/BaseEnvironmentKey';
import { Inject } from '../dependency-injection/decorators/Inject';
import { Injectable } from '../dependency-injection/decorators/Injectable';
import { BaseWorkerContext } from '../worker/BaseWorkerContext';
import { CloudflareKeyValueStorage } from './internal/cloudflare/CloudflareKeyValueStorage';
import { KeyValueStorage, KeyValueStorageType } from './KeyValueStorage';

@Injectable()
export class KeyValueStorageFactory {
    constructor(
        @Inject(BaseWorkerContext)
        private readonly workerContext: BaseWorkerContext,
    ) {}

    createKeyValueStorage(storageToken: InjectionToken): KeyValueStorage {
        let storageName: string;
        try {
            storageName = this.workerContext.container.resolve(storageToken);
        } catch (e) {
            storageName = storageToken.toString();
        }

        const storageSettings =
            this.workerContext.configuration.keyValueStorage?.stores.find(
                (storage) => storage.name === storageName,
            );
        if (!storageSettings) {
            throw new Error(
                `KeyValueStorage not found: ${storageName}. Did you specify it in your settings?`,
            );
        }

        switch (storageSettings.storageType) {
            case KeyValueStorageType.CloudflareKV: {
                if (
                    !this.workerContext.configuration.runtime.platform
                        .isCloudflare
                ) {
                    throw new Error(
                        `KeyValueStorage type expect [${storageSettings.storageType}] but platform is: ${this.workerContext.configuration.runtime.platform.type}`,
                    );
                }

                const binding =
                    this.workerContext.configuration.getEnvironmentVariable(
                        BaseEnvironmentKey.create(storageName),
                    );
                if (!this.isKVNamespace(binding)) {
                    const errMsg = `No binding found for storage: ${storageName}, do you forget to set it in the configuration file?`;
                    Logger.error(LogCategory.KeyValueStorage, errMsg);
                    throw new Error(errMsg);
                }
                return new CloudflareKeyValueStorage(binding);
            }
            default: {
                throw new Error(
                    `KeyValueStorage type not supported: ${storageSettings.storageType}`,
                );
            }
        }
    }

    private isKVNamespace(binding: unknown): binding is KVNamespace {
        return (
            typeof binding === 'object' &&
            binding !== null &&
            'get' in binding &&
            'put' in binding &&
            'list' in binding &&
            'delete' in binding &&
            'getWithMetadata' in binding
        );
    }
}
