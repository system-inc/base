// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmJoinColumn } from '@system-inc/base-foundation/orm/decorators/OrmJoinColumn';
import { OrmManyToOne } from '@system-inc/base-foundation/orm/decorators/OrmManyToOne';
import { OrmPrimaryKey } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryKey';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';
import { OrmProductEntity } from './OrmProductEntity';
import { OrmTagEntity } from './OrmTagEntity';

/**
 * Explicit junction entity linking products and tags. Tags use their
 * `name` as the primary key, so the relation demonstrates a join onto
 * a non-`id` referenced column.
 */
@OrmTable('orm_product_tags', { truncatable: true })
@OrmPrimaryKey(['productId', 'tagId'])
export class OrmProductTagEntity extends OrmTrackingEntity {
    @OrmColumn({ kind: 'varchar', length: 36 })
    declare productId: string;

    // The tag's primary key is its name
    @OrmColumn({ kind: 'varchar', length: 50 })
    declare tagId: string;

    @OrmManyToOne(() => OrmProductEntity, {
        joinColumn: 'productId',
        inverseSide: 'productTags',
    })
    @OrmJoinColumn({ name: 'productId', referencedColumnName: 'id' })
    declare product?: OrmProductEntity;

    @OrmManyToOne(() => OrmTagEntity, {
        joinColumn: 'tagId',
        inverseSide: 'productTags',
    })
    @OrmJoinColumn({ name: 'tagId', referencedColumnName: 'name' })
    declare tag?: OrmTagEntity;
}
