// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Gets the global variable used by the system.
 *
 * @returns
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGlobalVariable(): any {
    return globalThis;
}
