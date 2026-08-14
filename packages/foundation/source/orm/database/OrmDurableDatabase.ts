// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmDatabase } from './OrmDatabase';

export interface OrmDurableDatabase extends OrmDatabase {
    migrate(): Promise<void>;
}
