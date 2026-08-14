// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { validateMigrations } from './DurableSqliteMigrationValidator';

describe('DurableSqliteMigrationValidator', () => {
    describe('Valid migrations', () => {
        test('should allow CREATE TABLE', () => {
            const migrations = {
                m0000: `CREATE TABLE \`users\` (
                    \`id\` text PRIMARY KEY NOT NULL,
                    \`name\` text NOT NULL
                );`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metadata.tablesCreated).toContain('users');
        });

        it('should allow CREATE INDEX on table created in same migration', () => {
            const migrations = {
                m0000: `CREATE TABLE \`users\` (
                    \`id\` text PRIMARY KEY NOT NULL,
                    \`name\` text NOT NULL
                );--> statement-breakpoint
                CREATE INDEX \`idx_name\` ON \`users\` (\`name\`);`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should allow DROP INDEX', () => {
            const migrations = {
                m0000: `DROP INDEX \`idx_old\`;`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should allow ALTER TABLE ADD COLUMN (nullable, no default)', () => {
            const migrations = {
                m0000: `ALTER TABLE \`users\` ADD COLUMN \`email\` text;`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should allow multiple CREATE TABLEs', () => {
            const migrations = {
                m0000: `CREATE TABLE \`users\` (
                    \`id\` text PRIMARY KEY NOT NULL
                );--> statement-breakpoint
                CREATE TABLE \`posts\` (
                    \`id\` text PRIMARY KEY NOT NULL
                );`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metadata.tablesCreated).toContain('users');
            expect(result.metadata.tablesCreated).toContain('posts');
        });
    });

    describe('Prohibited operations', () => {
        it('should warn about DROP TABLE', () => {
            const migrations = {
                m0000: `DROP TABLE \`users\`;`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].rule).toBe('DROP_TABLE');
        });

        it('should prohibit INSERT', () => {
            const migrations = {
                m0000: `INSERT INTO \`users\` (\`id\`, \`name\`) VALUES ('1', 'John');`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].rule).toBe('INSERT');
        });

        it('should prohibit INSERT...SELECT', () => {
            const migrations = {
                m0000: `INSERT INTO \`users_backup\`("id", "name") SELECT "id", "name" FROM \`users\`;`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].rule).toBe('INSERT');
        });

        it('should prohibit DELETE', () => {
            const migrations = {
                m0000: `DELETE FROM \`users\` WHERE \`id\` = '123';`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].rule).toBe('DELETE');
        });

        it('should prohibit UPDATE', () => {
            const migrations = {
                m0000: `UPDATE \`users\` SET \`name\` = 'John' WHERE \`id\` = '123';`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].rule).toBe('UPDATE');
        });

        it('should prohibit VACUUM', () => {
            const migrations = {
                m0000: `VACUUM;`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].rule).toBe('VACUUM');
        });

        it('should prohibit ANALYZE', () => {
            const migrations = {
                m0000: `ANALYZE \`users\`;`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].rule).toBe('ANALYZE');
        });

        it('should prohibit CREATE UNIQUE INDEX', () => {
            const migrations = {
                m0000: `CREATE UNIQUE INDEX \`idx_email\` ON \`users\` (\`email\`);`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].rule).toBe('CREATE_UNIQUE_INDEX');
        });

        it('should warn about CREATE INDEX on existing table', () => {
            const migrations = {
                m0000: `CREATE TABLE \`users\` (
                    \`id\` text PRIMARY KEY NOT NULL
                );`,
                m0001: `CREATE INDEX \`idx_name\` ON \`users\` (\`name\`);`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].rule).toBe('CREATE_INDEX_EXISTING_TABLE');
            expect(result.warnings[0].message).toContain('users');
        });
    });

    describe('ALTER TABLE operations', () => {
        it('should warn about ALTER TABLE DROP COLUMN', () => {
            const migrations = {
                m0000: `ALTER TABLE \`users\` DROP COLUMN \`email\`;`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].rule).toBe('ALTER_DROP_COLUMN');
        });

        it('should warn about ALTER TABLE RENAME COLUMN', () => {
            const migrations = {
                m0000: `ALTER TABLE \`users\` RENAME COLUMN \`name\` TO \`full_name\`;`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].rule).toBe('ALTER_RENAME_COLUMN');
        });

        it('should warn about ALTER TABLE RENAME TO', () => {
            const migrations = {
                m0000: `ALTER TABLE \`users\` RENAME TO \`accounts\`;`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].rule).toBe('ALTER_RENAME_TABLE');
        });

        it('should prohibit ALTER TABLE ADD COLUMN with NOT NULL (no DEFAULT)', () => {
            const migrations = {
                m0000: `ALTER TABLE \`users\` ADD COLUMN \`email\` text NOT NULL;`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].rule).toBe('ALTER_ADD_COLUMN_NOT_NULL');
        });

        it('should allow ALTER TABLE ADD COLUMN with DEFAULT', () => {
            const migrations = {
                m0000: `ALTER TABLE \`users\` ADD COLUMN \`status\` text DEFAULT 'active';`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should prohibit ALTER TABLE ADD COLUMN with UNIQUE constraint', () => {
            const migrations = {
                m0000: `ALTER TABLE \`users\` ADD COLUMN \`email\` text UNIQUE;`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].rule).toBe('ALTER_ADD_CONSTRAINT');
        });

        it('should prohibit ALTER TABLE ADD COLUMN with FOREIGN KEY', () => {
            const migrations = {
                m0000: `ALTER TABLE \`posts\` ADD COLUMN \`userId\` text FOREIGN KEY REFERENCES users(id);`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].rule).toBe('ALTER_ADD_CONSTRAINT');
        });
    });

    describe('Migration count warnings', () => {
        it('should warn when migration count > 15', () => {
            const migrations: Record<string, string> = {};
            for (let i = 0; i < 16; i++) {
                migrations[`m${i.toString().padStart(4, '0')}`] =
                    `CREATE TABLE \`table_${i}\` (\`id\` text PRIMARY KEY);`;
            }

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(
                result.warnings.some((w) => w.rule === 'MIGRATION_COUNT'),
            ).toBe(true);
        });

        it('should error when migration count > 25', () => {
            const migrations: Record<string, string> = {};
            for (let i = 0; i < 26; i++) {
                migrations[`m${i.toString().padStart(4, '0')}`] =
                    `CREATE TABLE \`table_${i}\` (\`id\` text PRIMARY KEY);`;
            }

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(false);
            expect(
                result.errors.some(
                    (e) => e.rule === 'MIGRATION_COUNT_CRITICAL',
                ),
            ).toBe(true);
        });
    });

    describe('Real-world migration examples', () => {
        it('should validate a typical initial migration', () => {
            const migrations = {
                m0000: `CREATE TABLE \`users\` (
                    \`id\` text PRIMARY KEY NOT NULL,
                    \`createdAt\` text NOT NULL,
                    \`email\` text NOT NULL
                );--> statement-breakpoint
                CREATE INDEX \`idx_users_createdat\` ON \`users\` (\`createdAt\`);--> statement-breakpoint
                CREATE INDEX \`idx_users_email\` ON \`users\` (\`email\`);`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metadata.tablesCreated).toContain('users');
        });

        it('should validate adding a nullable column', () => {
            const migrations = {
                m0000: `CREATE TABLE \`users\` (\`id\` text PRIMARY KEY NOT NULL);`,
                m0001: `ALTER TABLE \`users\` ADD \`bio\` text;`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should warn about adding an index to existing table', () => {
            const migrations = {
                m0000: `CREATE TABLE \`users\` (\`id\` text PRIMARY KEY NOT NULL);`,
                m0001: `CREATE INDEX \`idx_users_email\` ON \`users\` (\`email\`);`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.warnings[0].rule).toBe('CREATE_INDEX_EXISTING_TABLE');
            expect(result.warnings[0].message).toContain('users');
        });
    });

    describe('Drizzle table-recreation pattern', () => {
        const recreationMigration = `PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE \`__new_Users\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`status\` text DEFAULT 'active' NOT NULL
);--> statement-breakpoint
INSERT INTO \`__new_Users\`("id", "name", "status") SELECT "id", "name", "status" FROM \`Users\`;--> statement-breakpoint
DROP TABLE \`Users\`;--> statement-breakpoint
ALTER TABLE \`__new_Users\` RENAME TO \`Users\`;--> statement-breakpoint
PRAGMA foreign_keys=ON;`;

        it('should prohibit table-recreation pattern in Production', () => {
            const migrations = { m0000: recreationMigration };

            const result = validateMigrations(migrations, 'Production');

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].rule).toBe('TABLE_RECREATION_BULK_COPY');
            expect(result.errors[0].message).toContain('Users');
        });

        it('should warn about table-recreation pattern in Development', () => {
            const migrations = { m0000: recreationMigration };

            const result = validateMigrations(migrations, 'Development');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(
                result.warnings.some(
                    (w) => w.rule === 'TABLE_RECREATION_BULK_COPY',
                ),
            ).toBe(true);
        });

        it('should detect multiple recreated tables in one migration', () => {
            const migrations = {
                m0000: `PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE \`__new_Users\` (\`id\` text PRIMARY KEY NOT NULL);--> statement-breakpoint
INSERT INTO \`__new_Users\`("id") SELECT "id" FROM \`Users\`;--> statement-breakpoint
DROP TABLE \`Users\`;--> statement-breakpoint
ALTER TABLE \`__new_Users\` RENAME TO \`Users\`;--> statement-breakpoint
CREATE TABLE \`__new_Posts\` (\`id\` text PRIMARY KEY NOT NULL);--> statement-breakpoint
INSERT INTO \`__new_Posts\`("id") SELECT "id" FROM \`Posts\`;--> statement-breakpoint
DROP TABLE \`Posts\`;--> statement-breakpoint
ALTER TABLE \`__new_Posts\` RENAME TO \`Posts\`;--> statement-breakpoint
PRAGMA foreign_keys=ON;`,
            };

            const result = validateMigrations(migrations, 'Production');

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].rule).toBe('TABLE_RECREATION_BULK_COPY');
            expect(result.errors[0].message).toContain('Users');
            expect(result.errors[0].message).toContain('Posts');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty migrations', () => {
            const migrations = {};

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metadata.totalMigrations).toBe(0);
        });

        it('should handle migrations with only comments', () => {
            const migrations = {
                m0000: `-- This is a comment
                -- Another comment`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should handle case-insensitive SQL', () => {
            const migrations = {
                m0000: `create table \`users\` (\`id\` text primary key not null);`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.metadata.tablesCreated).toContain('users');
        });

        it('should warn about unrecognized SQL statements', () => {
            const migrations = {
                m0000: `REINDEX \`users\`;`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].rule).toBe('UNKNOWN_STATEMENT');
        });

        it('should catch statements separated by semicolons without breakpoints', () => {
            const migrations = {
                m0000: `DROP TABLE \`users\`;
INSERT INTO \`users\` (\`id\`) VALUES ('1');`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].rule).toBe('INSERT');
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].rule).toBe('DROP_TABLE');
        });

        it('should handle multiple errors in single migration', () => {
            const migrations = {
                m0000: `DROP TABLE \`users\`;--> statement-breakpoint
                DELETE FROM \`posts\`;--> statement-breakpoint
                UPDATE \`comments\` SET \`status\` = 'archived';`,
            };

            const result = validateMigrations(migrations);

            expect(result.valid).toBe(false);
            // DROP TABLE is a warning, DELETE and UPDATE are errors
            expect(result.errors.length).toBe(2);
            expect(result.warnings.length).toBe(1);
            expect(result.warnings[0].rule).toBe('DROP_TABLE');
        });
    });

    describe('Environment-based validation', () => {
        it('should treat prohibited operations as warnings in Development', () => {
            const migrations = {
                m0000: `DELETE FROM \`users\` WHERE \`id\` = '123';`,
            };

            const result = validateMigrations(migrations, 'Development');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].rule).toBe('DELETE');
            expect(result.warnings[0].message).toContain(
                'This will BLOCK deployment to production',
            );
        });

        it('should treat prohibited operations as errors in Production', () => {
            const migrations = {
                m0000: `DELETE FROM \`users\` WHERE \`id\` = '123';`,
            };

            const result = validateMigrations(migrations, 'Production');

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.warnings).toHaveLength(0);
            expect(result.errors[0].rule).toBe('DELETE');
        });

        it('should treat non-Development environments as Production', () => {
            const migrations = {
                m0000: `UPDATE \`users\` SET \`name\` = 'John';`,
            };

            const result = validateMigrations(migrations, 'Staging');

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.warnings).toHaveLength(0);
            expect(result.errors[0].rule).toBe('UPDATE');
        });

        it('should warn about DROP TABLE in all environments', () => {
            const migrations = {
                m0000: `DROP TABLE \`users\`;`,
            };

            const devResult = validateMigrations(migrations, 'Development');
            const prodResult = validateMigrations(migrations, 'Production');

            // DROP TABLE is a warning in both environments
            expect(devResult.valid).toBe(true);
            expect(devResult.warnings).toHaveLength(1);
            expect(devResult.warnings[0].rule).toBe('DROP_TABLE');

            expect(prodResult.valid).toBe(true);
            expect(prodResult.warnings).toHaveLength(1);
            expect(prodResult.warnings[0].rule).toBe('DROP_TABLE');
        });

        it('should handle multiple prohibited operations in Development', () => {
            const migrations = {
                m0000: `DROP TABLE \`users\`;--> statement-breakpoint
                DELETE FROM \`posts\`;--> statement-breakpoint
                UPDATE \`comments\` SET \`status\` = 'archived';`,
            };

            const result = validateMigrations(migrations, 'Development');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings.length).toBe(3);
            expect(result.warnings[0].rule).toBe('DROP_TABLE');
            expect(result.warnings[1].rule).toBe('DELETE');
            expect(result.warnings[2].rule).toBe('UPDATE');
        });
    });

    describe('Metadata tracking', () => {
        it('should track total migrations count', () => {
            const migrations = {
                m0000: `CREATE TABLE \`table1\` (\`id\` text PRIMARY KEY);`,
                m0001: `CREATE TABLE \`table2\` (\`id\` text PRIMARY KEY);`,
                m0002: `CREATE TABLE \`table3\` (\`id\` text PRIMARY KEY);`,
            };

            const result = validateMigrations(migrations);

            expect(result.metadata.totalMigrations).toBe(3);
        });

        it('should track total statements count', () => {
            const migrations = {
                m0000: `CREATE TABLE \`users\` (\`id\` text PRIMARY KEY);--> statement-breakpoint
                CREATE INDEX \`idx_id\` ON \`users\` (\`id\`);`,
            };

            const result = validateMigrations(migrations);

            expect(result.metadata.totalStatements).toBe(2);
        });

        it('should track all tables created', () => {
            const migrations = {
                m0000: `CREATE TABLE \`users\` (\`id\` text PRIMARY KEY);`,
                m0001: `CREATE TABLE \`posts\` (\`id\` text PRIMARY KEY);`,
                m0002: `CREATE TABLE \`comments\` (\`id\` text PRIMARY KEY);`,
            };

            const result = validateMigrations(migrations);

            expect(result.metadata.tablesCreated).toContain('users');
            expect(result.metadata.tablesCreated).toContain('posts');
            expect(result.metadata.tablesCreated).toContain('comments');
            expect(result.metadata.tablesCreated).toHaveLength(3);
        });
    });
});
