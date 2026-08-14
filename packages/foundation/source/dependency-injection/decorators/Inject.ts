// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { inject } from 'tsyringe';

import { toTsyringeToken } from '../../internal/dependency-injection/InjectionTokens';
import { BaseInjectionToken } from '../BaseInjectionToken';
import { TypedParameterDecorator } from '../TypedParameterDecorator';

/**
 * Parameter decorator factory that allows for interface
 * information to be stored in the constructor's metadata.
 *
 * Accepts a `TypedInjectionKey<T>` in addition to the standard tsyringe
 * `InjectionToken<T>` shapes; the typed key carries the resolved type
 * for static verification by the `base/inject-type-matches-parameter`
 * lint rule.
 */
export function Inject<T = unknown>(
    token: BaseInjectionToken<T>,
): TypedParameterDecorator<T> {
    return inject(toTsyringeToken(token)) as TypedParameterDecorator<T>;
}
