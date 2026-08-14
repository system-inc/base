// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmValueTransformer } from '../interfaces/OrmValueTransformer';

/**
 * Stores a string array as a comma-separated text column, matching the
 * storage format of TypeORM's legacy `simple-array` column type so existing
 * rows remain readable after the Orm (Drizzle) migration.
 */
export class OrmSimpleArrayTransformer implements OrmValueTransformer<
    string[] | null,
    string | null
> {
    from(value: string | null): string[] | null {
        if (value === null || value === undefined) {
            return null;
        }
        if (value === '') {
            return [];
        }
        return value.split(',');
    }

    to(value: string[] | null): string | null {
        if (value === null || value === undefined) {
            return null;
        }
        return value.join(',');
    }
}
