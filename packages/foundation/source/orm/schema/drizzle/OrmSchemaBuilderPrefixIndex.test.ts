// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '../../decorators/OrmColumn';
import { OrmPrimaryAutoColumn } from '../../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../../decorators/OrmTable';
import { OrmTableIndex } from '../../decorators/OrmTableIndex';
import { OrmTrackingEntity } from '../../entity/OrmTrackingEntity';
import { ormRequireTable } from '../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleMySql } from './OrmSchemaBuilderDrizzleMySql';
import { OrmSchemaBuilderDrizzleSQLite } from './OrmSchemaBuilderDrizzleSQLite';

// A varchar(1024) in utf8mb4 reserves 4096 bytes — over InnoDB's
// 3072-byte index-key ceiling on its own, so indexing it requires a
// prefix on MySQL and is the case this whole feature exists for.
@OrmTable('pfx_post_revision')
@OrmTableIndex(['postId', { column: 'title', prefixLength: 191 }])
class PfxPostRevision extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 64 })
    declare postId: string;

    @OrmColumn({ kind: 'varchar', length: 1024 })
    declare title: string;
}

@OrmTable('pfx_plain')
@OrmTableIndex(['name'])
class PfxPlain extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 64 })
    declare name: string;
}

// The full-width index MySQL rejects with errno 1071 mid-migration —
// the builder must refuse it at generate time instead.
@OrmTable('pfx_too_wide')
@OrmTableIndex(['body'])
class PfxTooWide extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 1024 })
    declare body: string;
}

describe('prefix indexes in the MySQL schema builder', () => {
    it('emits the prefix as a raw SQL fragment in runtime and source', () => {
        const builder = new OrmSchemaBuilderDrizzleMySql();
        const schema = builder.createSchema([ormRequireTable(PfxPostRevision)]);
        expect(schema['pfx_post_revision']).toBeDefined();

        const source = builder.getEmittedSource();
        // The two outputs are produced by mirrored code paths
        // (resolveIndexColumn / indexColumnSource); the emitted file is
        // what drizzle-kit serializes into `CREATE INDEX ... title(191)`.
        expect(source).toContain("sql`${table.title}(${sql.raw('191')})`");
        // `sql` is a core drizzle-orm export, so it needs its own import.
        expect(source).toContain("import { sql } from 'drizzle-orm';");
        // The unprefixed column stays a plain reference.
        expect(source).toContain('table.postId');
    });

    it('does not import the core sql helper when nothing uses it', () => {
        const builder = new OrmSchemaBuilderDrizzleMySql();
        builder.createSchema([ormRequireTable(PfxPlain)]);
        expect(builder.getEmittedSource()).not.toContain("from 'drizzle-orm';");
    });

    it('refuses to generate a full-width index MySQL cannot apply', () => {
        const builder = new OrmSchemaBuilderDrizzleMySql();
        expect(() =>
            builder.createSchema([ormRequireTable(PfxTooWide)]),
        ).toThrow(/Schema cannot be applied/);
    });

    it('SQLite ignores the prefix and indexes the whole column', () => {
        const builder = new OrmSchemaBuilderDrizzleSQLite();
        const schema = builder.createSchema([ormRequireTable(PfxPostRevision)]);
        expect(schema['pfx_post_revision']).toBeDefined();

        const source = builder.getEmittedSource();
        expect(source).toContain('table.title');
        expect(source).not.toContain('sql.raw');
        expect(source).not.toContain("from 'drizzle-orm';");
    });
});
