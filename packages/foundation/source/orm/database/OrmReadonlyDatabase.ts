// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmTrackingEntity } from '../entity/OrmTrackingEntity';
import { OrmFindOptions } from '../interfaces/find/OrmFindOptions';
import { OrmFindOptionsMany } from '../interfaces/find/OrmFindOptionsMany';
import { OrmRawData } from '../interfaces/OrmRawData';
import { OrmTableMetadata } from '../metadata/OrmTableMetadata';
import { OrmReadonlyRepository } from './repository/OrmReadonlyRepository';

export interface OrmReadonlyDatabase {
    readonly name: string;

    getRepository<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
    ): OrmReadonlyRepository<EntityType>;

    /**
     * Checks if entity metadata exist for the given entity class, target name or table name.
     */
    hasMetadata(target: Constructor): boolean;

    /**
     * Gets entity metadata for the given entity class or schema name.
     */
    getMetadata(target: Constructor): OrmTableMetadata | undefined;

    /**
     * Counts entities that match given options.
     * Useful for pagination.
     */
    count<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<number>;

    find<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<ReadonlyArray<Readonly<OrmRawData<EntityType>>>>;

    findOne<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        options?: OrmFindOptions<EntityType>,
    ): Promise<Readonly<OrmRawData<EntityType>> | null>;

    findAndCount<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<[ReadonlyArray<Readonly<OrmRawData<EntityType>>>, number]>;
}
