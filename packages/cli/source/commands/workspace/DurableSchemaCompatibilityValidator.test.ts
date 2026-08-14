// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
    DrizzleColumn,
    DrizzleIndex,
    DrizzleSnapshot,
    DrizzleTable,
    formatValidationResult,
    loadLatestSnapshot,
    validateSchemaCompatibility,
} from './DurableSchemaCompatibilityValidator';

/**
 * Snapshot factory — minimal valid Drizzle snapshot shape with overrides.
 * The compatibility validator only inspects `tables`, so the meta
 * scaffolding around it can stay empty.
 */
function snapshot(tables: Record<string, DrizzleTable> = {}): DrizzleSnapshot {
    return {
        version: '7',
        dialect: 'sqlite',
        id: 'test-id',
        prevId: 'prev-id',
        tables,
        views: {},
        enums: {},
        _meta: { schemas: {}, tables: {}, columns: {} },
        internal: { indexes: {} },
    };
}

function table(
    name: string,
    columns: Record<string, DrizzleColumn> = {},
    indexes: Record<string, DrizzleIndex> = {},
): DrizzleTable {
    return {
        name,
        columns,
        indexes,
        foreignKeys: {},
        compositePrimaryKeys: {},
        uniqueConstraints: {},
        checkConstraints: {},
    };
}

function column(
    name: string,
    overrides: Partial<DrizzleColumn> = {},
): DrizzleColumn {
    return {
        name,
        type: 'text',
        primaryKey: false,
        notNull: false,
        autoincrement: false,
        ...overrides,
    };
}

function index(
    name: string,
    columns: string[],
    isUnique = false,
): DrizzleIndex {
    return { name, columns, isUnique };
}

