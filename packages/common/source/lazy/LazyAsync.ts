// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Interface for a lazy async value.
 */
export interface LazyAsync<T> {
    /**
     * Gets the value.
     */
    get(): Promise<T>;
}
