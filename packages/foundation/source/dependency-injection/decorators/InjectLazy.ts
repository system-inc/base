// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { inject } from 'tsyringe';

import { LazyInstance } from '@system-inc/base-common/lazy/LazyInstance';
import {
    createLazyToken,
    registerLazyFactory,
    toTsyringeToken,
} from '../../internal/dependency-injection/InjectionTokens';
import { BaseInjectionToken } from '../BaseInjectionToken';
import { ProviderOptions } from '../ProviderOptions';
import { TypedParameterDecorator } from '../TypedParameterDecorator';

/**
 * Inject a lazy dependency.
 *
 * @param token
 * @returns
 */
export function InjectLazy<T = unknown>(
    token: BaseInjectionToken<T>,
    options?: ProviderOptions,
): TypedParameterDecorator<LazyInstance<T>> {
    const tsyringeToken = toTsyringeToken(token);
    const lazyToken = createLazyToken(tsyringeToken);
    registerLazyFactory(lazyToken, tsyringeToken, options);
    return inject(lazyToken) as TypedParameterDecorator<LazyInstance<T>>;
}
