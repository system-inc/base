// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { OrmTableMetadata } from '../metadata/OrmTableMetadata';
import {
    formatIndexKeyLengthFindings,
    innoDbMaximumIndexKeyBytes,
    ormCheckIndexKeyLength,
    ormIndexColumnKeyBytes,
} from './OrmCheckIndexKeyLength';

function tableMetadata(
    partial: Partial<OrmTableMetadata> & { name: string },
): OrmTableMetadata {
    return {
        columns: [],
        indexes: [],
        ...partial,
    } as unknown as OrmTableMetadata;
}

describe('ormIndexColumnKeyBytes', () => {
    it('charges a varchar four bytes per declared character (utf8mb4)', () => {
        // The declared maximum is what MySQL reserves, not the data length.
        expect(ormIndexColumnKeyBytes({ kind: 'varchar', length: 1024 })).toBe(
            4096,
        );
        expect(ormIndexColumnKeyBytes({ kind: 'varchar', length: 191 })).toBe(
            764,
        );
    });

    it('refuses to price a text column, which cannot be indexed without a prefix', () => {
        expect(ormIndexColumnKeyBytes({ kind: 'text' })).toBeUndefined();
    });

    it('prices fixed-width kinds without reference to length', () => {
        expect(ormIndexColumnKeyBytes({ kind: 'boolean' })).toBe(1);
        expect(ormIndexColumnKeyBytes({ kind: 'bigint', mode: 'number' })).toBe(
            8,
        );
        expect(
            ormIndexColumnKeyBytes({ kind: 'enum', values: ['a', 'b'] }),
        ).toBe(2);
    });
});

