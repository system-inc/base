// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseErrorData, isBaseErrorData } from './BaseErrorData';

/**
 * Alias for {@link BaseErrorData}. Kept as a distinct name so that
 * modules and applications can extend the concept with their own
 * subtypes and narrow via module-provided type guards.
 *
 * Historically this was a closed union of specific error data shapes;
 * that restricted modules from contributing their own error data types
 * without modifying foundation, so it has been collapsed to the base
 * type. Narrowing is the caller's responsibility (e.g. use
 * `isRateLimitErrorData` from the rate-limiter module).
 */
export type BaseErrorDataType = BaseErrorData;

/**
 * Type guard for {@link BaseErrorDataType}. Equivalent to
 * {@link isBaseErrorData}; retained for call-site compatibility.
 */
export function isBaseErrorDataType(
    error: unknown,
): error is BaseErrorDataType {
    return isBaseErrorData(error);
}
