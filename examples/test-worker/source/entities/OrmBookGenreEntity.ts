// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmJoinColumn } from '@system-inc/base-foundation/orm/decorators/OrmJoinColumn';
import { OrmManyToOne } from '@system-inc/base-foundation/orm/decorators/OrmManyToOne';
import { OrmPrimaryKey } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryKey';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';
import { OrmBookEntity } from './OrmBookEntity';
import { OrmGenreEntity } from './OrmGenreEntity';

/**
 * Explicit junction entity linking books and genres, with database
 * column names (`book_id`/`genre_id`) that differ from the property
 * names.
 */
@OrmTable('orm_book_genre_mapping', { truncatable: true })
@OrmPrimaryKey(['bookId', 'genreId'])
export class OrmBookGenreEntity extends OrmTrackingEntity {
    @OrmColumn({ kind: 'varchar', length: 36 }, { name: 'book_id' })
    declare bookId: string;

    @OrmColumn({ kind: 'varchar', length: 36 }, { name: 'genre_id' })
    declare genreId: string;

    @OrmManyToOne(() => OrmBookEntity, {
        joinColumn: 'bookId',
        inverseSide: 'genreMappings',
    })
    @OrmJoinColumn({ name: 'book_id', referencedColumnName: 'id' })
    declare book?: OrmBookEntity;

    @OrmManyToOne(() => OrmGenreEntity, {
        joinColumn: 'genreId',
        inverseSide: 'bookMappings',
    })
    @OrmJoinColumn({ name: 'genre_id', referencedColumnName: 'id' })
    declare genre?: OrmGenreEntity;
}
