// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Branded `ParameterDecorator` that declares the TypeScript type the
 * decorated parameter is expected to resolve to.
 *
 * Used by typed injection decorators (`@Inject`, `@InjectRepository`,
 * `@InjectDurableObjectProvider`, etc.) to express their resolution
 * contract in the type system. The `base/inject-type-matches-parameter`
 * lint rule reads `__resolvedType` off the decorator's call return type
 * and verifies the parameter's TypeScript type is assignable from it.
 *
 * The phantom field is never read at runtime — TypeScript erases it,
 * so a `TypedParameterDecorator<T>` is structurally identical to a
 * `ParameterDecorator` once compiled.
 *
 * Example:
 *
 * ```ts
 * export function InjectRepository<T>(
 *     entity: Constructor<T>,
 * ): TypedParameterDecorator<OrmRepository<T>> {
 *     // ...
 *     return inject(...) as TypedParameterDecorator<OrmRepository<T>>;
 * }
 * ```
 */
export type TypedParameterDecorator<TResolved> = ParameterDecorator & {
    readonly __resolvedType?: TResolved;
};
