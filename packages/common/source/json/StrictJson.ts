// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * A JSON value type for strict validation (no index signature inheritance).
 */
export type StrictJsonValue =
    | string
    | number
    | boolean
    | null
    | StrictJsonValue[]
    | readonly StrictJsonValue[]
    | { [key: string]: StrictJsonValue | undefined };

/**
 * Helper type that checks if all properties of T are JSON-serializable.
 * Used as a constraint for StrictJsonInterface.
 */
type JsonCompatible<T> = {
    [K in keyof T]: T[K] extends StrictJsonValue | undefined ? T[K] : never;
};

/**
 * Validates that all properties of T are JSON-serializable.
 * Errors at the type definition if any property is not JSON-compatible.
 *
 * Unlike `extends JsonObject`, this does NOT add an index signature,
 * so only your explicitly defined keys are allowed.
 *
 * @example
 * ```typescript
 * // Valid - all values are JSON-compatible:
 * export type UserData = StrictJsonInterface<{
 *     name: string;
 *     age: number;
 *     tags: string[];
 * }>;
 *
 * // Error at type definition - Date is not JSON-serializable:
 * export type BadData = StrictJsonInterface<{
 *     name: string;
 *     created: Date; // Error: Type '{ ... }' does not satisfy the constraint...
 * }>;
 * ```
 */
export type StrictJsonInterface<T extends JsonCompatible<T>> = T;
