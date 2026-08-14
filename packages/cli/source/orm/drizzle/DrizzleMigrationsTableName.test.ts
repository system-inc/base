// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { drizzleMigrationsTableName } from './OrmGetDrizzleBoilerplate';

describe('drizzleMigrationsTableName', () => {
    it('derives a per-worker table from the worker name', () => {
        expect(drizzleMigrationsTableName('test-worker')).toBe(
            '__drizzle_migrations_test_worker',
        );
    });

    it('lowercases and collapses non-alphanumeric runs to single underscores', () => {
        expect(drizzleMigrationsTableName('My.Cool  Worker!!')).toBe(
            '__drizzle_migrations_my_cool_worker',
        );
    });

    it('does not leave leading/trailing underscores from the slug', () => {
        expect(drizzleMigrationsTableName('--edge--')).toBe(
            '__drizzle_migrations_edge',
        );
    });

    it('distinct workers get distinct tables (no shared default table)', () => {
        expect(drizzleMigrationsTableName('alpha')).not.toBe(
            drizzleMigrationsTableName('beta'),
        );
    });

    it('caps the table name at MySQL’s 64-char identifier limit', () => {
        const name = drizzleMigrationsTableName('a'.repeat(200));
        expect(name.length).toBe(64);
        expect(name.startsWith('__drizzle_migrations_')).toBe(true);
    });
});
