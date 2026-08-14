// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { injectAll } from 'tsyringe';

import { toTsyringeToken } from '../../internal/dependency-injection/InjectionTokens';
import { BaseInjectionToken } from '../BaseInjectionToken';
import { TypedParameterDecorator } from '../TypedParameterDecorator';

/**
 * Parameter decorator factory that resolves *all* registrations for the
 * given token as an array.
 *
 * Accepts `TypedInjectionKey<T>` and any `TypedBinding` subclass in
 * addition to the standard tsyringe token shapes.
 */
export function InjectAll<T = unknown>(
    token: BaseInjectionToken<T>,
): TypedParameterDecorator<T[]> {
    return injectAll(toTsyringeToken(token)) as TypedParameterDecorator<T[]>;
}
