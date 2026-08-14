// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmCreateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmCreateDateColumn';
import { OrmOneToMany } from '@system-inc/base-foundation/orm/decorators/OrmOneToMany';
import { OrmPrimaryAutoColumn } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmTableIndex } from '@system-inc/base-foundation/orm/decorators/OrmTableIndex';
import { OrmTableUnique } from '@system-inc/base-foundation/orm/decorators/OrmTableUnique';
import { OrmUpdateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmUpdateDateColumn';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';
import { OrmProductCategoryEntity } from './OrmProductCategoryEntity';
import { OrmProductTagEntity } from './OrmProductTagEntity';

@OrmTable('orm_products', { truncatable: true })
@OrmTableIndex('idx_sku', ['sku'])
@OrmTableIndex('idx_price_status', ['price', 'status'])
@OrmTableUnique('uq_sku_vendor', ['sku', 'vendorCode'])
export class OrmProductEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 100 })
    declare name: string;

    @OrmColumn({ kind: 'varchar', length: 50 }, { unique: true })
    declare sku: string;

    @OrmColumn({ kind: 'varchar', length: 20 }, { nullable: true })
    declare vendorCode: string | null;

    @OrmColumn(
        { kind: 'varchar', length: 512 },
        { default: 'No description available' },
    )
    declare description: string;

    @OrmColumn(
        { kind: 'decimal', precision: 10, scale: 2, mode: 'number' },
        { default: 99.99 },
    )
    declare price: number;

    @OrmColumn({ kind: 'integer' }, { default: 10 })
    declare stockQuantity: number;

    @OrmColumn({ kind: 'boolean' }, { default: true })
    declare isActive: boolean;

    @OrmColumn({ kind: 'varchar', length: 20 }, { default: 'draft' })
    declare status: string;

    @OrmColumn({ kind: 'float' }, { nullable: true, default: 0 })
    declare weight: number | null;

    @OrmColumn({ kind: 'json' }, { nullable: true })
    declare specifications: Record<string, unknown> | null;

    @OrmColumn(
        { kind: 'datetime', mode: 'date' },
        { default: () => new Date() },
    )
    declare publishedAt: Date;

    // Categories and tags link through explicit junction entities
    @OrmOneToMany(() => OrmProductCategoryEntity, { inverseSide: 'product' })
    declare productCategories?: OrmProductCategoryEntity[];

    @OrmOneToMany(() => OrmProductTagEntity, { inverseSide: 'product' })
    declare productTags?: OrmProductTagEntity[];

    @OrmCreateDateColumn()
    declare createdAt: Date;

    @OrmUpdateDateColumn()
    declare updatedAt: Date;
}
