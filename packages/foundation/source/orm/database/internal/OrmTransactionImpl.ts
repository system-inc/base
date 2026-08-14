// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmSettings } from '../../settings/OrmSettings';
import { OrmAdapterType } from '../adapter/OrmAdapterType';
import { OrmTransaction } from '../transaction/OrmTransaction';
import { OrmTransactionCallback } from '../transaction/OrmTransactionalCallback';
import { OrmDatabaseImpl } from './OrmDatabaseImpl';

export class OrmTransactionImpl<
    SettingsType extends OrmSettings<OrmAdapterType> =
        OrmSettings<OrmAdapterType>,
>
    extends OrmDatabaseImpl<SettingsType>
    implements OrmTransaction
{
    readonly successCallbacks: OrmTransactionCallback[] = [];
    readonly failureCallbacks: OrmTransactionCallback[] = [];

    /**
     * Register a callback to be executed after successful transaction commit
     */
    onSuccess(callback: OrmTransactionCallback): void {
        this.successCallbacks.push(callback);
    }

    /**
     * Register a callback to be executed after transaction failure/rollback
     */
    onFailure(callback: OrmTransactionCallback): void {
        this.failureCallbacks.push(callback);
    }

    /**
     * Forces the transaction to fail and rollback.
     * This will execute all failure callbacks registered with `onFailure`.
     */
    rollback(): never {
        throw new Error('Transaction rolled back');
    }

    /**
     * Execute all success callbacks
     */
    runOnSuccess(): Promise<void[]> {
        return Promise.all(
            this.successCallbacks.map(async (callback) => callback()),
        );
    }

    /**
     * Execute all failure callbacks
     */
    runOnFailure(): Promise<void[]> {
        return Promise.all(
            this.failureCallbacks.map(async (callback) => callback()),
        );
    }
}
