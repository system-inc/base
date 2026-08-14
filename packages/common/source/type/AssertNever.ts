// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Exhaustiveness assertion for `switch` statements over discriminated
 * unions or enums.
 *
 * Used in the `default` arm of a switch that has been written to handle
 * every variant of its input type. The argument's type is `never`, so:
 *
 * - **Compile time:** if a new variant is added to the union and the
 *   switch isn't updated, the call to `assertNever(value)` becomes a
 *   type error — the missing variant prevents `value` from narrowing
 *   to `never`.
 * - **Runtime:** if a value reaches this point anyway (DB row with a
 *   stale enum string, configuration typo, untrusted client input,
 *   `as` cast that lied), it throws instead of silently returning
 *   `undefined` and corrupting downstream logic.
 *
 * Use this on switches whose input crosses a trust boundary
 * (database, network, configuration, client). For switches over
 * purely internal values, the lint rule
 * `@typescript-eslint/switch-exhaustiveness-check` is enough on its
 * own.
 */
export function assertNever(value: never): never {
    throw new Error(
        `Unhandled discriminated union variant: ${JSON.stringify(value)}`,
    );
}