describe('ormCheckIndexKeyLength', () => {
    it('flags the real Post.title case that broke the 0001 migration', () => {
        // Post.title is varchar(1024) and carried a bare @OrmTableIndex(['title']).
        // 1024 * 4 = 4096 bytes, over the 3072 limit, so MySQL rejected the
        // CREATE INDEX with errno 1071 partway through a live migration.
        const findings = ormCheckIndexKeyLength(
            tableMetadata({
                name: 'Post',
                columns: [
                    {
                        propertyKey: 'title',
                        type: { kind: 'varchar', length: 1024 },
                    },
                ],
                indexes: [{ name: 'ix_post_title', columns: ['title'] }],
            }),
        );

        expect(findings).toHaveLength(1);
        expect(findings[0]?.reason).toBe('TooLong');
        expect(findings[0]?.estimatedBytes).toBe(4096);
        expect(findings[0]?.indexName).toBe('ix_post_title');
    });

    it('sums every column in a composite index', () => {
        // PostRevision(postId, title) failed for the combined width, not
        // either column alone.
        const findings = ormCheckIndexKeyLength(
            tableMetadata({
                name: 'PostRevision',
                columns: [
                    {
                        propertyKey: 'postId',
                        type: { kind: 'varchar', length: 36 },
                    },
                    {
                        propertyKey: 'title',
                        type: { kind: 'varchar', length: 1024 },
                    },
                ],
                indexes: [
                    {
                        name: 'ix_postrevision_postid_title',
                        columns: ['postId', 'title'],
                    },
                ],
            }),
        );

        expect(findings).toHaveLength(1);
        expect(findings[0]?.estimatedBytes).toBe(36 * 4 + 1024 * 4);
    });

    it('permits an index that fits, including one just under the ceiling', () => {
        const findings = ormCheckIndexKeyLength(
            tableMetadata({
                name: 'FileStorage_StoredFile',
                columns: [
                    {
                        propertyKey: 'path',
                        type: { kind: 'varchar', length: 767 },
                    },
                ],
                indexes: [{ name: 'ix_path', columns: ['path'] }],
            }),
        );

        // 767 * 4 = 3068, four bytes under the limit — production's real
        // widest index, and it must keep passing.
        expect(findings).toHaveLength(0);
        expect(767 * 4).toBeLessThan(innoDbMaximumIndexKeyBytes);
    });

    it('reports a text column as needing a prefix rather than as too long', () => {
        const findings = ormCheckIndexKeyLength(
            tableMetadata({
                name: 'Feedback',
                columns: [{ propertyKey: 'body', type: { kind: 'text' } }],
                indexes: [{ name: 'ix_feedback_body', columns: ['body'] }],
            }),
        );

        expect(findings).toHaveLength(1);
        expect(findings[0]?.reason).toBe('TextWithoutPrefix');
    });

    it('charges a prefix by its own width, not the column’s', () => {
        // The fix for the real Post.title failure: 191 * 4 = 764 bytes, which
        // fits, even though the column is varchar(1024).
        const findings = ormCheckIndexKeyLength(
            tableMetadata({
                name: 'Post',
                columns: [
                    {
                        propertyKey: 'title',
                        type: { kind: 'varchar', length: 1024 },
                    },
                ],
                indexes: [
                    {
                        name: 'ix_post_title',
                        columns: [{ column: 'title', prefixLength: 191 }],
                    },
                ],
            }),
        );

        expect(findings).toHaveLength(0);
    });

    it('still flags a prefix that is itself too wide', () => {
        // A prefix is not a free pass — 800 * 4 = 3200 still exceeds the limit.
        const findings = ormCheckIndexKeyLength(
            tableMetadata({
                name: 'PostTopic',
                columns: [
                    {
                        propertyKey: 'path',
                        type: { kind: 'varchar', length: 2048 },
                    },
                ],
                indexes: [
                    {
                        name: 'ix_posttopic_path',
                        columns: [{ column: 'path', prefixLength: 800 }],
                    },
                ],
            }),
        );

        expect(findings).toHaveLength(1);
        expect(findings[0]?.estimatedBytes).toBe(3200);
    });

    it('sums a prefixed column alongside a whole one', () => {
        // The real PostRevision(postId, title) shape: uuid whole + title
        // prefixed. 144 + 764 = 908, comfortably under.
        const findings = ormCheckIndexKeyLength(
            tableMetadata({
                name: 'PostRevision',
                columns: [
                    { propertyKey: 'postId', type: { kind: 'uuid' } },
                    {
                        propertyKey: 'title',
                        type: { kind: 'varchar', length: 1024 },
                    },
                ],
                indexes: [
                    {
                        name: 'ix_postrevision_postid_title',
                        columns: [
                            'postId',
                            { column: 'title', prefixLength: 191 },
                        ],
                    },
                ],
            }),
        );

        expect(findings).toHaveLength(0);
    });

    it('makes a text column indexable when given a prefix', () => {
        const findings = ormCheckIndexKeyLength(
            tableMetadata({
                name: 'Feedback',
                columns: [{ propertyKey: 'body', type: { kind: 'text' } }],
                indexes: [
                    {
                        name: 'ix_feedback_body',
                        columns: [{ column: 'body', prefixLength: 191 }],
                    },
                ],
            }),
        );

        expect(findings).toHaveLength(0);
    });

    it('returns nothing for a table with no indexes', () => {
        expect(
            ormCheckIndexKeyLength(tableMetadata({ name: 'Empty' })),
        ).toHaveLength(0);
    });
});

describe('formatIndexKeyLengthFindings', () => {
    it('names the offending column and the prefix length that would fit', () => {
        const message = formatIndexKeyLengthFindings(
            ormCheckIndexKeyLength(
                tableMetadata({
                    name: 'PostTopic',
                    columns: [
                        {
                            propertyKey: 'path',
                            type: { kind: 'varchar', length: 2048 },
                        },
                    ],
                    indexes: [{ name: 'ix_posttopic_path', columns: ['path'] }],
                }),
            ),
        );

        expect(message).toContain('ix_posttopic_path');
        expect(message).toContain('8192');
        // 3072 / 4 = 768 characters fit.
        expect(message).toContain('768 characters');
    });
});
