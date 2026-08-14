import '@system-inc/base-foundation/startup/preload';

import { defineConfig } from 'drizzle-kit';

const tablesFilter = process.env.BASE_DRIZZLE_TABLES_FILTER
    ? process.env.BASE_DRIZZLE_TABLES_FILTER.split(',')
    : undefined;

export default defineConfig({
    dialect: 'sqlite',
    driver: 'durable-sqlite',
    schema: './database/@default/drizzle/schema.generated.ts',
    out: './database/@default/drizzle/migrations',
    tablesFilter,
    migrations: {
        table: '__drizzle_migrations_base_durable',
    },
});
