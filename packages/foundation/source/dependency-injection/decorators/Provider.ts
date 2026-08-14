// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { DependencyContainer, instanceCachingFactory } from 'tsyringe';

import { DecoratorRegistry } from '@system-inc/base-common/decorator/DecoratorRegistry';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { getGlobalContainer } from '../../internal/dependency-injection/InjectionContainers';
import { toTsyringeToken } from '../../internal/dependency-injection/InjectionTokens';
import { BaseInjectionToken } from '../BaseInjectionToken';
import { ObjectFactory } from '../ObjectFactory';
import { ProviderOptions } from '../ProviderOptions';
import { TypedMethodDecorator } from '../TypedMethodDecorator';

/**
 * The `DecoratorRegistry` mark applied to the host class of a method
 * decorated with `@Provider` — so a provider host listed in a `services`
 * array is recognized as intentionally loadable.
 */
export const ProviderDecoratorName = 'Provider';

/**
 * Registers the decorated method as a provider for the specified token.
 *
 * When the token is resolved, the method will be called and the result will be returned.
 *
 * @param token
 * @param options
 * @returns
 */
export function Provider<T = unknown>(
    token: BaseInjectionToken<T>,
    options?: ProviderOptions,
): TypedMethodDecorator<T | ObjectFactory<T> | undefined> {
    const decorator: MethodDecorator = (
        target: object,
        propertyKey: string | symbol,
        _descriptor: PropertyDescriptor,
    ) => {
        // Mark the host class so a provider listed in a `services` array is
        // recognized as intentionally loadable. `target` is the prototype
        // for instance methods and the constructor itself for static ones.
        const host = (
            typeof target === 'function' ? target : target.constructor
        ) as Constructor<object>;
        DecoratorRegistry.get().mark(host, ProviderDecoratorName);
        // create the factory method that will be used to resolve the dependency
        const factory = (dependencyContainer: DependencyContainer) => {
            let providerResult: unknown;
            // determine if the method being decorated is a static method or an instance method
            const isInstanceMethod =
                typeof target.constructor.prototype[propertyKey] === 'function';
            if (isInstanceMethod) {
                // get the instance of the class from the DI container and call the method
                const targetInstance = dependencyContainer.resolve(
                    target.constructor as Constructor<any>,
                );
                providerResult = targetInstance[propertyKey]();
            } else {
                // call the static method
                providerResult = (target as any)[propertyKey]();
            }

            if (providerResult instanceof ObjectFactory) {
                return providerResult.createInstance(dependencyContainer);
            } else {
                return providerResult;
            }
        };
        // this is ok because it is strictly wiring up a Provider to a token
        // the actual execution of the provider happens on the correctly scoped container
        // because it is fed into the factory.
        getGlobalContainer().register(toTsyringeToken(token), {
            // if the factoryType is caching, then wrap the factory in a caching factory
            useFactory:
                options?.factoryType === 'caching'
                    ? instanceCachingFactory(factory)
                    : factory,
        });
    };
    return decorator as TypedMethodDecorator<T | ObjectFactory<T> | undefined>;
}
