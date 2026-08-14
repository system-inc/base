// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmTransactionCallback } from './OrmTransactionalCallback';

export type OrmTransactionResult<T> =
    | OrmTransactionSuccessResult<T>
    | OrmTransactionErrorResult;

export interface OrmTransactionSuccessResult<
    T,
> extends OrmTransactionBaseResult {
    readonly kind: 'success';
    readonly txResult: T;
}

export interface OrmTransactionErrorResult extends OrmTransactionBaseResult {
    readonly kind: 'error';
    readonly txError: unknown;
}

export interface OrmTransactionBaseResult {
    readonly onSuccess: OrmTransactionCallback[];
    readonly onFailure: OrmTransactionCallback[];
}
