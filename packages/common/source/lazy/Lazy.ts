// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Interface for a lazy value.
 */
export interface Lazy<T> {
    /**
     * Gets the value.
     */
    get(): T;
}
