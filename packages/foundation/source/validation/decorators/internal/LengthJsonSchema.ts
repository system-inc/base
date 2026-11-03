// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Mutable } from '@system-inc/base-common/type/UtilityTypes';
import { JsonSchema } from '../../../serialization/JsonSchema';

/**
 * The JSON Schema bounds for the length rules (`MinLength`, `MaxLength`,
 * `Length`), which accept a string or an array: `minLength`/`maxLength` on
 * a string target, `minItems`/`maxItems` on an array target, and both
 * (with the type limited to string or array) when the target's type is
 * unknown.
 *
 * The rules count UTF-16 code units (`value.length`) while JSON Schema
 * counts code points. The bounds are emitted unchanged, so a string made
 * of characters outside the Basic Multilingual Plane (emoji, for example)
 * can meet a rule's minimum in code units yet fall short of the schema's
 * in code points. That is the one place a generated schema is stricter
 * than validation; the alternative, halving every minimum, would misstate
 * every ordinary string's limit.
 */
export function lengthJsonSchema(
    target: JsonSchema,
    min: number | undefined,
    max: number | undefined,
): JsonSchema {
    const schema: Mutable<JsonSchema> = {};
    const isString = target.type === 'string';
    const isArray = target.type === 'array';
    if (!isString && !isArray) {
        schema.type = ['string', 'array'];
    }
    if (!isArray) {
        if (min !== undefined) schema.minLength = min;
        if (max !== undefined) schema.maxLength = max;
    }
    if (!isString) {
        if (min !== undefined) schema.minItems = min;
        if (max !== undefined) schema.maxItems = max;
    }
    return schema;
}
