// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InjectionToken, injectWithTransform } from 'tsyringe';

import { Injectable } from '../../dependency-injection/decorators/Injectable';
import { InjectionTransform } from '../../dependency-injection/InjectionTransform';
import { TypedParameterDecorator } from '../../dependency-injection/TypedParameterDecorator';
import { ObjectStore } from '../ObjectStore';
import { ObjectStoreBinding } from '../ObjectStoreBinding';
import { ObjectStoreFactory } from '../ObjectStoreFactory';

/**
 * Injects an {@link ObjectStore} bound to the bucket declared by the
 * given {@link ObjectStoreBinding}.
 *
 * The bucket must be declared in the worker's `objectStore.buckets`
 * settings and bound in `wrangler.toml`. Consumers can use this
 * decorator without opting into the higher-level `FileStorage` module.
 */
export function InjectObjectStore(
    bucketToken: ObjectStoreBinding,
): TypedParameterDecorator<ObjectStore> {
    return injectWithTransform(
        ObjectStoreFactory,
        ObjectStoreFactoryTransform,
        bucketToken.toString(),
    ) as TypedParameterDecorator<ObjectStore>;
}

@Injectable()
class ObjectStoreFactoryTransform implements InjectionTransform<
    ObjectStoreFactory,
    ObjectStore
> {
    public transform(
        factory: ObjectStoreFactory,
        bucketToken: InjectionToken,
    ): ObjectStore {
        return factory.createObjectStore(bucketToken);
    }
}
