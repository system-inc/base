// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmOneToMany } from '@system-inc/base-foundation/orm/decorators/OrmOneToMany';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';
import { OrmProductTagEntity } from './OrmProductTagEntity';

@OrmTable('orm_tags')
export class OrmTagEntity extends OrmTrackingEntity {
    // Using a varchar as primary key for this entity
    @OrmColumn({ kind: 'varchar', length: 50 }, { primaryKey: true })
    declare name: string;

    @OrmColumn({ kind: 'varchar', length: 7 }, { default: '#000000' })
    declare color: string;

    @OrmColumn({ kind: 'integer' }, { default: 0 })
    declare usageCount: number;

    @OrmOneToMany(() => OrmProductTagEntity, { inverseSide: 'tag' })
    declare productTags?: OrmProductTagEntity[];
}
