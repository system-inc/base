// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { inject } from 'tsyringe';

import {
    createOptionalToken,
    registerOptionalFactory,
    toTsyringeToken,
} from '../../internal/dependency-injection/InjectionTokens';
import { BaseInjectionToken } from '../BaseInjectionToken';
import { ProviderOptions } from '../ProviderOptions';
import { TypedParameterDecorator } from '../TypedParameterDecorator';

/**
 * Inject an optional dependency.
 *
 * @param token
 * @returns
 */
export function InjectOptional<T = unknown>(
    token: BaseInjectionToken<T>,
    options?: ProviderOptions,
): TypedParameterDecorator<T | undefined> {
    const tsyringeToken = toTsyringeToken(token);
    const optionalToken = createOptionalToken(tsyringeToken);
    registerOptionalFactory(optionalToken, tsyringeToken, 'resolve', options);
    return inject(optionalToken) as TypedParameterDecorator<T | undefined>;
}
