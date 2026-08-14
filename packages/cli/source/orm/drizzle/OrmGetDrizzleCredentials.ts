// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseSettings } from '@system-inc/base-foundation/base/BaseSettings';
import {
    isOrmSettingsBetterSQLite,
    isOrmSettingsD1,
    isOrmSettingsDurableSQLite,
    isOrmSettingsPlanetScale,
} from '@system-inc/base-foundation/orm/settings/OrmSettings';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import { WranglerToml } from '../../project/WranglerToml';

/**
 * Resolves database credentials for a worker's ORM-configured database
 * in the given environment. Reads credentials from `settings.orm[db]`
 * directly when present; falls back to wrangler.toml + env.toml lookups
 * via the worker project for D1 / PlanetScale-without-credentials.
 *
 * Called from the CLI under ts-node (where decorators work). Used to
 * populate BASE_DRIZZLE_CREDENTIALS for the generated drizzle.config.ts.
 */
export function ormGetDrizzleCredentials(
    project: BaseWorkerProject,
    database: string,
    environment: string,
    settings: BaseSettings,
): any {
    if (!settings.orm || !settings.orm[database]) {
        throw new Error(`ORM settings for database ${database} not found.`);
    }

    const ormSettings = settings.orm[database];

    if (isOrmSettingsDurableSQLite(ormSettings)) {
        // Durable SQLite does not require credentials
        return undefined;
    }

    if (isOrmSettingsD1(ormSettings)) {
        // we need to read wrangler.toml to get the database id
        // read the accountId and the token from the env.toml file

        const [_env, cliEnv] = project.loadEnvironmentVariables(environment);

        if (!cliEnv.CLOUDFLARE_ACCOUNT_ID || !cliEnv.CLOUDFLARE_API_TOKEN) {
            throw new Error(
                `CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN not found in environment ${environment} of wrangler.toml`,
            );
        }
        const d1Database = WranglerToml.findD1Database(
            project,
            environment,
            ormSettings.binding,
        );

        return {
            accountId: cliEnv.CLOUDFLARE_ACCOUNT_ID,
            token: cliEnv.CLOUDFLARE_API_TOKEN,
            databaseId: d1Database.database_id,
        };
    }

    if (isOrmSettingsPlanetScale(ormSettings)) {
        if (ormSettings.credentials) {
            if (ormSettings.credentials.type === 'discrete') {
                return {
                    host: ormSettings.credentials.host,
                    username: ormSettings.credentials.username,
                    password: ormSettings.credentials.password,
                    port: ormSettings.credentials.port,
                    database: ormSettings.credentials.database,
                };
            } else {
                return {
                    url: ormSettings.credentials.url,
                };
            }
        }

        const [env, _cliEnv] = project.loadEnvironmentVariables(environment);
        if (typeof env.DATABASES !== 'object') {
            throw new Error(
                `DATABASES environment variable is not an object in environment ${environment} of wrangler.toml`,
            );
        }
        const credentials = env.DATABASES?.find(
            (db: any) => db.name === database,
        );
        if (!credentials || !credentials.url) {
            throw new Error(
                `DATABASE_URL not found in environment ${environment} of wrangler.toml`,
            );
        }
        return {
            url: credentials.url,
        };
    }

    if (isOrmSettingsBetterSQLite(ormSettings)) {
        return {
            url: ormSettings.filePath,
        };
    }

    return undefined;
}
