// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmAdapterType } from '../database/adapter/OrmAdapterType';
import { OrmEntityClass } from '../entity/OrmEntityClass';

export interface OrmSettingsBase<AdapterType extends OrmAdapterType> {
    /**
     * The entities to load for the Worker.
     *
     * This represents the database tables that are
     * specific to your Worker separate of the module tables.
     *
     * This should be each individual entity class.
     */
    readonly entities?: OrmEntityClass[];

    /**
     * Entities this worker USES for queries but does NOT own — their schema is
     * migrated by someone else (a sibling worker sharing the database). They are
     * built into the runtime query schema, but excluded from migration
     * generation (`schema:diff`/`schema:check`) and the `schema:sync` table
     * scope. The direct-registration equivalent of a module registered with
     * `externalSchema: true`.
     *
     * @example
     * orm: {
     *   '@default': {
     *     ...,
     *     entities: [MyOwnTable],        // owned + migrated here
     *     externalEntities: [Account],   // queried here, migrated elsewhere
     *   },
     * }
     */
    readonly externalEntities?: OrmEntityClass[];

    /**
     * Inherit the entity set from another configured ORM database, by name
     * (e.g. a read-replica that targets the same schema). The inherited
     * entities are merged with this config's own `entities` (deduplicated), and
     * resolution is transitive. Only the schema is inherited — this config
     * keeps its own adapter, dialect, and credentials.
     *
     * @example
     * orm: {
     *   '@default': { ..., entities: [Account, EmailLog] },
     *   readonly:   { ..., inheritSchema: '@default' }, // gets Account, EmailLog
     * }
     */
    readonly inheritSchema?: string;

    /**
     * The type of ORM adapter to use.
     */
    readonly adapterType: AdapterType;

    /**
     * Enable or disable logging of SQL queries.
     *
     * Defaults to false.
     */
    readonly logging?: boolean;
}
