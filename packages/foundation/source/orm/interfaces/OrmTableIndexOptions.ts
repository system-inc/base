// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export interface OrmTableIndexOptions {
    unique?: boolean;
    dialect?: { mysql?: { clustered?: boolean } };
}
