// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TimeInterval } from '@system-inc/base-common/time/TimeInterval';
import { OrmPartialEntity } from '../OrmPartialEntity';
import { OrmFindOptionsWhere } from './OrmFindOptionsWhere';
import { OrmTimeSeriesFilter } from './OrmTimeSeriesFilter';

export const OrmTimeSeriesDefaultLimit = 370; // ~1 year of daily buckets
export const OrmTimeSeriesMaxLimit = 1000; // max 1000 buckets

export type OrmTimeSeriesOptions<EntityType extends object> = {
    startAtUtc: number; // UTC epoch seconds inclusive
    endAtUtc: number; // UTC epoch seconds exclusive (recommended)
    interval: TimeInterval;
    timeColIsEpochSec?: boolean; // default false (ISO-8601 TEXT). Set true for INTEGER epoch seconds.
    timeZone?: string; // IANA timezone (e.g., 'America/New_York'). If provided, buckets will be aligned to this timezone.

    // Optional base filter applied to ALL counts (sargable, goes in JOIN predicate)
    where?:
        | OrmFindOptionsWhere<EntityType>
        | OrmFindOptionsWhere<EntityType>[]
        | OrmPartialEntity<EntityType>
        | OrmPartialEntity<EntityType>[];

    // Per-filter conditional aggregations (optional - if not provided, only total counts are returned)
    filters?: OrmTimeSeriesFilter<EntityType>[];

    // When set, each bucket counts COUNT(DISTINCT <distinctColumn>) instead
    // of COUNT(*). Pass the entity property key; the database layer resolves
    // it to the column's database name before reaching the adapter.
    distinctColumn?: string;

    // Pagination for buckets (Option A limiting inside CTE)
    limit?: number; // default 200
    offset?: number; // default 0 (for pagination)
};
