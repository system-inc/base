// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { injectWithTransform } from 'tsyringe';

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { toTsyringeToken } from '../../internal/dependency-injection/InjectionTokens';
import { BaseInjectionToken } from '../BaseInjectionToken';

/**
 * Parameter decorator factory that resolves a token through a transform
 * before injection.
 *
 * @param token The token of the object to be resolved.
 * @param transformer The transform class.
 * @param args Arguments passed to the transform method.
 */
export function InjectWithTransform<T = unknown>(
    token: BaseInjectionToken<T>,
    transformer: Constructor<{ transform: (...args: any[]) => unknown }>,
    ...args: unknown[]
): ParameterDecorator {
    return injectWithTransform(
        toTsyringeToken(token),
        transformer as Parameters<typeof injectWithTransform>[1],
        ...args,
    );
}
