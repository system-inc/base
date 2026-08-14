// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InjectionToken } from 'tsyringe';

import { DefaultConfigurationKey } from '@system-inc/base-common/configuration/NamedConfiguration';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { PartialDictionary } from '@system-inc/base-common/type/Dictionary';
import { ContainerScoped } from '../../dependency-injection/decorators/ContainerScoped';
import { Inject } from '../../dependency-injection/decorators/Inject';
import { BaseWorkerContext } from '../../worker/BaseWorkerContext';
import { OrmSettings } from '../settings/OrmSettings';
import { OrmAdapterProvider } from './adapter/OrmAdapterProvider';
import { OrmAdapterType } from './adapter/OrmAdapterType';
import { OrmDatabaseImpl } from './internal/OrmDatabaseImpl';
import { OrmDatabase } from './OrmDatabase';

@ContainerScoped()
export class OrmDatabaseFactory {
    private readonly databases: PartialDictionary<OrmDatabase> = {};

    constructor(
        @Inject(BaseWorkerContext)
        private readonly workerContext: BaseWorkerContext,
    ) {}

    /**
     * Resolves the OrmDatabase for an injection site.
     *
     * Database selection precedence:
     * 1. an explicit `token` (a `DatabaseBinding`/key passed to the decorator) —
     *    always wins;
     * 2. otherwise the `requestingClass`'s declared module membership
     *    (`@Injectable(SomeModuleKey)`, `@WorkerScoped(SomeModuleKey)`, …) —
     *    resolved through the module graph, so the worker's `database`
     *    registration modifier applies;
     * 3. otherwise the default database — a uniform contract in every worker.
     *    Registration never routes injections; boot validation rejects a
     *    non-default-database module's class with token-less injections that
     *    forgot to declare (see BaseConfiguration.getDatabaseNameForClass).
     *
     * @returns The resolved OrmDatabase (cached per database name).
     */
    getDatabase(
        token?: InjectionToken,
        requestingClass?: Constructor,
    ): OrmDatabase {
        // first get the database name from the token (explicit, wins), then the
        // requesting class's declared/registered module database, then the
        // default configuration key
        let databaseName: string;
        if (token) {
            databaseName = this.resolveDatabaseToken(token);
        } else if (requestingClass) {
            databaseName =
                this.workerContext.configuration.getDatabaseNameForClass(
                    requestingClass,
                );
        } else {
            databaseName = DefaultConfigurationKey;
        }

        // now check to see if we already have a database provider for this name
        if (this.databases[databaseName]) {
            return this.databases[databaseName]!;
        }

        // create the database provider and store it
        // get the database settings for the given database name
        const ormConfiguration =
            this.workerContext.configuration.getOrmConfiguration(databaseName);
        const databaseType = ormConfiguration.databaseType;

        // Debug, not info: the factory is container-scoped, so this runs on
        // every request that touches the ORM — at Info it dominates output.
        Logger.debug(
            LogCategory.Orm,
            'Initializing database: %s (%s/%s)',
            databaseName,
            databaseType.dialect,
            databaseType.driver,
        );

        const adapterProvider = this.workerContext.container.resolve<
            OrmAdapterProvider<OrmSettings<OrmAdapterType>>
        >(ormConfiguration.adapter);

        const db = new OrmDatabaseImpl(ormConfiguration, adapterProvider);
        this.databases[databaseName] = db;
        return db;
    }

    private resolveDatabaseToken(token: InjectionToken): string {
        try {
            return this.workerContext.container.resolve<string>(token);
        } catch (error) {
            // if the token could not resolve, lets assume its a literal string
            if (typeof token === 'string') {
                return token;
            } else if (typeof token === 'symbol') {
                return token.toString();
            } else {
                throw new Error(
                    `Database token ${token.toString()} could not be resolved.`,
                );
            }
        }
    }
}
