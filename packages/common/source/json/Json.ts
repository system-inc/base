// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-empty-object-type */

/**
 * Represents any possible JSON value.
 */
export type Json =
    | string
    | number
    | boolean
    | null
    | JsonObject
    | JsonArray
    | ReadonlyJsonArray;

/**
 * Represents a JSON value that is a primitive.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Represents a JSON object.
 */
export interface JsonObject extends Record<string, Json | undefined> {}

/**
 * Represents an array of JsonValues.
 */
export interface JsonArray extends Array<Json> {}

/**
 * Represents an array of JsonValues.
 */
export interface ReadonlyJsonArray extends ReadonlyArray<Json> {}
