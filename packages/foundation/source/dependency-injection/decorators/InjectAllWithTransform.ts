// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { injectAllWithTransform } from 'tsyringe';

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { toTsyringeToken } from '../../internal/dependency-injection/InjectionTokens';
import { BaseInjectionToken } from '../BaseInjectionToken';

/**
 * Parameter decorator factory that resolves *all* registrations through
 * a transform.
 *
 * @param token The token of the object to be resolved.
 * @param transformer The transform class.
 * @param args Arguments passed to the transform method.
 */
export function InjectAllWithTransform<T = unknown>(
    token: BaseInjectionToken<T>,
    transformer: Constructor<{ transform: (...args: any[]) => unknown }>,
    ...args: unknown[]
): ParameterDecorator {
    return injectAllWithTransform(
        toTsyringeToken(token),
        transformer as Parameters<typeof injectAllWithTransform>[1],
        ...args,
    );
}
