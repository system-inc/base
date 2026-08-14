// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseConfiguration } from '../../../configuration/BaseConfiguration';
import { BaseEnvironmentKeys } from '../../../configuration/BaseEnivronmentKeys';
import type { DatabaseEnvironmentVariables } from '../../../configuration/EnvironmentVariables';
import { OrmAdapterType } from '../../database/adapter/OrmAdapterType';
import { OrmSettings } from '../OrmSettings';
import { OrmCredentials } from './OrmCredentials';

export function ormGetEnvironmentCredentials<
    OrmSettingsType extends OrmSettings<OrmAdapterType>,
>(
    database: string,
    configuration: BaseConfiguration,
    settings: OrmSettingsType,
): OrmCredentials {
    let credentials: OrmCredentials | undefined = undefined;

    // first check if the database settings existing in the environment variables
    const databases = configuration.getEnvironmentVariable(
        BaseEnvironmentKeys.Databases,
    );
    if (databases) {
        let databasesEnv: DatabaseEnvironmentVariables[] | undefined;
        if (typeof databases === 'string') {
            try {
                databasesEnv = JSON.parse(databases);
            } catch (err) {
                throw new Error(
                    'Failed to parse DATABASES environment variable',
                );
            }
        } else {
            databasesEnv = databases as DatabaseEnvironmentVariables[];
        }
        if (Array.isArray(databasesEnv)) {
            for (const db of databasesEnv) {
                if (db.name === database) {
                    credentials = {
                        type: 'url',
                        url: db.url,
                    };
                }
            }
        }
    }
    if (!credentials && 'credentials' in settings) {
        credentials = settings.credentials;
    }
    if (!credentials) {
        throw new Error(
            `No credentials found for database ${database} in settings or environment variables.`,
        );
    }
    return credentials;
}
