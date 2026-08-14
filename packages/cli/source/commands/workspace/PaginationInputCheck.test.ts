// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { PaginationInputFor } from '@system-inc/base-foundation/graphql/decorators/PaginationInputFor';
import { PaginationInput } from '@system-inc/base-foundation/graphql/PaginationInput';
import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmColumnIndex } from '@system-inc/base-foundation/orm/decorators/OrmColumnIndex';
import { OrmPrimaryAutoColumn } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmTableIndex } from '@system-inc/base-foundation/orm/decorators/OrmTableIndex';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';
import { checkPaginationInputIndexes } from './PaginationInputCheck';

@OrmTable('pic_order')
@OrmTableIndex('idx_pic_order_status_created', ['status', 'createdAt'])
class PicOrder extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 32 })
    declare status: string;

    @OrmColumn({ kind: 'datetime', mode: 'string' })
    declare createdAt: string;

    @OrmColumn({ kind: 'varchar', length: 128 })
    @OrmColumnIndex()
    declare emailAddress: string;

    @OrmColumn({ kind: 'varchar', length: 128 }, { unique: true })
    declare identifier: string;

    @OrmColumn({ kind: 'varchar', length: 128 })
    declare unindexedNote: string;
}

@PaginationInputFor(PicOrder, {
    // id (primary key), status (composite-index leftmost), emailAddress
    // (column index), identifier (unique) are index-backed;
    // createdAt (composite NON-leftmost) and unindexedNote are not.
    filterColumns: ['id', 'status', 'emailAddress', 'identifier', 'createdAt'],
    orderColumns: ['unindexedNote'],
})
class PicOrderPaginationInput extends PaginationInput {}

// Reference the class so it is not tree-shaken/unused.
void PicOrderPaginationInput;

@OrmTable('pic_asset')
@OrmTableIndex('idx_pic_asset_scope_name', ['bucket', 'status', 'name'])
class PicAsset extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 64 })
    declare bucket: string;

    @OrmColumn({ kind: 'varchar', length: 32 })
    declare status: string;

    @OrmColumn({ kind: 'varchar', length: 128 })
    declare name: string;
}

@PaginationInputFor(PicAsset, {
    // `name` is non-leading in the composite, and the prefix columns
    // (bucket, status) are NOT client-declarable — a server scope.
    orderColumns: ['name'],
})
class PicAssetPaginationInput extends PaginationInput {}
void PicAssetPaginationInput;

@OrmTable('pic_open_asset')
@OrmTableIndex('idx_pic_open_asset_scope_name', ['bucket', 'name'])
class PicOpenAsset extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 64 })
    declare bucket: string;

    @OrmColumn({ kind: 'varchar', length: 128 })
    declare name: string;
}

@PaginationInputFor(PicOpenAsset, {
    // The prefix column IS client-declarable, so `name` can be reached
    // with `bucket` unconstrained — not a scope.
    filterColumns: ['bucket'],
    orderColumns: ['name'],
})
class PicOpenAssetPaginationInput extends PaginationInput {}
void PicOpenAssetPaginationInput;

describe('checkPaginationInputIndexes', () => {
    it('warns only for exposed columns with no index backing them', () => {
        const warnings = checkPaginationInputIndexes().filter(
            (warning) => warning.inputName === 'PicOrderPaginationInput',
        );
        expect(warnings).toEqual([
            expect.objectContaining({
                entityName: 'PicOrder',
                kind: 'filter',
                column: 'createdAt',
            }),
            expect.objectContaining({
                kind: 'order',
                column: 'unindexedNote',
            }),
        ]);
    });

    it('scopeEntities restricts reporting to the given worker entity set', () => {
        const scoped = checkPaginationInputIndexes(new Set([PicOrder])).filter(
            (warning) => warning.inputName === 'PicOrderPaginationInput',
        );
        expect(scoped).toHaveLength(2);

        class UnrelatedEntity {}
        const excluded = checkPaginationInputIndexes(
            new Set([UnrelatedEntity]),
        ).filter((warning) => warning.inputName === 'PicOrderPaginationInput');
        expect(excluded).toHaveLength(0);
    });

    it('does not warn for a column behind a server-scope index prefix', () => {
        // `name` is non-leading in (bucket, status, name), and neither
        // `bucket` nor `status` is declared in the input — a client cannot
        // leave them unconstrained, so the composite serves the seek + sort
        // and a standalone (name) index would never be chosen.
        const warnings = checkPaginationInputIndexes().filter(
            (warning) => warning.inputName === 'PicAssetPaginationInput',
        );
        expect(warnings).toEqual([]);
    });

    it('still warns when the client can name the prefix columns', () => {
        // Same shape as above, but the input ALSO exposes `bucket` — a
        // caller can query `name` without constraining it, which is a real
        // unindexed reach. PicOrder.createdAt covers the same rule via its
        // declared `status` prefix.
        const warnings = checkPaginationInputIndexes().filter(
            (warning) => warning.inputName === 'PicOpenAssetPaginationInput',
        );
        expect(warnings).toEqual([
            expect.objectContaining({
                entityName: 'PicOpenAsset',
                kind: 'order',
                column: 'name',
            }),
        ]);
    });
});
