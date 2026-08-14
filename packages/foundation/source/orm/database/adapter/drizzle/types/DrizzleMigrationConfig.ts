// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Copy of the MigrationConfig type from Drizzle's migrator.
 */
export interface DrizzleMigrationConfig {
    journal: {
        entries: DrizzleMigrationEntry[];
    };
    migrations: Record<string, string>;
}

/**
 * Represents a single migration entry in the journal.
 */
export interface DrizzleMigrationEntry {
    idx: number;
    when: number;
    tag: string;
    breakpoints: boolean;
}
