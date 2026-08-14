// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InjectionToken, injectWithTransform } from 'tsyringe';

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { InjectionTransform } from '../../dependency-injection/InjectionTransform';
import { TypedInjectionKey } from '../../dependency-injection/TypedInjectionKey';
import { TypedParameterDecorator } from '../../dependency-injection/TypedParameterDecorator';
import { OrmDatabase } from '../database/OrmDatabase';
import { OrmDatabaseFactory } from '../database/OrmDatabaseFactory';
import { DatabaseBinding } from '../DatabaseBinding';
import { ormMarkTokenlessInjection } from '../metadata/OrmTokenlessInjections';

/**
 * Injects an OrmDatabase.
 *
 * With no argument, resolution is **module-aware**: the database is the one
 * the injecting class's **declared module** resolves to (its `databaseName`
 * or the worker's `database` registration modifier). Membership is declared
 * with `@Injectable(SomeModuleKey)` or any other injectable-family
 * decorator; an undeclared class resolves to the default database — a
 * uniform contract in every worker. Registration in module settings never
 * routes injections (boot validation rejects a non-default-database
 * module's class that forgot to declare). Pass a `DatabaseBinding` or a
 * `TypedInjectionKey` whose registered value names a data context to select
 * one explicitly — an explicit token always wins.
 * @example
 * ```ts
 * @Injectable()
 * export class ReportService {
 *     constructor(@InjectDatabase() private database: OrmDatabase) {}
 *
 *     async count(): Promise<number> {
 *         return await this.database.getRepository(Order).count();
 *     }
 * }
 * ```
 */
export function InjectDatabase(
    token?: DatabaseBinding | TypedInjectionKey<unknown>,
): TypedParameterDecorator<OrmDatabase> {
    const tsyringeToken = token?.toString();
    // Capture the decorated class (the constructor `target`) so resolution can
    // route to its module's database when no explicit token is given. The extra
    // arg is forwarded to the transform by tsyringe.
    return ((target, propertyKey, parameterIndex) => {
        if (!tsyringeToken) {
            // Recorded so boot validation can catch a non-default-database
            // module's class that forgot to declare its membership.
            ormMarkTokenlessInjection(target as Constructor);
        }
        injectWithTransform(
            OrmDatabaseFactory,
            DatabaseFactoryToDatabaseTransform,
            tsyringeToken,
            target as Constructor,
        )(target, propertyKey, parameterIndex);
    }) as TypedParameterDecorator<OrmDatabase>;
}

/**
 * Transforms an OrmDatabaseFactory into an OrmDatabase.
 *
 * Use @InjectDatabase() to inject an OrmDatabase into a class.
 */
class DatabaseFactoryToDatabaseTransform implements InjectionTransform<
    OrmDatabaseFactory,
    OrmDatabase
> {
    public transform(
        databaseFactory: OrmDatabaseFactory,
        token: InjectionToken | undefined,
        requestingClass: Constructor,
    ): OrmDatabase {
        return databaseFactory.getDatabase(token, requestingClass);
    }
}
