// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmCreateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmCreateDateColumn';
import { OrmOneToMany } from '@system-inc/base-foundation/orm/decorators/OrmOneToMany';
import { OrmPrimaryAutoColumn } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmUpdateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmUpdateDateColumn';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';
import { OrmBookGenreEntity } from './OrmBookGenreEntity';

@OrmTable('orm_books')
export class OrmBookEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 255 })
    declare title: string;

    @OrmColumn({ kind: 'varchar', length: 13 }, { unique: true })
    declare isbn: string;

    @OrmColumn({ kind: 'integer' })
    declare pages: number;

    @OrmCreateDateColumn()
    declare createdAt: Date;

    @OrmUpdateDateColumn()
    declare updatedAt: Date;

    // Genres link through an explicit junction entity with custom
    // database column names (book_id/genre_id)
    @OrmOneToMany(() => OrmBookGenreEntity, { inverseSide: 'book' })
    declare genreMappings?: OrmBookGenreEntity[];
}
