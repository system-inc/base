// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Represents an abstract amount of work that can be executed.
 */
export interface Executable<T extends unknown[] = []> {
    /**
     * Performs the work of the executable.
     */
    execute(...args: T): void | Promise<void>;
}
