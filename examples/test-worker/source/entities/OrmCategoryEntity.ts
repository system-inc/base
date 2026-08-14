// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmCreateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmCreateDateColumn';
import { OrmOneToMany } from '@system-inc/base-foundation/orm/decorators/OrmOneToMany';
import { OrmPrimaryAutoColumn } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';
import { OrmProductCategoryEntity } from './OrmProductCategoryEntity';

@OrmTable('orm_categories')
export class OrmCategoryEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('serial')
    declare id: number;

    @OrmColumn({ kind: 'varchar', length: 100 }, { unique: true })
    declare name: string;

    @OrmColumn({ kind: 'varchar', length: 100 }, { unique: true })
    declare slug: string;

    @OrmColumn({ kind: 'text' }, { nullable: true })
    declare description: string | null;

    @OrmColumn({ kind: 'integer' }, { nullable: true })
    declare parentId: number | null;

    @OrmColumn({ kind: 'integer' }, { default: 0 })
    declare sortOrder: number;

    @OrmColumn({ kind: 'boolean' }, { default: true })
    declare isVisible: boolean;

    @OrmOneToMany(() => OrmProductCategoryEntity, { inverseSide: 'category' })
    declare productCategories?: OrmProductCategoryEntity[];

    @OrmCreateDateColumn()
    declare createdAt: Date;
}
