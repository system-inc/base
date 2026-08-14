// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Json } from '../Json';
import { JsonValueTransformer } from './JsonValueTransformer';

/**
 * A transformer for converting between Date objects and their JSON representation.
 *
 * This transformer handles the conversion of Date objects to ISO 8601 string format
 * for JSON serialization, and can parse ISO 8601 strings back into Date objects.
 *
 * @implements {JsonValueTransformer<Date>}
 */
export class DateJsonValueTransformer implements JsonValueTransformer<Date> {
    fromJson(v: unknown): Date {
        if (typeof v === 'string') {
            return new Date(v);
        } else if (v instanceof Date) {
            return v;
        } else if (typeof v === 'number') {
            return new Date(v);
        } else {
            throw new Error(`Invalid date value: ${v}`);
        }
    }

    toJson(v: Date): Json {
        return v.toISOString();
    }
}
