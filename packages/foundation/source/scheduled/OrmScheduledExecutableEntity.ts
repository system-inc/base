// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ScheduledExecutableStatus } from '@system-inc/base-common/scheduled/ScheduledExecutableStatus';
import { OrmColumn } from '../orm/decorators/OrmColumn';
import { OrmMutableBaseEntity } from '../orm/entity/OrmMutableBaseEntity';

/**
 * Base entity for all OrmPersistedScheduledExecutable records.
 * Orm (Drizzle) counterpart of {@link ScheduledExecutableEntity}.
 */
export abstract class OrmScheduledExecutableEntity extends OrmMutableBaseEntity {
    @OrmColumn({ kind: 'varchar', length: 255 }, { nullable: true })
    declare cron: string | null;

    @OrmColumn({ kind: 'varchar', length: 255 })
    declare identifier: string;

    @OrmColumn({ kind: 'enum', values: ScheduledExecutableStatus })
    declare status: ScheduledExecutableStatus;

    @OrmColumn({ kind: 'varchar', length: 255 }, { nullable: true })
    declare message: string | null;

    @OrmColumn({ kind: 'json' }, { nullable: true })
    declare metadata: object | null;
}
