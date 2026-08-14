// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmDatabase } from '../OrmDatabase';
import { OrmTransactionCallback } from './OrmTransactionalCallback';

export interface OrmTransaction extends Omit<
    OrmDatabase,
    'transaction' | 'dispose'
> {
    /**
     * Register a callback to be executed after successful transaction commit
     */
    onSuccess(callback: OrmTransactionCallback): void;

    /**
     * Register a callback to be executed after transaction failure/rollback
     */
    onFailure(callback: OrmTransactionCallback): void;

    /**
     * Forces the transaction to fail and rollback.
     * This will execute all failure callbacks registered with `onFailure`.
     */
    rollback(): never;
}