describe('validateSchemaCompatibility', () => {
    it('passes for identical schemas', () => {
        const t = table('users', { id: column('id', { primaryKey: true }) });
        const dev = snapshot({ users: t });
        const target = snapshot({ users: t });

        const result = validateSchemaCompatibility(
            dev,
            target,
            'Production',
            '0005',
            '0005',
        );

        expect(result.compatible).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
        // Pass-through fields stay on the result for telemetry.
        expect(result.targetEnvironment).toBe('Production');
        expect(result.devSnapshotVersion).toBe('0005');
        expect(result.targetSnapshotVersion).toBe('0005');
    });

    describe('table-level rules', () => {
        it('reports MISSING_TABLE_IN_TARGET when dev has a table the target lacks', () => {
            const dev = snapshot({
                users: table('users'),
                orders: table('orders'),
            });
            const target = snapshot({ users: table('users') });

            const result = validateSchemaCompatibility(
                dev,
                target,
                'Production',
                '0002',
                '0001',
            );

            expect(result.compatible).toBe(false);
            const missing = result.errors.find(
                (e) => e.rule === 'MISSING_TABLE_IN_TARGET',
            );
            expect(missing).toBeDefined();
            expect(missing?.table).toBe('orders');
        });

        it('reports EXTRA_TABLE_IN_TARGET when target has a table dev lacks', () => {
            const dev = snapshot({ users: table('users') });
            const target = snapshot({
                users: table('users'),
                ghost: table('ghost'),
            });

            const result = validateSchemaCompatibility(
                dev,
                target,
                'Production',
                '0001',
                '0001',
            );

            expect(result.compatible).toBe(false);
            const extra = result.errors.find(
                (e) => e.rule === 'EXTRA_TABLE_IN_TARGET',
            );
            expect(extra).toBeDefined();
            expect(extra?.table).toBe('ghost');
        });
    });

    describe('column-level rules', () => {
        it('flags MISSING_COLUMN_IN_TARGET', () => {
            const dev = snapshot({
                users: table('users', {
                    id: column('id'),
                    email: column('email'),
                }),
            });
            const target = snapshot({
                users: table('users', { id: column('id') }),
            });

            const result = validateSchemaCompatibility(
                dev,
                target,
                'Production',
                '0001',
                '0001',
            );

            const issue = result.errors.find(
                (e) => e.rule === 'MISSING_COLUMN_IN_TARGET',
            );
            expect(issue?.column).toBe('email');
            expect(result.compatible).toBe(false);
        });

        it('flags EXTRA_COLUMN_IN_TARGET', () => {
            const dev = snapshot({
                users: table('users', { id: column('id') }),
            });
            const target = snapshot({
                users: table('users', {
                    id: column('id'),
                    secret: column('secret'),
                }),
            });

            const result = validateSchemaCompatibility(
                dev,
                target,
                'Production',
                '0001',
                '0001',
            );

            const issue = result.errors.find(
                (e) => e.rule === 'EXTRA_COLUMN_IN_TARGET',
            );
            expect(issue?.column).toBe('secret');
        });

        it('flags COLUMN_TYPE_MISMATCH', () => {
            const dev = snapshot({
                users: table('users', {
                    age: column('age', { type: 'integer' }),
                }),
            });
            const target = snapshot({
                users: table('users', { age: column('age', { type: 'text' }) }),
            });

            const result = validateSchemaCompatibility(
                dev,
                target,
                'Production',
                '0001',
                '0001',
            );

            const issue = result.errors.find(
                (e) => e.rule === 'COLUMN_TYPE_MISMATCH',
            );
            expect(issue?.column).toBe('age');
            expect(issue?.devValue).toBe('integer');
            expect(issue?.targetValue).toBe('text');
        });

        it('flags COLUMN_NULLABILITY_MISMATCH', () => {
            const dev = snapshot({
                users: table('users', {
                    email: column('email', { notNull: true }),
                }),
            });
            const target = snapshot({
                users: table('users', {
                    email: column('email', { notNull: false }),
                }),
            });

            const result = validateSchemaCompatibility(
                dev,
                target,
                'Production',
                '0001',
                '0001',
            );

            const issue = result.errors.find(
                (e) => e.rule === 'COLUMN_NULLABILITY_MISMATCH',
            );
            expect(issue?.column).toBe('email');
            expect(issue?.devValue).toBe('NOT NULL');
            expect(issue?.targetValue).toBe('NULLABLE');
        });

        it('flags COLUMN_PRIMARY_KEY_MISMATCH', () => {
            const dev = snapshot({
                users: table('users', {
                    id: column('id', { primaryKey: true }),
                }),
            });
            const target = snapshot({
                users: table('users', {
                    id: column('id', { primaryKey: false }),
                }),
            });

            const result = validateSchemaCompatibility(
                dev,
                target,
                'Production',
                '0001',
                '0001',
            );

            expect(
                result.errors.some(
                    (e) => e.rule === 'COLUMN_PRIMARY_KEY_MISMATCH',
                ),
            ).toBe(true);
        });

        it('flags COLUMN_AUTOINCREMENT_MISMATCH', () => {
            const dev = snapshot({
                users: table('users', {
                    id: column('id', { autoincrement: true }),
                }),
            });
            const target = snapshot({
                users: table('users', {
                    id: column('id', { autoincrement: false }),
                }),
            });

            const result = validateSchemaCompatibility(
                dev,
                target,
                'Production',
                '0001',
                '0001',
            );

            expect(
                result.errors.some(
                    (e) => e.rule === 'COLUMN_AUTOINCREMENT_MISMATCH',
                ),
            ).toBe(true);
        });
    });

    describe('index-level rules (warnings, not errors)', () => {
        // Index drift is a perf concern, not a correctness one — deploy
        // is allowed. These tests pin that distinction so the rule never
        // accidentally gets promoted to a hard fail.
        it('warns on missing index in target', () => {
            const dev = snapshot({
                users: table(
                    'users',
                    { id: column('id') },
                    { idx_email: index('idx_email', ['email']) },
                ),
            });
            const target = snapshot({
                users: table('users', { id: column('id') }, {}),
            });

            const result = validateSchemaCompatibility(
                dev,
                target,
                'Production',
                '0001',
                '0001',
            );

            expect(result.compatible).toBe(true);
            expect(result.errors).toEqual([]);
            expect(
                result.warnings.some(
                    (w) => w.rule === 'MISSING_INDEX_IN_TARGET',
                ),
            ).toBe(true);
        });

        it('warns on extra index in target', () => {
            const dev = snapshot({
                users: table('users', { id: column('id') }, {}),
            });
            const target = snapshot({
                users: table(
                    'users',
                    { id: column('id') },
                    { idx_ghost: index('idx_ghost', ['ghost']) },
                ),
            });

            const result = validateSchemaCompatibility(
                dev,
                target,
                'Production',
                '0001',
                '0001',
            );

            expect(result.compatible).toBe(true);
            expect(
                result.warnings.some((w) => w.rule === 'EXTRA_INDEX_IN_TARGET'),
            ).toBe(true);
        });

        it('warns on index column-list mismatch', () => {
            const dev = snapshot({
                users: table(
                    'users',
                    { id: column('id') },
                    { idx_a: index('idx_a', ['email']) },
                ),
            });
            const target = snapshot({
                users: table(
                    'users',
                    { id: column('id') },
                    { idx_a: index('idx_a', ['email', 'created_at']) },
                ),
            });

            const result = validateSchemaCompatibility(
                dev,
                target,
                'Production',
                '0001',
                '0001',
            );

            expect(
                result.warnings.some(
                    (w) => w.rule === 'INDEX_COLUMNS_MISMATCH',
                ),
            ).toBe(true);
        });

        it('warns on index uniqueness mismatch', () => {
            const dev = snapshot({
                users: table(
                    'users',
                    { id: column('id') },
                    { idx_a: index('idx_a', ['email'], true) },
                ),
            });
            const target = snapshot({
                users: table(
                    'users',
                    { id: column('id') },
                    { idx_a: index('idx_a', ['email'], false) },
                ),
            });

            const result = validateSchemaCompatibility(
                dev,
                target,
                'Production',
                '0001',
                '0001',
            );

            expect(
                result.warnings.some(
                    (w) => w.rule === 'INDEX_UNIQUENESS_MISMATCH',
                ),
            ).toBe(true);
        });
    });

    it('accumulates multiple unrelated issues without short-circuiting', () => {
        // The validator should report every problem in one pass so the
        // user can fix them in one go.
        const dev = snapshot({
            users: table(
                'users',
                {
                    id: column('id', { primaryKey: true, type: 'integer' }),
                    email: column('email', { notNull: true }),
                },
                { idx_email: index('idx_email', ['email']) },
            ),
            orders: table('orders'),
        });
        const target = snapshot({
            users: table(
                'users',
                {
                    id: column('id', { primaryKey: false, type: 'text' }),
                    // email missing entirely
                },
                {},
            ),
            // orders missing
            ghost: table('ghost'),
        });

        const result = validateSchemaCompatibility(
            dev,
            target,
            'Production',
            '0001',
            '0001',
        );

        expect(result.compatible).toBe(false);
        // Multiple errors accumulated.
        expect(result.errors.length).toBeGreaterThanOrEqual(4);
        const rules = new Set(result.errors.map((e) => e.rule));
        expect(rules).toContain('MISSING_TABLE_IN_TARGET');
        expect(rules).toContain('EXTRA_TABLE_IN_TARGET');
        expect(rules).toContain('MISSING_COLUMN_IN_TARGET');
        expect(rules).toContain('COLUMN_TYPE_MISMATCH');
        expect(rules).toContain('COLUMN_PRIMARY_KEY_MISMATCH');
        // Index missing — warning, not error.
        expect(
            result.warnings.some((w) => w.rule === 'MISSING_INDEX_IN_TARGET'),
        ).toBe(true);
    });
});

