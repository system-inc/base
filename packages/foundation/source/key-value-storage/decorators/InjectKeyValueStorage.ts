// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InjectionToken, injectWithTransform } from 'tsyringe';

import { Injectable } from '../../dependency-injection/decorators/Injectable';
import { InjectionTransform } from '../../dependency-injection/InjectionTransform';
import { TypedParameterDecorator } from '../../dependency-injection/TypedParameterDecorator';
import { KeyValueStorage } from '../KeyValueStorage';
import { KeyValueStorageBinding } from '../KeyValueStorageBinding';
import { KeyValueStorageFactory } from '../KeyValueStorageFactory';

/**
 * Injects a KeyValueStorage bound to the KV namespace declared by the
 * given `KeyValueStorageBinding`.
 */
export function InjectKeyValueStorage(
    keyValueStorageToken: KeyValueStorageBinding,
): TypedParameterDecorator<KeyValueStorage> {
    return injectWithTransform(
        KeyValueStorageFactory,
        KeyValueStorageFactoryTransform,
        keyValueStorageToken.toString(),
    ) as TypedParameterDecorator<KeyValueStorage>;
}

@Injectable()
class KeyValueStorageFactoryTransform implements InjectionTransform<
    KeyValueStorageFactory,
    KeyValueStorage
> {
    public transform(
        factory: KeyValueStorageFactory,
        storageToken: InjectionToken,
    ): KeyValueStorage {
        return factory.createKeyValueStorage(storageToken);
    }
}
