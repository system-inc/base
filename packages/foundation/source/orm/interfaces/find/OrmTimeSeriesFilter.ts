// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmPartialEntity } from '../OrmPartialEntity';
import { OrmFindOptionsWhere } from './OrmFindOptionsWhere';

export type OrmTimeSeriesFilter<EntityType extends object> = {
    /** A stable key for this count, e.g. 'status:ok' or 'tool:Ping'. */
    key: string;
    /** A Drizzle SQL condition that defines the filter. Example: eq(events.status, 'ok') */
    condition:
        | OrmFindOptionsWhere<EntityType>
        | OrmFindOptionsWhere<EntityType>[]
        | OrmPartialEntity<EntityType>
        | OrmPartialEntity<EntityType>[];
};
