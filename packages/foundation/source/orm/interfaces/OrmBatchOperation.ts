// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { SQLWrapper } from 'drizzle-orm';

import { OrmTableMetadata } from '../metadata/OrmTableMetadata';
import { OrmFindOptionsWhere } from './find/OrmFindOptionsWhere';
import { OrmPartialEntity } from './OrmPartialEntity';

/**
 * A single write operation that can be included in a `writeBatch`. The
 * batch as a whole is atomic — either all operations commit or none do.
 *
 * The `upsert` kind uses `ON CONFLICT`/`ON DUPLICATE KEY` semantics so the
 * conflict target comes from the entity's primary key columns, not from
 * arbitrary `where` conditions. Use `OrmAdapter.upsert()` outside a batch
 * if you need the read-then-write variant with complex conditions.
 *
 * The `execute` kind runs a raw write statement (built with the drizzle
 * `sql` template) inside the same atomic batch — the escape hatch for
 * bulk updates the entity API can't express (computed SET clauses,
 * conditional shifts, increments over arbitrary conditions). No entity
 * lifecycle hooks run for it.
 */
export type OrmBatchOperation<EntityType extends object = object> =
    | {
          kind: 'insert';
          metadata: OrmTableMetadata;
          values: ReadonlyArray<OrmPartialEntity<EntityType>>;
      }
    | {
          kind: 'update';
          metadata: OrmTableMetadata;
          conditions: OrmFindOptionsWhere<EntityType>;
          values: OrmPartialEntity<EntityType>;
      }
    | {
          kind: 'delete';
          metadata: OrmTableMetadata;
          conditions: OrmFindOptionsWhere<EntityType>;
      }
    | {
          kind: 'upsert';
          metadata: OrmTableMetadata;
          conditions: OrmPartialEntity<EntityType>;
          values: OrmPartialEntity<EntityType>;
      }
    | {
          kind: 'execute';
          query: SQLWrapper | string;
      };
