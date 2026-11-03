// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Json } from '@system-inc/base-common/json/Json';

/**
 * A JSON Schema primitive type name.
 */
export type JsonSchemaType =
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'array'
    | 'object'
    | 'null';

/**
 * The JSON Schema (draft 2020-12) keywords Base generates from
 * serialization and validation metadata. See `generateJsonSchema`.
 */
export interface JsonSchema {
    readonly type?: JsonSchemaType | readonly JsonSchemaType[];
    readonly enum?: readonly Json[];
    readonly description?: string;
    readonly default?: Json;
    readonly properties?: Readonly<Record<string, JsonSchema>>;
    readonly required?: readonly string[];
    readonly items?: JsonSchema;
    readonly $ref?: string;
    readonly $defs?: Readonly<Record<string, JsonSchema>>;
    readonly allOf?: readonly JsonSchema[];
    readonly minimum?: number;
    readonly maximum?: number;
    readonly minLength?: number;
    readonly maxLength?: number;
    readonly minItems?: number;
    readonly maxItems?: number;
    readonly uniqueItems?: boolean;
    readonly pattern?: string;
}
