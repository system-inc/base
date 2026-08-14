// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DefaultConfigurationKey } from '@system-inc/base-common/configuration/NamedConfiguration';
import { OrmAdapterType } from '@system-inc/base-foundation/orm/database/adapter/OrmAdapterType';
import { OrmSettings } from '@system-inc/base-foundation/orm/settings/OrmSettings';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';

/**
 * Gets the ORM adapter type for a database
 */
export async function getOrmAdapterType(
    workerProject: BaseWorkerProject,
    databaseName: string,
    environment: string,
): Promise<OrmSettings<OrmAdapterType>> {
    const settingsModule = await workerProject.loadSettingsModule(environment);
    const settings = settingsModule.settings;

    if (!settings.orm) {
        throw new Error('No ORM configuration found in settings');
    }

    const dbConfig =
        settings.orm[databaseName] || settings.orm[DefaultConfigurationKey];
    if (!dbConfig) {
        throw new Error(
            `No ORM configuration found for database: ${databaseName}`,
        );
    }

    return dbConfig;
}
