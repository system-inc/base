// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Json } from '../Json';

/**
 * Interface for transforming JSON values to and from a specific type.
 *
 * This interface defines methods for converting a JSON value to a specific type
 * and optionally converting that type back to a JSON value.
 *
 * @template T - The type to which the JSON value is transformed.
 */
export interface JsonValueTransformer<T = unknown> {
    fromJson(v: unknown): T;
    toJson(v: T): Json;
}
