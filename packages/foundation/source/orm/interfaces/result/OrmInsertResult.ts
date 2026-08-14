// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmMutationResult } from './OrmMutationResult';

export type OrmInsertResult<TReturning = unknown> =
    OrmMutationResult<TReturning> & {
        insertedId?: string | number | bigint;
    };
