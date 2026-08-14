import '@system-inc/base-foundation/startup/preload';

import { defineConfig } from 'drizzle-kit';

const dbCredentials = JSON.parse(
    process.env.BASE_DRIZZLE_CREDENTIALS || '{}', // populated by base-cli's ormRunDrizzleCommand
);

const tablesFilter = process.env.BASE_DRIZZLE_TABLES_FILTER
    ? process.env.BASE_DRIZZLE_TABLES_FILTER.split(',')
    : undefined;

export default defineConfig({
    dialect: 'mysql',
    dbCredentials,
    schema: './database/@default/drizzle/schema.generated.ts',
    out: './database/@default/drizzle/migrations',
    tablesFilter,
    migrations: {
        table: '__drizzle_migrations_test_worker',
    },
});
