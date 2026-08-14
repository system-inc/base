// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Options controlling how {@link uniqueTestId} formats its output.
 */
export interface UniqueTestIdOptions {
    /**
     * Character placed between the prefix and the random suffix (and,
     * in the default format, between the timestamp and random parts).
     * Defaults to `-`. Pass `_` for usernames where `-` is not a valid
     * character.
     */
    readonly separator?: string;

    /**
     * Maximum total length of the generated id. When set, the helper
     * switches to a compact format that drops the timestamp partition
     * and uses random hex from `crypto.randomUUID()` truncated to fill
     * the remaining budget.
     *
     * Use this when the consuming field has a tight length validator
     * (e.g. a `varchar(16)` identifier column). With ~10 hex chars of
     * entropy collisions are vanishingly unlikely even without the
     * per-millisecond partitioning.
     */
    readonly maxLength?: number;
}

/**
 * Generates a unique identifier for use in integration tests that hit a
 * persistent database.
 *
 * Why: tests accumulate rows over time. A pure `Math.random() * 1_000_000`
 * suffix collides via birthday paradox after enough runs, surfacing as
 * spurious "already taken" / unique-constraint failures. Combining the
 * current epoch with a random number partitions the namespace per
 * millisecond, so collisions require both a same-ms concurrent run AND
 * the same random draw.
 *
 * Default format: `${prefix}${sep}${epochMs}${sep}${rand}` — roughly
 * 25 characters with a `-` separator. Use {@link UniqueTestIdOptions.maxLength}
 * when the consuming field can't fit that much.
 *
 * @param prefix Text to prepend (e.g. `'test'`, `'testorg'`, `'qtest'`).
 * @param options See {@link UniqueTestIdOptions}.
 */
export function uniqueTestId(
    prefix: string,
    options: UniqueTestIdOptions = {},
): string {
    const separator = options.separator ?? '-';

    if (options.maxLength !== undefined) {
        const budget = options.maxLength - prefix.length - separator.length;
        if (budget < 4) {
            throw new Error(
                `uniqueTestId: maxLength=${options.maxLength} is too tight for prefix '${prefix}' with separator '${separator}' (need at least 4 chars for the random suffix)`,
            );
        }
        const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, budget);
        return `${prefix}${separator}${suffix}`;
    }

    return `${prefix}${separator}${Date.now()}${separator}${Math.floor(Math.random() * 1_000_000)}`;
}
