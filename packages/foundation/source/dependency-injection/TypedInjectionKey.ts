// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Typed wrapper for an injection token. Carries the type that the token
 * resolves to so `@Inject(...)` parameter types can be statically verified
 * to match the registered type.
 *
 * Use as a static member of an `*Injections` class:
 *
 * ```ts
 * export class GridInjections {
 *     static readonly AccessKeySecret =
 *         new TypedInjectionKey<Secret<string>>(
 *             'GridInjections.AccessKeySecret',
 *         );
 * }
 *
 * // Provider
 * @Provider(GridInjections.AccessKeySecret)
 * static getAccessKeySecret(): Secret<string> { ... }
 *
 * // Consumer
 * constructor(
 *     @Inject(GridInjections.AccessKeySecret)
 *     private readonly secret: Secret<string>, // ← type checked by lint
 * ) {}
 * ```
 *
 * At runtime, instances are valid tsyringe tokens — tsyringe's container
 * uses reference equality for token lookup, so the same `TypedInjectionKey`
 * instance must be passed at both registration and injection sites.
 */
export class TypedInjectionKey<T = unknown> {
    /**
     * Phantom field — captures `T` in the type system so
     * `TypedInjectionKey<A>` and `TypedInjectionKey<B>` are structurally
     * distinct. Never read; never written; not emitted at runtime.
     */
    declare private readonly __resolvedType: T;

    constructor(public readonly name: string) {}

    toString(): string {
        return this.name;
    }
}
