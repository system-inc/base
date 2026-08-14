// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumnOptions } from '../interfaces/OrmColumnOptions';
import { OrmColumnType } from '../interfaces/OrmColumnType';

export interface OrmColumnMetadata {
    propertyKey: string;
    type: OrmColumnType;
    options?: OrmColumnOptions;
}
