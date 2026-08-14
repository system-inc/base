// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DependencyContainer, InjectionToken } from 'tsyringe';

import { TypedBinding } from './TypedBinding';
import { TypedInjectionKey } from './TypedInjectionKey';

/**
 * Similar to a tsyringe FactoryFunction, but wrapped in a class.
 * This allows the Provider annotation to automically create the instance
 * when the token is resolved.
 */
export class ObjectFactory<T> {
    private readonly token: InjectionToken<T>;

    constructor(
        token: InjectionToken<T> | TypedInjectionKey<T> | TypedBinding,
    ) {
        this.token =
            token instanceof TypedInjectionKey || token instanceof TypedBinding
                ? token.toString()
                : token;
    }

    createInstance(container: DependencyContainer): T {
        return container.resolve(this.token) as T;
    }
}
