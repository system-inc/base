// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Type definition for transaction callbacks
 */
export type OrmTransactionCallback = () => Promise<void> | void;
