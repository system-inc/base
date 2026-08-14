// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { TypedBinding } from './TypedBinding';
import { TypedInjectionKey } from './TypedInjectionKey';

/**
 * The set of token shapes accepted by Base's typed injection decorators
 * (`@Inject`, `@Provider`, `@InjectAll`, `@InjectAllOptional`, etc.).
 *
 * Bare strings and symbols are intentionally excluded — every DI token
 * must carry static type information either through a class constructor
 * (resolves to the instance type), a `TypedInjectionKey<T>`, or a
 * `TypedBinding` subclass (e.g. `DurableObjectBinding<T>`).
 *
 * If you need to interop with tsyringe at the raw container level
 * (`container.register('SomeString', ...)`), that path stays open —
 * just call `.toString()` on a `TypedInjectionKey` / `TypedBinding`
 * to get the underlying string token.
 */
export type BaseInjectionToken<T = unknown> =
    | Constructor<T>
    | TypedInjectionKey<T>
    | TypedBinding;
