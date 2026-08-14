// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmCreateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmCreateDateColumn';
import { OrmPrimaryAutoColumn } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmTableIndex } from '@system-inc/base-foundation/orm/decorators/OrmTableIndex';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';

@OrmTable('orm_orders')
@OrmTableIndex('idx_customer_status', ['customerId', 'status'])
@OrmTableIndex('idx_order_date', ['orderDate'])
export class OrmOrderEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('serial')
    declare id: number;

    @OrmColumn(
        { kind: 'varchar', length: 20 },
        { unique: true, default: () => `ORD-${Date.now()}` },
    )
    declare orderNumber: string;

    @OrmColumn({ kind: 'integer' })
    declare customerId: number;

    @OrmColumn({ kind: 'varchar', length: 20 }, { default: 'pending' })
    declare status: string;

    @OrmColumn(
        { kind: 'decimal', precision: 10, scale: 2, mode: 'number' },
        { default: 0 },
    )
    declare subtotal: number;

    @OrmColumn(
        { kind: 'decimal', precision: 10, scale: 2, mode: 'number' },
        { default: 8.5 },
    )
    declare tax: number;

    @OrmColumn(
        { kind: 'decimal', precision: 10, scale: 2, mode: 'number' },
        { default: 12.0 },
    )
    declare shipping: number;

    @OrmColumn(
        { kind: 'decimal', precision: 10, scale: 2, mode: 'number' },
        {
            default: function () {
                return 20.5;
            },
        },
    )
    declare total: number;

    @OrmColumn({ kind: 'varchar', length: 10 }, { default: 'USD' })
    declare currency: string;

    @OrmColumn({ kind: 'json' }, { nullable: true })
    declare metadata: Record<string, unknown> | null;

    @OrmColumn(
        { kind: 'datetime', mode: 'date' },
        { default: () => new Date() },
    )
    declare orderDate: Date;

    @OrmColumn({ kind: 'datetime', mode: 'date' }, { nullable: true })
    declare shippedDate: Date | null;

    @OrmColumn({ kind: 'datetime', mode: 'date' }, { nullable: true })
    declare deliveredDate: Date | null;

    @OrmCreateDateColumn()
    declare createdAt: Date;
}
