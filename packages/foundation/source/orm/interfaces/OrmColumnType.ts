// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DatetimeFsp } from 'drizzle-orm/mysql-core';

import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { OrmIntegerSizeType } from './OrmIntegerLengthType';
import { OrmTextSizeType } from './OrmTextSizeType';

export type OrmColumnType =
    | {
          kind: 'integer';
          unsigned?: boolean;
          size?: Exclude<OrmIntegerSizeType, 'int64'>;
          increment?: boolean;
      }
    | {
          kind: 'bigint';
          /**
           * How the 64-bit value is represented in JavaScript — required,
           * because the framework cannot know whether a column can exceed
           * Number.MAX_SAFE_INTEGER (2^53 − 1):
           *
           * - `'number'` — plain `number`; ergonomic (JSON, GraphQL,
           *   arithmetic) and correct for counts, sizes, and timestamps
           *   that stay under 2^53. Values above that silently lose
           *   precision — never use it for full-range 64-bit identifiers.
           * - `'bigint'` — JS `BigInt`; full 64-bit range, but does not
           *   survive `JSON.stringify` and won't mix with `number`
           *   arithmetic.
           */
          mode: 'number' | 'bigint';
          unsigned?: boolean;
          increment?: boolean;
      }
    | {
          kind: 'float';
          precision?: number;
          scale?: number;
          unsigned?: boolean;
      }
    | {
          kind: 'double';
          precision?: number;
          scale?: number;
          unsigned?: boolean;
      }
    | {
          kind: 'decimal';
          precision?: number;
          scale?: number;
          unsigned?: boolean;
          /**
           * How the exact decimal value is represented in JavaScript —
           * required, because decimal columns exist for exactness and the
           * framework cannot know whether a lossy representation is
           * acceptable:
           *
           * - `'string'` — lossless; the safe choice for money-like exact
           *   values (pair with decimal.js / MonetaryDecimal for math).
           * - `'number'` — float64; fine for measurements (coordinates,
           *   latencies, ratings) where approximation is inherent, but
           *   silently loses precision on values float64 can't represent.
           * - `'bigint'` — full-range integers for scale-0 decimals.
           */
          mode: 'string' | 'number' | 'bigint';
      }
    | { kind: 'boolean' }
    | { kind: 'char'; length: number }
    | { kind: 'varchar'; length: number }
    | {
          kind: 'text';
          size?: OrmTextSizeType;
      }
    | { kind: 'bytes'; fixed?: boolean; size: number }
    | {
          kind: 'datetime';
          mode: 'date' | 'string';
          fsp?: DatetimeFsp;
      }
    | { kind: 'uuid'; generate?: boolean }
    | { kind: 'json' }
    // `values` accepts a string enum object or an explicit value list.
    // The object form is typed `Dictionary<unknown>` so enums merged with
    // a namespace (helper functions) are accepted — the schema builders
    // keep only the string values.
    | { kind: 'enum'; values: Dictionary<unknown> | string[] };
