// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmCreateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmCreateDateColumn';
import { OrmOneToMany } from '@system-inc/base-foundation/orm/decorators/OrmOneToMany';
import { OrmPrimaryAutoColumn } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmUpdateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmUpdateDateColumn';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';
import { OrmCommentEntity } from './OrmCommentEntity';
import { OrmPostEntity } from './OrmPostEntity';

@OrmTable('orm_user_entity', { truncatable: true })
export class OrmUserEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 255 })
    declare username: string;

    @OrmColumn({ kind: 'varchar', length: 255 })
    declare email: string;

    @OrmCreateDateColumn()
    declare createdAt: Date;

    @OrmUpdateDateColumn()
    declare updatedAt: Date;

    @OrmOneToMany(() => OrmPostEntity, { inverseSide: 'author' })
    declare posts?: OrmPostEntity[];

    @OrmOneToMany(() => OrmCommentEntity, { inverseSide: 'author' })
    declare comments?: OrmCommentEntity[];
}
