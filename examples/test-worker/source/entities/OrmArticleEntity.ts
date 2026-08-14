// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmCreateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmCreateDateColumn';
import { OrmJoinColumn } from '@system-inc/base-foundation/orm/decorators/OrmJoinColumn';
import { OrmManyToOne } from '@system-inc/base-foundation/orm/decorators/OrmManyToOne';
import { OrmPrimaryAutoColumn } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmUpdateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmUpdateDateColumn';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';
import { OrmAuthorEntity } from './OrmAuthorEntity';

@OrmTable('orm_articles')
export class OrmArticleEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 255 })
    declare title: string;

    @OrmColumn({ kind: 'text' })
    declare content: string;

    // Custom database column name for the foreign key
    @OrmColumn({ kind: 'uuid' }, { name: 'writer_id' })
    declare authorId: string;

    @OrmCreateDateColumn()
    declare createdAt: Date;

    @OrmUpdateDateColumn()
    declare updatedAt: Date;

    // Use OrmJoinColumn to specify the property name
    @OrmManyToOne(() => OrmAuthorEntity, { joinColumn: 'authorId' })
    @OrmJoinColumn({ name: 'authorId' })
    declare author?: OrmAuthorEntity;
}
