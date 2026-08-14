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
 * Inject an array of optional dependencies.
 *
 * @param token
 * @returns
 */
export function InjectAllOptional<T = unknown>(
    token: BaseInjectionToken<T>,
    options?: ProviderOptions,
): TypedParameterDecorator<T[]> {
    const tsyringeToken = toTsyringeToken(token);
    const optionalToken = createOptionalToken(tsyringeToken);
    registerOptionalFactory(
        optionalToken,
        tsyringeToken,
        'resolveAll',
        options,
    );
    return inject(optionalToken) as TypedParameterDecorator<T[]>;
}
