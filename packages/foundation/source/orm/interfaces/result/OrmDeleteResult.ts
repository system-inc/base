// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmMutationResult } from './OrmMutationResult';

export type OrmDeleteResult<TReturning = unknown> =
    OrmMutationResult<TReturning>;