describe('formatValidationResult', () => {
    it('produces a PASSED header when compatible', () => {
        const formatted = formatValidationResult({
            compatible: true,
            targetEnvironment: 'Production',
            devSnapshotVersion: '0005',
            targetSnapshotVersion: '0005',
            errors: [],
            warnings: [],
        });

        expect(formatted).toContain('PASSED');
        expect(formatted).toContain('Safe to deploy to Production');
    });

    it('produces a FAILED + BLOCKED footer when incompatible', () => {
        const formatted = formatValidationResult({
            compatible: false,
            targetEnvironment: 'Production',
            devSnapshotVersion: '0002',
            targetSnapshotVersion: '0001',
            errors: [
                {
                    rule: 'MISSING_TABLE_IN_TARGET',
                    severity: 'ERROR',
                    table: 'orders',
                    message: "Table 'orders' missing",
                    suggestion: 'Run migrations',
                },
            ],
            warnings: [],
        });

        expect(formatted).toContain('FAILED');
        expect(formatted).toContain('BLOCKED');
        expect(formatted).toContain('orders');
    });

    it('reports warnings without blocking when compatible', () => {
        const formatted = formatValidationResult({
            compatible: true,
            targetEnvironment: 'Production',
            devSnapshotVersion: '0001',
            targetSnapshotVersion: '0001',
            errors: [],
            warnings: [
                {
                    rule: 'MISSING_INDEX_IN_TARGET',
                    severity: 'WARNING',
                    table: 'users',
                    index: 'idx_email',
                    message: 'Index missing',
                },
            ],
        });

        expect(formatted).toContain('Deployment allowed');
        expect(formatted).toContain('warning');
    });
});

