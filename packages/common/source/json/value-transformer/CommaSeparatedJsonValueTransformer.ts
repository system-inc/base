// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Json } from '../Json';
import { JsonValueTransformer } from './JsonValueTransformer';

/**
 * A transformer for converting between comma-separated strings and string arrays.
 *
 * Handles query parameters like `?tags=foo,bar,baz` by splitting on commas
 * and filtering out empty segments.
 */
export class CommaSeparatedJsonValueTransformer implements JsonValueTransformer<
    string[]
> {
    fromJson(v: unknown): string[] {
        if (typeof v === 'string') {
            return v.split(',').filter(Boolean);
        } else if (Array.isArray(v)) {
            return v.map(String);
        }
        return [];
    }

    toJson(v: string[]): Json {
        return v.join(',');
    }
}
