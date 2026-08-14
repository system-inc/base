// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Whether a failed write was rejected by a unique index, as opposed to failing
 * for any of the reasons a write fails when the database is unwell.
 *
 * The distinction is what makes a unique index usable as a race arbiter. A
 * caller that inserts and catches everything as "someone else won" carries on
 * as though another writer succeeded - but in a connection reset, a timeout, or
 * a throttle nobody did, the row is still unclaimed, and the next attempt takes
 * the same branch and fails the same way. One transient fault becomes a fault
 * per attempt for as long as the condition lasts, which is precisely when the
 * database is least able to absorb it.
 *
 * Matched on the driver's own vocabulary rather than a wrapped error type,
 * because nothing between a caller and the driver classifies it: the repository
 * and the adapters pass the raw failure straight through.
 *
 * The text match is the load-bearing branch, not the fallback. PlanetScale
 * answers over HTTP through Vitess, and what arrives is one string with the
 * code inside it rather than a structured field:
 *
 *     DatabaseError: target: db.-.primary: vttablet: rpc error:
 *     code = AlreadyExists desc = Duplicate entry 'x' for key 'y' (errno 1062)
 *
 * so `errno` is prose here and a property check alone would never fire. The
 * property checks cover the drivers that do populate them - mysql2 sets
 * `ER_DUP_ENTRY`, SQLite sets `SQLITE_CONSTRAINT_UNIQUE` - and the cause chain
 * is walked because drivers wrap.
 */
export function ormIsUniqueConstraintViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
        return false;
    }

    const candidate = error as {
        code?: unknown;
        errno?: unknown;
        message?: unknown;
        cause?: unknown;
    };

    if (candidate.code === 'ER_DUP_ENTRY' || candidate.errno === 1062) {
        return true;
    }

    if (
        typeof candidate.code === 'string' &&
        candidate.code.startsWith('SQLITE_CONSTRAINT')
    ) {
        return true;
    }

    if (typeof candidate.message === 'string') {
        const message = candidate.message.toLowerCase();
        if (
            message.includes('duplicate entry') ||
            message.includes('unique constraint') ||
            message.includes('duplicate key') ||
            // Vitess names it before MySQL's text appears, and is the shape
            // PlanetScale actually returns.
            message.includes('code = alreadyexists') ||
            message.includes('errno 1062')
        ) {
            return true;
        }
    }

    // Drivers wrap. A cause chain ending in a duplicate-key error is still a
    // duplicate-key error, and reading only the outermost frame would report
    // one as a fault.
    if (candidate.cause !== undefined && candidate.cause !== error) {
        return ormIsUniqueConstraintViolation(candidate.cause);
    }

    return false;
}
