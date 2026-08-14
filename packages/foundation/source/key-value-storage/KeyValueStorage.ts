// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export interface KeyValueListOptions {
    limit?: number;
    prefix?: string | null;
    cursor?: string | null;
}

export interface KeyValuePutOptions {
    expiration?: number;
    expirationTtl?: number;
    metadata?: object | null;
}

export type KeyValueListResult<KeyType = unknown> =
    | {
          hasMore: true;
          keys: KeyType[];
          cursor: string;
          cacheStatus: string | null;
      }
    | {
          hasMore: false;
          keys: KeyType[];
          cacheStatus: string | null;
      };

export type StorageValueSupportedTypes = string | object;

/**
 * Key-Value storage is different from the database in base, database would expect to be a SQL database,
 * while key-value storage is a simple no-SQL storage, expecting to have fast read and write operations.
 */
export interface KeyValueStorage {
    get<ValueType = StorageValueSupportedTypes>(
        key: string,
    ): Promise<ValueType | null>;

    list<ListKeyType = unknown>(
        options?: KeyValueListOptions,
    ): Promise<KeyValueListResult<ListKeyType>>;

    put<ValueType = StorageValueSupportedTypes>(
        key: string,
        value: ValueType,
        options?: KeyValuePutOptions,
    ): Promise<void>;

    delete(key: string): Promise<void>;
}

export enum KeyValueStorageType {
    CloudflareKV = 'CloudflareKV',
}
