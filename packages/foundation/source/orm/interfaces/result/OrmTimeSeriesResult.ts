// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export interface OrmTimeSeriesResult {
    bucket: string;
    filterKeys: {
        key: string;
        count: number;
    }[];
    total: number;
}
