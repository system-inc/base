// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Branded `MethodDecorator` that declares the TypeScript type the
 * decorated method is expected to return.
 *
 * Used by `@Provider` to express its registration contract: the value
 * the method produces is what gets stored under the DI token. The
 * `base/provider-return-matches-token` lint rule reads
 * `__expectedReturnType` off the decorator's call return type and
 * verifies the method's declared return type is assignable to it.
 *
 * The phantom field is never read at runtime — TypeScript erases it,
 * so a `TypedMethodDecorator<T>` is structurally identical to a
 * `MethodDecorator` once compiled.
 *
 * Example:
 *
 * ```ts
 * export function Provider<T>(
 *     token: BaseInjectionToken<T>,
 * ): TypedMethodDecorator<T | ObjectFactory<T> | undefined> {
 *     // ...
 * }
 * ```
 */
export type TypedMethodDecorator<TExpectedReturn> = MethodDecorator & {
    readonly __expectedReturnType?: TExpectedReturn;
};
