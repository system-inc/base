// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseSettings } from '@system-inc/base-foundation/base/BaseSettings';
import { DurableProvider } from '@system-inc/base-foundation/orm/database/adapter/drizzle/sqlite/DurableProvider';
import migrations from './database/@default/drizzle/migrations/migrations';
import release from './database/@default/drizzle/release';
import { CounterEntity } from './source/entities/CounterEntity';
import { CounterHttpService } from './source/services/CounterHttpService';

/**
 * Durable-object worker demonstrating ORM-managed persistent state.
 *
 * Each durable object instance owns a SQLite store; the ORM treats it
 * like any other database, with entities, migrations, and a repository
 * API. The `CounterEntity` is persisted across requests and across
 * restarts within a single DO instance.
 */
export const BaseDurableSettings: BaseSettings = {
    name: 'base-durable',
    version: '1.0.0',
    title: 'Base Durable',
    server: {
        '@default': {
            port: 3001,
        },
    },
    modules: [],
    orm: {
        '@default': {
            adapterType: 'drizzle',
            databaseType: { dialect: 'sqlite', driver: 'durable' },
            adapter: DurableProvider,
            entities: [CounterEntity],
            migrations,
            released: release.released,
        },
    },
    services: [CounterHttpService],
};
