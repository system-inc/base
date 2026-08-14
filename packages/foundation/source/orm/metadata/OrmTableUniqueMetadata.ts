// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export interface OrmTableUniqueMetadata {
    name?: string; // Optional custom constraint name
    columns: string[];
}
