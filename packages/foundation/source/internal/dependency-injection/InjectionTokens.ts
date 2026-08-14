// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    DependencyContainer,
    InjectionToken,
    instanceCachingFactory,
} from 'tsyringe';

import { LazyInstance } from '@system-inc/base-common/lazy/LazyInstance';
import { BaseInjectionToken } from '../../dependency-injection/BaseInjectionToken';
import { extractTypeOrTokenFromErrorMessage } from '../../dependency-injection/InjectionErrors';
import { ProviderOptions } from '../../dependency-injection/ProviderOptions';
import { TypedBinding } from '../../dependency-injection/TypedBinding';
import { TypedInjectionKey } from '../../dependency-injection/TypedInjectionKey';
import { getGlobalContainer } from './InjectionContainers';

/**
 * Convert a typed token (`TypedInjectionKey<T>` or any `TypedBinding`
 * subclass) to its underlying string name so tsyringe — which uses
 * reference equality on tokens — sees the same value at registration
 * and resolution sites. Constructor tokens pass through unchanged.
 */
export function toTsyringeToken<T>(
    token: BaseInjectionToken<T>,
): InjectionToken<T> {
    if (token instanceof TypedInjectionKey || token instanceof TypedBinding) {
        return token.toString();
    }
    return token;
}

// A stable, per-identity suffix so two distinct object tokens (e.g. two
// different classes that happen to share a simple name) never collapse to the
// same synthetic @optional()/@lazy() string token and cross-wire. String/
// symbol tokens are already unique by value, so they need no suffix.
const tokenIdentitySuffixes = new WeakMap<object, string>();
let tokenIdentityCounter = 0;

function tokenIdentitySuffix(token: InjectionToken): string {
    if (typeof token !== 'function' && typeof token !== 'object') {
        return '';
    }
    let suffix = tokenIdentitySuffixes.get(token);
    if (suffix === undefined) {
        suffix = `#${++tokenIdentityCounter}`;
        tokenIdentitySuffixes.set(token, suffix);
    }
    return suffix;
}

/**
 * Creates a token that represents an optional dependency.
 * This allows the original token to be mapped to an optional provder.
 *
 * @param token
 * @returns
 */
export function createOptionalToken(token: InjectionToken): string {
    return `@optional(${injectionTokenToString(token)}${tokenIdentitySuffix(token)})`;
}

/**
 * Creates a token that represents a lazy dependency.
 * This allows the original token to be mapped to a lazy provder.
 *
 * @param token
 * @returns
 */
export function createLazyToken(token: InjectionToken): string {
    return `@lazy(${injectionTokenToString(token)}${tokenIdentitySuffix(token)})`;
}

/**
 * Returns a string representation of an InjectionToken.
 *
 * @param token
 * @returns
 */
function injectionTokenToString(token: InjectionToken): string {
    let tokenName = '';
    if (typeof token === 'function') {
        tokenName = token.name;
    } else if (typeof token === 'string' || typeof token === 'symbol') {
        tokenName = token.toString();
    } else {
        throw new Error('DelayedConstructor is not a supported token type');
    }
    return tokenName;
}

/**
 * Registers a factory that won't throw if a token fails to resolve.
 *
 * @param token The token to register for optional resolution.
 * @param options Provider options.
 */
export function registerOptionalFactory(
    optionalToken: string,
    token: InjectionToken,
    resolveOperation: 'resolve' | 'resolveAll',
    options?: ProviderOptions,
) {
    const factory = (dependencyContainer: DependencyContainer) => {
        try {
            return dependencyContainer[resolveOperation](token);
        } catch (e) {
            if (e instanceof Error) {
                const errorType = extractTypeOrTokenFromErrorMessage(e.message);
                // Compare against the token's normalized name. token.toString()
                // for a Constructor is its source code (never the class name),
                // so an unregistered class token would fall through and rethrow
                // instead of returning undefined/[].
                if (errorType === injectionTokenToString(token)) {
                    if (resolveOperation === 'resolveAll') {
                        return [];
                    }
                    return undefined;
                }
            }
            throw e;
        }
    };
    // this is ok because it is strictly wiring up a Provider to a token
    // the actual execution of the provider happens on the correctly scoped container
    // because it is fed into the factory
    getGlobalContainer().register(optionalToken, {
        useFactory:
            options?.factoryType === 'caching'
                ? instanceCachingFactory(factory)
                : factory,
    });
}

export function registerLazyFactory(
    lazyToken: string,
    token: InjectionToken,
    options?: ProviderOptions,
) {
    const factory = (dependencyContainer: DependencyContainer) => {
        return new LazyInstance(() => dependencyContainer.resolve(token));
    };
    // this is ok because it is strictly wiring up a Provider to a token
    // the actual execution of the provider happens on the correctly scoped container
    // because it is fed into the factory
    getGlobalContainer().register(lazyToken, {
        useFactory:
            options?.factoryType === 'caching'
                ? instanceCachingFactory(factory)
                : factory,
    });
}
