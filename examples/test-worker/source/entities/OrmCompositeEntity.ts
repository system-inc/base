// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmPrimaryKey } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryKey';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';

@OrmTable('orm_composite_entity')
@OrmPrimaryKey(['userId', 'projectId'])
export class OrmCompositeEntity extends OrmTrackingEntity {
    @OrmColumn({ kind: 'varchar', length: 36 })
    declare userId: string;

    @OrmColumn({ kind: 'varchar', length: 36 })
    declare projectId: string;

    @OrmColumn({ kind: 'varchar', length: 255 })
    declare role: string;

    @OrmColumn({ kind: 'datetime', mode: 'date' })
    declare assignedAt: Date;
}
