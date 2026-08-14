// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmJoinColumn } from '@system-inc/base-foundation/orm/decorators/OrmJoinColumn';
import { OrmManyToOne } from '@system-inc/base-foundation/orm/decorators/OrmManyToOne';
import { OrmPrimaryKey } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryKey';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';
import { OrmCategoryEntity } from './OrmCategoryEntity';
import { OrmProductEntity } from './OrmProductEntity';

/**
 * Explicit junction entity linking products and categories — the
 * supported many-to-many shape: a composite-primary-key table with
 * ordinary many-to-one relations to each side.
 */
@OrmTable('orm_product_categories', { truncatable: true })
@OrmPrimaryKey(['productId', 'categoryId'])
export class OrmProductCategoryEntity extends OrmTrackingEntity {
    @OrmColumn({ kind: 'varchar', length: 36 })
    declare productId: string;

    @OrmColumn({ kind: 'integer' })
    declare categoryId: number;

    @OrmManyToOne(() => OrmProductEntity, {
        joinColumn: 'productId',
        inverseSide: 'productCategories',
    })
    @OrmJoinColumn({ name: 'productId', referencedColumnName: 'id' })
    declare product?: OrmProductEntity;

    @OrmManyToOne(() => OrmCategoryEntity, {
        joinColumn: 'categoryId',
        inverseSide: 'productCategories',
    })
    @OrmJoinColumn({ name: 'categoryId', referencedColumnName: 'id' })
    declare category?: OrmCategoryEntity;
}
