// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { KeyValueStorageType } from './KeyValueStorage';

export interface KeyValueStorageSettings {
    readonly stores: {
        readonly name: string;
        readonly storageType: KeyValueStorageType;
    }[];
}