describe('loadLatestSnapshot', () => {
    let metaDir: string;

    beforeEach(() => {
        metaDir = fs.realpathSync(
            fs.mkdtempSync(path.join(os.tmpdir(), 'base-cli-snapshot-')),
        );
    });

    afterEach(() => {
        fs.rmSync(metaDir, { recursive: true, force: true });
    });

    function writeJournal(entries: Array<{ idx: number; tag: string }>): void {
        fs.writeFileSync(
            path.join(metaDir, '_journal.json'),
            JSON.stringify({ entries }),
        );
    }

    function writeSnapshot(
        idx: number,
        body: Partial<DrizzleSnapshot> = {},
    ): void {
        const fileName = `${String(idx).padStart(4, '0')}_snapshot.json`;
        fs.writeFileSync(
            path.join(metaDir, fileName),
            JSON.stringify({ ...snapshot(), ...body, id: `id-${idx}` }),
        );
    }

    it('returns the snapshot with the highest idx', async () => {
        writeJournal([
            { idx: 0, tag: 'init' },
            { idx: 2, tag: 'newest' },
            { idx: 1, tag: 'middle' },
        ]);
        writeSnapshot(0);
        writeSnapshot(1);
        writeSnapshot(2);

        const result = await loadLatestSnapshot(metaDir);

        expect(result.version).toBe('0002');
        expect(result.snapshot.id).toBe('id-2');
    });

    it('zero-pads the version to four digits', async () => {
        writeJournal([{ idx: 7, tag: 'lone' }]);
        writeSnapshot(7);

        const result = await loadLatestSnapshot(metaDir);

        expect(result.version).toBe('0007');
    });

    it('throws when the journal is missing', async () => {
        await expect(loadLatestSnapshot(metaDir)).rejects.toThrow(
            /Failed to read migration journal/,
        );
    });

    it('throws when the journal has no entries', async () => {
        writeJournal([]);

        await expect(loadLatestSnapshot(metaDir)).rejects.toThrow(
            /No migrations found/,
        );
    });

    it('throws when the snapshot file referenced by the journal is missing', async () => {
        writeJournal([{ idx: 3, tag: 'orphan' }]);
        // Don't write the matching 0003_snapshot.json.

        await expect(loadLatestSnapshot(metaDir)).rejects.toThrow(
            /Failed to read snapshot/,
        );
    });
});
