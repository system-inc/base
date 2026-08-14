// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Json } from '../Json';
import { JsonValueTransformer } from './JsonValueTransformer';

/**
 * A transformer for converting between JSON strings and objects.
 *
 * Handles query parameters that contain a JSON-encoded object,
 * e.g. `?metadata={"key":"value"}`.
 *
 * Returns null if the value is missing or not valid JSON.
 */
export class JsonObjectValueTransformer implements JsonValueTransformer<Record<
    string,
    unknown
> | null> {
    fromJson(v: unknown): Record<string, unknown> | null {
        if (v == null) {
            return null;
        }
        if (typeof v === 'object' && !Array.isArray(v)) {
            return v as Record<string, unknown>;
        }
        if (typeof v === 'string') {
            return JSON.parse(v) as Record<string, unknown>;
        }
        return null;
    }

    toJson(v: Record<string, unknown> | null): Json {
        if (v == null) {
            return null;
        }
        return JSON.stringify(v);
    }
}
