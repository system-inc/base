// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmPrimaryKeyOptions } from '../interfaces/OrmPrimaryKeyOptions';

export interface OrmPrimaryKeyMetadata {
    columns: string[];
    options?: OrmPrimaryKeyOptions;
}
