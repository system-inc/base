// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { JsonSchema } from '../serialization/JsonSchema';

/**
 * Marks a rule whose check no JSON Schema keyword can express, so a
 * generated schema leaves it out (and is looser than the rule).
 */
export const RuleJsonSchemaUnrepresentable = 'unrepresentable';

/**
 * How a rule appears in a generated JSON Schema (see `generateJsonSchema`):
 * a function returning the keywords it adds, or
 * {@link RuleJsonSchemaUnrepresentable} when no keyword can express it.
 *
 * The function receives the rule's options and the schema of the value the
 * rule applies to — the property itself, or its `items` for a value-level
 * rule on an array — so it can choose keywords by type (`minLength` for a
 * string, `minItems` for an array).
 *
 * A mapping must never be stricter than the rule's `check`: every value
 * `check` accepts must also pass the returned keywords. Leave a constraint
 * out rather than approximate it more strictly.
 */
export type RuleJsonSchemaMapping<TOptions> =
    | typeof RuleJsonSchemaUnrepresentable
    | ((options: TOptions, target: JsonSchema) => JsonSchema);
