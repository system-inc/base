// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InjectionToken, injectWithTransform } from 'tsyringe';

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { InjectionTransform } from '../../dependency-injection/InjectionTransform';
import { TypedInjectionKey } from '../../dependency-injection/TypedInjectionKey';
import { TypedParameterDecorator } from '../../dependency-injection/TypedParameterDecorator';
import { OrmDatabaseFactory } from '../database/OrmDatabaseFactory';
import { OrmRepository } from '../database/repository/OrmRepository';
import { DatabaseBinding } from '../DatabaseBinding';
import { OrmTrackingEntity } from '../entity/OrmTrackingEntity';
import { ormMarkTokenlessInjection } from '../metadata/OrmTokenlessInjections';

/**
 * Injects an OrmRepository bound to the given Entity.
 *
 * The entity type flows through to the resolved
 * `OrmRepository<EntityType>`, so the parameter's declared type is
 * verified at lint time.
 *
 * @param entity The target entity for which you want to inject the repository.
 * @param token Optional database selector — pass a `DatabaseBinding`
 * or a `TypedInjectionKey` whose registered value names the data
 * context. If omitted, resolution is **module-aware**: the repository binds to
 * the database the injecting class's **declared module** resolves to (its
 * `databaseName` or the worker's `database` registration modifier).
 * Membership is declared with `@Injectable(SomeModuleKey)` or any other
 * injectable-family decorator; an undeclared class resolves to the default
 * database — a uniform contract in every worker. Registration in module
 * settings never routes injections (boot validation rejects a
 * non-default-database module's class that forgot to declare). An explicit
 * token always wins.
 * @example
 * ```ts
 * @Injectable()
 * export class BookService {
 *     constructor(
 *         @InjectRepository(Book) private books: OrmRepository<Book>,
 *     ) {}
 *
 *     async get(id: string): Promise<Book | undefined> {
 *         return await this.books.findOne({ where: { id } });
 *     }
 * }
 * ```
 */
export function InjectRepository<EntityType extends OrmTrackingEntity>(
    entity: Constructor<EntityType>,
    token?: DatabaseBinding | TypedInjectionKey<unknown>,
): TypedParameterDecorator<OrmRepository<EntityType>> {
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
            DatabaseToRepositoryTransform,
            entity,
            tsyringeToken,
            target as Constructor,
        )(target, propertyKey, parameterIndex);
    }) as TypedParameterDecorator<OrmRepository<EntityType>>;
}

/**
 * Transforms an OrmDatabaseFactory into an OrmRepository.
 *
 * Use @InjectRepository() to inject an OrmRepository into a class.
 */
class DatabaseToRepositoryTransform<
    EntityType extends OrmTrackingEntity,
> implements InjectionTransform<OrmDatabaseFactory, OrmRepository<EntityType>> {
    public transform(
        databaseFactory: OrmDatabaseFactory,
        entity: Constructor<EntityType>,
        token: InjectionToken | undefined,
        requestingClass: Constructor,
    ): OrmRepository<EntityType> {
        const db = databaseFactory.getDatabase(token, requestingClass);
        return db.getRepository(entity);
    }
}
