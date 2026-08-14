// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * A single validation failure at a specific location within the
 * validated value.
 *
 * Errors are flat — each entry identifies the exact path (property or
 * array index chain) where one or more rules rejected the value.
 * Multiple failed rules on the same path are merged into `constraints`
 * under their rule names.
 */
export interface ValidationError {
    /**
     * Dotted / bracketed path to the failing value from the root.
     *
     * Examples:
     * - `"email"` — top-level property
     * - `"address.postalCode"` — nested property
     * - `"items[2].sku"` — array element, nested property
     */
    readonly path: string;

    /**
     * The value that failed validation. Kept for error rendering;
     * may be `undefined` if the property was missing.
     */
    readonly value: unknown;

    /**
     * Map of failed rule name → human-readable message.
     *
     * Multiple entries mean multiple rules on the same property failed.
     */
    readonly constraints: Readonly<Record<string, string>>;
}
