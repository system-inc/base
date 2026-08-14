// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmCreateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmCreateDateColumn';
import { OrmManyToOne } from '@system-inc/base-foundation/orm/decorators/OrmManyToOne';
import { OrmPrimaryAutoColumn } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmUpdateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmUpdateDateColumn';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';
import { OrmPostEntity } from './OrmPostEntity';
import { OrmUserEntity } from './OrmUserEntity';

@OrmTable('orm_comment_entity')
export class OrmCommentEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'text' })
    declare content: string;

    @OrmColumn({ kind: 'uuid' })
    declare authorId: string;

    @OrmColumn({ kind: 'uuid' })
    declare postId: string;

    @OrmCreateDateColumn()
    declare createdAt: Date;

    @OrmUpdateDateColumn()
    declare updatedAt: Date;

    @OrmManyToOne(() => OrmUserEntity, { joinColumn: 'authorId' })
    declare author?: OrmUserEntity;

    @OrmManyToOne(() => OrmPostEntity, { joinColumn: 'postId' })
    declare post?: OrmPostEntity;
}
