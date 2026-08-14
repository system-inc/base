// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Structural match of tsyringe's `Transform` interface, used with
 * `injectWithTransform`. tsyringe declares it only under
 * `dist/typings/types/transform.d.ts` and never re-exports it from its public
 * entry, so we redeclare the (trivial) shape here rather than deep-import its
 * internal typings.
 */
export interface InjectionTransform<TIn, TOut> {
    transform: (incoming: TIn, ...args: any[]) => TOut;
}
