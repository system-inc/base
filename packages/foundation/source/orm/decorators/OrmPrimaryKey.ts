// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { AnyClass } from '@system-inc/base-common/type/Constructor';
import { OrmPrimaryKeyOptions } from '../interfaces/OrmPrimaryKeyOptions';
import { ormAddPrimaryKey } from '../metadata/OrmSchemaRegistry';

/**
 * Declares the table's composite primary key on the entity class.
 *
 * A table's primary key is declared exactly once: either a single column
 * (`@OrmPrimaryAutoColumn` or a column with `primaryKey: true`) or this
 * decorator listing the key columns. Order matters — it defines the backing
 * index, so list the hot lookup path first. Conflicting declarations throw at
 * class definition time.
 *
 * @param columns The property names composing the key, in index order.
 * @param options Additional primary key options.
 * @example
 * ```ts
 * // A junction table with a composite key
 * @OrmTable('book_genres')
 * @OrmPrimaryKey(['bookId', 'genreId'])
 * export class BookGenre extends OrmTrackingEntity {
 *     @OrmColumn({ kind: 'varchar', length: 36 })
 *     declare bookId: string;
 *
 *     @OrmColumn({ kind: 'varchar', length: 36 })
 *     declare genreId: string;
 * }
 * ```
 */
export function OrmPrimaryKey(
    columns: string[],
    options?: OrmPrimaryKeyOptions,
) {
    return function <T extends AnyClass>(ctor: T) {
        ormAddPrimaryKey(ctor, columns, options);
    };
}
