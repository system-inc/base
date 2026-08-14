// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmTrackingEntity } from '../../entity/OrmTrackingEntity';
import { OrmFindOptions } from '../../interfaces/find/OrmFindOptions';
import { OrmFindOptionsMany } from '../../interfaces/find/OrmFindOptionsMany';
import { OrmSettings } from '../../settings/OrmSettings';
import { OrmAdapterType } from '../adapter/OrmAdapterType';
import { OrmDatabaseImpl } from '../internal/OrmDatabaseImpl';

export interface OrmReadonlyRepository<EntityType extends OrmTrackingEntity> {
    get tableName(): string;
    get target(): Constructor<EntityType>;
    get db(): OrmDatabaseImpl<OrmSettings<OrmAdapterType>>;

    /**
     * Counts entities that match given options.
     * Useful for pagination.
     */
    count(options?: OrmFindOptionsMany<EntityType>): Promise<number>;

    /**
     * Finds entities that match given find options.
     */
    find(
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<ReadonlyArray<Readonly<EntityType>>>;

    /**
     * Finds first entity by a given find options.
     * If entity was not found in the database - returns null.
     */
    findOne(
        options?: OrmFindOptions<EntityType>,
    ): Promise<Readonly<EntityType> | null>;

    /**
     * Finds entities that match given find options.
     * Also counts all entities that match given conditions,
     * but ignores pagination settings (from and take options).
     */
    findAndCount(
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<[ReadonlyArray<Readonly<EntityType>>, number]>;
}
