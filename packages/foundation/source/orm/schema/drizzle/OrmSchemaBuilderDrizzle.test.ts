// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '../../decorators/OrmColumn';
import { OrmColumnIndex } from '../../decorators/OrmColumnIndex';
import { OrmColumnUnique } from '../../decorators/OrmColumnUnique';
import { OrmColumnUniqueIndex } from '../../decorators/OrmColumnUniqueIndex';
import { OrmJoinColumn } from '../../decorators/OrmJoinColumn';
import { OrmManyToOne } from '../../decorators/OrmManyToOne';
import { OrmOneToMany } from '../../decorators/OrmOneToMany';
import { OrmOneToOne } from '../../decorators/OrmOneToOne';
import { OrmPrimaryAutoColumn } from '../../decorators/OrmPrimaryAutoColumn';
import { OrmPrimaryKey } from '../../decorators/OrmPrimaryKey';
import { OrmTable } from '../../decorators/OrmTable';
import { OrmTableIndex } from '../../decorators/OrmTableIndex';
import { OrmTableUnique } from '../../decorators/OrmTableUnique';
import { ormGetTable } from '../../metadata/OrmSchemaRegistry';
import type { OrmSchemaBuilderDrizzle } from './OrmSchemaBuilderDrizzle';
import { requireColumnMode } from './OrmSchemaBuilderDrizzle';
import { OrmSchemaBuilderDrizzleMySql } from './OrmSchemaBuilderDrizzleMySql';
import { OrmSchemaBuilderDrizzleSQLite } from './OrmSchemaBuilderDrizzleSQLite';

// Test suite that runs against both MySQL and SQLite builders
describe.each([
    ['MySQL', OrmSchemaBuilderDrizzleMySql],
    ['SQLite', OrmSchemaBuilderDrizzleSQLite],
])('OrmSchemaBuilderDrizzle - %s', (dialectName, BuilderClass) => {
    beforeEach(() => {
        // Clear the registry before each test to avoid interference
        // Note: We'll use unique table names per dialect to avoid conflicts
    });

    describe('Composite Primary Key Support', () => {
        it('should create composite primary key for table', () => {
            // Define a test entity with composite primary key
            @OrmTable(`user_roles_${dialectName}`)
            @OrmPrimaryKey(['userId', 'roleId'])
            class UserRole {
                @OrmColumn({ kind: 'integer' })
                declare userId: number;

                @OrmColumn({ kind: 'integer' })
                declare roleId: number;

                @OrmColumn({ kind: 'varchar', length: 50 })
                declare assignedBy: string;
            }

            // Get metadata
            const metadata = ormGetTable(UserRole);
            expect(metadata).toBeDefined();
            expect(metadata?.primaryKey).toEqual({
                type: 'composite',
                columns: ['userId', 'roleId'],
                name: undefined,
            });

            // Build schema
            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            // Verify the table was created
            expect(schema[`user_roles_${dialectName}`]).toBeDefined();

            // Check that the table has the correct structure
            const table = schema[`user_roles_${dialectName}`];
            expect(table).toBeDefined();

            // The columns should exist
            expect(table.userId).toBeDefined();
            expect(table.roleId).toBeDefined();
            expect(table.assignedBy).toBeDefined();
        });

        it('should create composite primary key with custom name', () => {
            @OrmTable(`order_items_${dialectName}`)
            @OrmPrimaryKey(['orderId', 'productId'], { name: 'pk_order_items' })
            class OrderItem {
                @OrmColumn({ kind: 'integer' })
                declare orderId: number;

                @OrmColumn({ kind: 'integer' })
                declare productId: number;

                @OrmColumn({ kind: 'integer' })
                declare quantity: number;
            }

            const metadata = ormGetTable(OrderItem);
            expect(metadata).toBeDefined();
            expect(metadata?.primaryKey).toEqual({
                type: 'composite',
                columns: ['orderId', 'productId'],
                name: 'pk_order_items',
            });

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`order_items_${dialectName}`]).toBeDefined();
        });

        it('should handle single column primary key', () => {
            @OrmTable(`users_${dialectName}`)
            class User {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare name: string;
            }

            const metadata = ormGetTable(User);
            expect(metadata).toBeDefined();

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`users_${dialectName}`]).toBeDefined();
            const table = schema[`users_${dialectName}`];
            expect(table.id).toBeDefined();
            expect(table.name).toBeDefined();
        });

        it('should handle table with no primary key', () => {
            @OrmTable(`logs_${dialectName}`)
            class Log {
                @OrmColumn({ kind: 'varchar', length: 100 })
                declare message: string;

                @OrmColumn({ kind: 'datetime', mode: 'date' })
                declare timestamp: Date;
            }

            const metadata = ormGetTable(Log);
            expect(metadata).toBeDefined();

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;

            // Should throw an error for tables without primary keys
            expect(() => builder.createSchema([metadata!])).toThrow(
                'Table logs_' + dialectName + ' must have a primary key',
            );
        });
    });

    describe('Table Index Support', () => {
        it('should create single column index', () => {
            @OrmTable(`products_${dialectName}`)
            @OrmTableIndex('idx_name', ['name'])
            class Product {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare name: string;

                @OrmColumn({
                    kind: 'decimal',
                    precision: 10,
                    scale: 2,
                    mode: 'number',
                })
                declare price: number;
            }

            const metadata = ormGetTable(Product);
            expect(metadata).toBeDefined();
            expect(metadata?.indexes).toHaveLength(1);
            expect(metadata?.indexes?.[0]).toEqual({
                columns: ['name'],
                name: 'idx_name',
                options: undefined,
            });

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`products_${dialectName}`]).toBeDefined();
        });

        it('should create composite index on multiple columns', () => {
            @OrmTable(`search_index_${dialectName}`)
            @OrmTableIndex('idx_category_title', ['category', 'title'])
            class SearchIndex {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare category: string;

                @OrmColumn({ kind: 'varchar', length: 200 })
                declare title: string;
            }

            const metadata = ormGetTable(SearchIndex);
            expect(metadata).toBeDefined();
            expect(metadata?.indexes).toHaveLength(1);
            expect(metadata?.indexes?.[0]).toEqual({
                columns: ['category', 'title'],
                name: 'idx_category_title',
                options: undefined,
            });

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`search_index_${dialectName}`]).toBeDefined();
        });

        it('should create unique index', () => {
            @OrmTable(`accounts_${dialectName}`)
            @OrmTableIndex('idx_email', ['email'], { unique: true })
            class Account {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare email: string;
            }

            const metadata = ormGetTable(Account);
            expect(metadata).toBeDefined();
            expect(metadata?.indexes).toHaveLength(1);
            expect(metadata?.indexes?.[0]).toEqual({
                columns: ['email'],
                name: 'idx_email',
                options: { unique: true },
            });

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`accounts_${dialectName}`]).toBeDefined();
        });

        it('should create index using OrmColumnIndex convenience decorator', () => {
            @OrmTable(`products_column_idx_${dialectName}`)
            class Product {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                @OrmColumnIndex()
                declare name: string;

                @OrmColumn({ kind: 'varchar', length: 50 })
                @OrmColumnIndex('idx_custom_sku')
                declare sku: string;
            }

            const metadata = ormGetTable(Product);
            expect(metadata).toBeDefined();
            expect(metadata?.indexes).toHaveLength(2);

            // Check auto-generated index name
            const nameIndex = metadata?.indexes?.find((idx) =>
                idx.columns.includes('name'),
            );
            expect(nameIndex).toBeDefined();
            expect(nameIndex?.name).toBe(
                `ix_products_column_idx_${dialectName.toLowerCase()}_name`,
            );
            expect(nameIndex?.columns).toEqual(['name']);

            // Check custom index name
            const skuIndex = metadata?.indexes?.find((idx) =>
                idx.columns.includes('sku'),
            );
            expect(skuIndex).toBeDefined();
            expect(skuIndex?.name).toBe('idx_custom_sku');
            expect(skuIndex?.columns).toEqual(['sku']);

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema).toHaveProperty(`products_column_idx_${dialectName}`);
        });

        it('should create unique constraint using OrmColumnUnique convenience decorator', () => {
            @OrmTable(`users_column_unq_${dialectName}`)
            class User {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                @OrmColumnUnique()
                declare email: string;

                @OrmColumn({ kind: 'varchar', length: 50 })
                @OrmColumnUnique('unq_custom_username')
                declare username: string;
            }

            const metadata = ormGetTable(User);
            expect(metadata).toBeDefined();
            expect(metadata?.uniqueConstraints).toHaveLength(2);

            // Check auto-generated unique constraint name
            const emailUnique = metadata?.uniqueConstraints?.find((unq) =>
                unq.columns.includes('email'),
            );
            expect(emailUnique).toBeDefined();
            expect(emailUnique?.name).toBe(
                `uc_users_column_unq_${dialectName.toLowerCase()}_email`,
            );
            expect(emailUnique?.columns).toEqual(['email']);

            // Check custom unique constraint name
            const usernameUnique = metadata?.uniqueConstraints?.find((unq) =>
                unq.columns.includes('username'),
            );
            expect(usernameUnique).toBeDefined();
            expect(usernameUnique?.name).toBe('unq_custom_username');
            expect(usernameUnique?.columns).toEqual(['username']);

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema).toHaveProperty(`users_column_unq_${dialectName}`);
        });

        it('should create unique index using OrmColumnUniqueIndex convenience decorator', () => {
            @OrmTable(`products_column_unq_idx_${dialectName}`)
            class Product {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                @OrmColumnUniqueIndex()
                declare sku: string;

                @OrmColumn({ kind: 'varchar', length: 50 })
                @OrmColumnUniqueIndex('unq_idx_custom_code')
                declare code: string;
            }

            const metadata = ormGetTable(Product);
            expect(metadata).toBeDefined();
            expect(metadata?.indexes).toHaveLength(2);

            // Check auto-generated unique index name
            const skuIndex = metadata?.indexes?.find((idx) =>
                idx.columns.includes('sku'),
            );
            expect(skuIndex).toBeDefined();
            expect(skuIndex?.name).toBe(
                `ux_products_column_unq_idx_${dialectName.toLowerCase()}_sku`,
            );
            expect(skuIndex?.columns).toEqual(['sku']);
            expect(skuIndex?.options?.unique).toBe(true);

            // Check custom unique index name
            const codeIndex = metadata?.indexes?.find((idx) =>
                idx.columns.includes('code'),
            );
            expect(codeIndex).toBeDefined();
            expect(codeIndex?.name).toBe('unq_idx_custom_code');
            expect(codeIndex?.columns).toEqual(['code']);
            expect(codeIndex?.options?.unique).toBe(true);

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema).toHaveProperty(
                `products_column_unq_idx_${dialectName}`,
            );
        });
    });

    describe('Unique Constraint Support', () => {
        it('should create composite unique constraint on multiple columns', () => {
            @OrmTable(`user_profiles_${dialectName}`)
            @OrmTableUnique(['firstName', 'lastName'])
            class UserProfile {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 50 })
                declare firstName: string;

                @OrmColumn({ kind: 'varchar', length: 50 })
                declare lastName: string;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare email: string;
            }

            const metadata = ormGetTable(UserProfile);
            expect(metadata).toBeDefined();
            expect(metadata?.uniqueConstraints).toHaveLength(1);
            expect(metadata?.uniqueConstraints?.[0]).toEqual({
                columns: ['firstName', 'lastName'],
                name: `uc_user_profiles_${dialectName.toLowerCase()}_firstname_lastname`,
            });

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`user_profiles_${dialectName}`]).toBeDefined();
        });

        it('should create unique constraint with custom name', () => {
            @OrmTable(`companies_${dialectName}`)
            @OrmTableUnique('uq_tax_id', ['taxId'])
            class Company {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare name: string;

                @OrmColumn({ kind: 'varchar', length: 20 })
                declare taxId: string;
            }

            const metadata = ormGetTable(Company);
            expect(metadata).toBeDefined();
            expect(metadata?.uniqueConstraints).toHaveLength(1);
            expect(metadata?.uniqueConstraints?.[0]).toEqual({
                columns: ['taxId'],
                name: 'uq_tax_id',
            });

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`companies_${dialectName}`]).toBeDefined();
        });
    });

    describe('Default Value Support', () => {
        it('should handle static default values for various column types', () => {
            @OrmTable(`defaults_${dialectName}`)
            class DefaultValues {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn(
                    { kind: 'varchar', length: 50 },
                    { default: 'guest' },
                )
                declare username: string;

                @OrmColumn({ kind: 'integer' }, { default: 0 })
                declare score: number;

                @OrmColumn({ kind: 'boolean' }, { default: true })
                declare isActive: boolean;

                @OrmColumn(
                    {
                        kind: 'decimal',
                        precision: 10,
                        scale: 2,
                        mode: 'number',
                    },
                    { default: 99.99 },
                )
                declare price: number;

                @OrmColumn({ kind: 'text' }, { default: 'No description' })
                declare description: string;
            }

            const metadata = ormGetTable(DefaultValues);
            expect(metadata).toBeDefined();

            // Check that defaults are in metadata
            const columns = metadata?.columns;
            expect(columns).toBeDefined();

            const usernameCol = columns?.find(
                (c) => c.propertyKey === 'username',
            );
            expect(usernameCol?.options?.default).toBe('guest');

            const scoreCol = columns?.find((c) => c.propertyKey === 'score');
            expect(scoreCol?.options?.default).toBe(0);

            const isActiveCol = columns?.find(
                (c) => c.propertyKey === 'isActive',
            );
            expect(isActiveCol?.options?.default).toBe(true);

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`defaults_${dialectName}`]).toBeDefined();
        });

        it('should emit bigint-mode defaults as bigint literals', () => {
            @OrmTable(`bigint_defaults_${dialectName}`)
            class BigIntDefaults {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn(
                    { kind: 'bigint', mode: 'bigint', unsigned: true },
                    { default: 0 },
                )
                declare ratingSum: bigint;

                @OrmColumn(
                    { kind: 'decimal', mode: 'bigint', precision: 20 },
                    { default: 100 },
                )
                declare balance: bigint;

                // number-mode bigint keeps its plain-number default
                @OrmColumn({ kind: 'bigint', mode: 'number' }, { default: 5 })
                declare viewCount: number;
            }

            const metadata = ormGetTable(BigIntDefaults);
            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            builder.createSchema([metadata!]);
            const source = builder.getEmittedSource();

            // drizzle types `.default()` as `bigint` on bigint-mode
            // columns — a number literal would fail typechecking in the
            // generated schema.
            expect(source).toContain('.default(0n)');
            expect(source).toContain('.default(100n)');
            expect(source).toContain('.default(5)');
            expect(source).not.toContain('.default(0)');
            expect(source).not.toContain('.default(100)');
        });

        it('should handle function-based defaults', () => {
            const getCurrentTime = () => new Date();
            const generateId = () => Math.random().toString(36).substr(2, 9);

            @OrmTable(`dynamic_defaults_${dialectName}`)
            class DynamicDefaults {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn(
                    { kind: 'varchar', length: 50 },
                    { default: generateId },
                )
                declare code: string;

                @OrmColumn(
                    { kind: 'datetime', mode: 'date' },
                    { default: getCurrentTime },
                )
                declare createdAt: Date;
            }

            const metadata = ormGetTable(DynamicDefaults);
            expect(metadata).toBeDefined();

            const columns = metadata?.columns;
            const codeCol = columns?.find((c) => c.propertyKey === 'code');
            expect(codeCol?.options?.default).toBe(generateId);

            const createdAtCol = columns?.find(
                (c) => c.propertyKey === 'createdAt',
            );
            expect(createdAtCol?.options?.default).toBe(getCurrentTime);

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`dynamic_defaults_${dialectName}`]).toBeDefined();
        });

        it('should handle UUID with generate flag', () => {
            @OrmTable(`uuid_table_${dialectName}`)
            class UuidTable {
                @OrmColumn(
                    { kind: 'uuid', generate: true },
                    { primaryKey: true },
                )
                declare id: string;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare name: string;
            }

            const metadata = ormGetTable(UuidTable);
            expect(metadata).toBeDefined();

            const columns = metadata?.columns;
            const idCol = columns?.find((c) => c.propertyKey === 'id');
            expect(idCol?.type).toEqual({ kind: 'uuid', generate: true });

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`uuid_table_${dialectName}`]).toBeDefined();
        });
    });

    describe('Column Type Support', () => {
        it('should handle all numeric types', () => {
            @OrmTable(`numeric_types_${dialectName}`)
            class NumericTypes {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn({ kind: 'integer', size: 'int8' })
                declare tinyCol: number;

                @OrmColumn({ kind: 'integer', size: 'int16' })
                declare smallCol: number;

                @OrmColumn({ kind: 'bigint', mode: 'bigint' })
                declare bigCol: bigint;

                @OrmColumn({ kind: 'float' })
                declare floatCol: number;

                @OrmColumn({ kind: 'double' })
                declare doubleCol: number;

                @OrmColumn({
                    kind: 'decimal',
                    precision: 10,
                    scale: 2,
                    mode: 'number',
                })
                declare decimalCol: number;
            }

            const metadata = ormGetTable(NumericTypes);
            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            const table = schema[`numeric_types_${dialectName}`];
            expect(table).toBeDefined();
            expect(table.id).toBeDefined();
            expect(table.tinyCol).toBeDefined();
            expect(table.smallCol).toBeDefined();
            expect(table.bigCol).toBeDefined();
            expect(table.floatCol).toBeDefined();
            expect(table.doubleCol).toBeDefined();
            expect(table.decimalCol).toBeDefined();
        });

        it('should handle all text types', () => {
            @OrmTable(`text_types_${dialectName}`)
            class TextTypes {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn({ kind: 'char', length: 10 })
                declare charCol: string;

                @OrmColumn({ kind: 'varchar', length: 255 })
                declare varcharCol: string;

                @OrmColumn({ kind: 'text' })
                declare textCol: string;

                @OrmColumn({ kind: 'text', size: 'tiny' })
                declare tinyTextCol: string;

                @OrmColumn({ kind: 'text', size: 'medium' })
                declare mediumTextCol: string;

                @OrmColumn({ kind: 'text', size: 'long' })
                declare longTextCol: string;
            }

            const metadata = ormGetTable(TextTypes);
            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            const table = schema[`text_types_${dialectName}`];
            expect(table).toBeDefined();
            expect(table.charCol).toBeDefined();
            expect(table.varcharCol).toBeDefined();
            expect(table.textCol).toBeDefined();
            expect(table.tinyTextCol).toBeDefined();
            expect(table.mediumTextCol).toBeDefined();
            expect(table.longTextCol).toBeDefined();
        });

        it('should handle special types', () => {
            @OrmTable(`special_types_${dialectName}`)
            class SpecialTypes {
                @OrmColumn({ kind: 'integer' }, { primaryKey: true })
                declare id: number;

                @OrmColumn({ kind: 'boolean' })
                declare boolCol: boolean;

                @OrmColumn({ kind: 'datetime', mode: 'date' })
                declare dateCol: Date;

                @OrmColumn({ kind: 'uuid' })
                declare uuidCol: string;

                @OrmColumn({ kind: 'json' })
                declare jsonCol: unknown;

                @OrmColumn({ kind: 'bytes', size: 1024 })
                declare bytesCol: Buffer;

                @OrmColumn({
                    kind: 'enum',
                    values: ['small', 'medium', 'large'],
                })
                declare enumCol: 'small' | 'medium' | 'large';
            }

            const metadata = ormGetTable(SpecialTypes);
            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            const table = schema[`special_types_${dialectName}`];
            expect(table).toBeDefined();
            expect(table.boolCol).toBeDefined();
            expect(table.dateCol).toBeDefined();
            expect(table.uuidCol).toBeDefined();
            expect(table.jsonCol).toBeDefined();
            expect(table.bytesCol).toBeDefined();
            expect(table.enumCol).toBeDefined();
        });
    });

    describe('One-to-Many and Many-to-One Relationships', () => {
        it('should handle one-to-many and many-to-one relationships', () => {
            @OrmTable(`users_rel_${dialectName}`)
            class User {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare name: string;

                @OrmOneToMany(() => Post, { inverseSide: 'author' })
                declare posts?: Post[];
            }

            @OrmTable(`posts_rel_${dialectName}`)
            class Post {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 200 })
                declare title: string;

                @OrmColumn({ kind: 'integer' })
                declare authorId: number;

                @OrmManyToOne(() => User, { joinColumn: 'authorId' })
                declare author?: User;
            }

            const userMeta = ormGetTable(User);
            const postMeta = ormGetTable(Post);

            expect(userMeta).toBeDefined();
            expect(postMeta).toBeDefined();

            // Check relationship metadata
            expect(userMeta?.relations).toHaveLength(1);
            expect(userMeta?.relations[0].type).toBe('one-to-many');
            expect(postMeta?.relations).toHaveLength(1);
            expect(postMeta?.relations[0].type).toBe('many-to-one');

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([userMeta!, postMeta!]);

            // Check tables were created
            expect(schema[`users_rel_${dialectName}`]).toBeDefined();
            expect(schema[`posts_rel_${dialectName}`]).toBeDefined();

            // Check relations were created
            expect(schema[`users_rel_${dialectName}Relations`]).toBeDefined();
            expect(schema[`posts_rel_${dialectName}Relations`]).toBeDefined();
        });

        it('should handle one-to-one relationships', () => {
            // Define both classes first, then add decorators to avoid forward reference issues
            @OrmTable(`profiles_${dialectName}`)
            class Profile {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'integer' }, { unique: true })
                declare userId: number;

                @OrmColumn({ kind: 'text' })
                declare bio: string;

                declare user: unknown; // Will be typed later
            }

            @OrmTable(`users_profile_${dialectName}`)
            class User {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare email: string;

                @OrmOneToOne(() => Profile, { inverseSide: 'user' })
                declare profile?: Profile;
            }

            // Add the reverse relation after both classes are defined
            OrmOneToOne(() => User, { joinColumn: 'userId' })(
                Profile.prototype,
                'user',
            );

            const userMeta = ormGetTable(User);
            const profileMeta = ormGetTable(Profile);

            expect(userMeta).toBeDefined();
            expect(profileMeta).toBeDefined();

            // Check relationship metadata
            expect(userMeta?.relations).toHaveLength(1);
            expect(userMeta?.relations[0].type).toBe('one-to-one');
            expect(profileMeta?.relations).toHaveLength(1);
            expect(profileMeta?.relations[0].type).toBe('one-to-one');

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([userMeta!, profileMeta!]);

            // Check tables and relations were created
            expect(schema[`users_profile_${dialectName}`]).toBeDefined();
            expect(schema[`profiles_${dialectName}`]).toBeDefined();
            expect(
                schema[`users_profile_${dialectName}Relations`],
            ).toBeDefined();
            expect(schema[`profiles_${dialectName}Relations`]).toBeDefined();
        });

        it('should handle mixed relationships including an explicit junction entity', () => {
            @OrmTable(`organizations_${dialectName}`)
            class Organization {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare name: string;

                @OrmOneToMany(() => Employee, { inverseSide: 'organization' })
                declare employees?: Employee[];

                @OrmOneToMany(() => OrganizationProject, {
                    inverseSide: 'organization',
                })
                declare organizationProjects?: OrganizationProject[];
            }

            @OrmTable(`employees_${dialectName}`)
            class Employee {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare name: string;

                @OrmColumn({ kind: 'integer' })
                declare organizationId: number;

                @OrmManyToOne(() => Organization, {
                    joinColumn: 'organizationId',
                })
                declare organization?: Organization;
            }

            @OrmTable(`projects_${dialectName}`)
            class Project {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare name: string;

                @OrmOneToMany(() => OrganizationProject, {
                    inverseSide: 'project',
                })
                declare organizationProjects?: OrganizationProject[];
            }

            // The supported many-to-many shape: an explicit junction
            // entity with a composite primary key and ordinary
            // many-to-one relations to each side.
            @OrmTable(`org_projects_${dialectName}`)
            @OrmPrimaryKey(['organizationId', 'projectId'])
            class OrganizationProject {
                @OrmColumn({ kind: 'integer' })
                declare organizationId: number;

                @OrmColumn({ kind: 'integer' })
                declare projectId: number;

                @OrmManyToOne(() => Organization, {
                    joinColumn: 'organizationId',
                    inverseSide: 'organizationProjects',
                })
                declare organization?: Organization;

                @OrmManyToOne(() => Project, {
                    joinColumn: 'projectId',
                    inverseSide: 'organizationProjects',
                })
                declare project?: Project;
            }

            const orgMeta = ormGetTable(Organization);
            const empMeta = ormGetTable(Employee);
            const projMeta = ormGetTable(Project);
            const junctionMeta = ormGetTable(OrganizationProject);

            expect(orgMeta?.relations).toHaveLength(2);
            expect(empMeta?.relations).toHaveLength(1);
            expect(projMeta?.relations).toHaveLength(1);
            expect(junctionMeta?.relations).toHaveLength(2);

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([
                orgMeta!,
                empMeta!,
                projMeta!,
                junctionMeta!,
            ]);

            // Check all tables were created, including the junction
            expect(schema[`organizations_${dialectName}`]).toBeDefined();
            expect(schema[`employees_${dialectName}`]).toBeDefined();
            expect(schema[`projects_${dialectName}`]).toBeDefined();
            expect(schema[`org_projects_${dialectName}`]).toBeDefined();

            // Check relations were created on both the entities and the
            // junction so relational queries can traverse either way
            expect(
                schema[`organizations_${dialectName}Relations`],
            ).toBeDefined();
            expect(schema[`projects_${dialectName}Relations`]).toBeDefined();
            expect(
                schema[`org_projects_${dialectName}Relations`],
            ).toBeDefined();
        });
    });

    describe('Advanced Column Constraints', () => {
        it('should handle columns with multiple constraints (unique + index)', () => {
            @OrmTable(`multi_constraint_${dialectName}`)
            @OrmTableIndex('idx_email_lookup', ['email'])
            @OrmTableIndex('idx_username', ['username'])
            class MultiConstraint {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 }, { unique: true })
                declare email: string;

                @OrmColumn({ kind: 'varchar', length: 50 })
                declare username: string;
            }

            const metadata = ormGetTable(MultiConstraint);
            expect(metadata).toBeDefined();

            // Check column has unique constraint
            const emailCol = metadata?.columns.find(
                (c) => c.propertyKey === 'email',
            );
            expect(emailCol?.options?.unique).toBe(true);

            // Check indexes
            expect(metadata?.indexes).toHaveLength(2);

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`multi_constraint_${dialectName}`]).toBeDefined();
        });

        it('should handle nullable columns with defaults', () => {
            @OrmTable(`nullable_defaults_${dialectName}`)
            class NullableDefaults {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn(
                    { kind: 'varchar', length: 100 },
                    { nullable: true, default: 'Anonymous' },
                )
                declare name: string | null;

                @OrmColumn({ kind: 'integer' }, { nullable: true, default: 0 })
                declare score: number | null;

                @OrmColumn(
                    { kind: 'datetime', mode: 'date' },
                    { nullable: true, default: () => new Date() },
                )
                declare lastSeen: Date | null;

                @OrmColumn({ kind: 'text' }, { nullable: true })
                declare notes: string | null;
            }

            const metadata = ormGetTable(NullableDefaults);
            expect(metadata).toBeDefined();

            // Check nullable and default settings
            const nameCol = metadata?.columns.find(
                (c) => c.propertyKey === 'name',
            );
            expect(nameCol?.options?.nullable).toBe(true);
            expect(nameCol?.options?.default).toBe('Anonymous');

            const scoreCol = metadata?.columns.find(
                (c) => c.propertyKey === 'score',
            );
            expect(scoreCol?.options?.nullable).toBe(true);
            expect(scoreCol?.options?.default).toBe(0);

            const lastSeenCol = metadata?.columns.find(
                (c) => c.propertyKey === 'lastSeen',
            );
            expect(lastSeenCol?.options?.nullable).toBe(true);
            expect(typeof lastSeenCol?.options?.default).toBe('function');

            const notesCol = metadata?.columns.find(
                (c) => c.propertyKey === 'notes',
            );
            expect(notesCol?.options?.nullable).toBe(true);
            expect(notesCol?.options?.default).toBeUndefined();

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`nullable_defaults_${dialectName}`]).toBeDefined();
        });

        it('should handle auto-increment columns', () => {
            @OrmTable(`auto_increment_${dialectName}`)
            class AutoIncrement {
                @OrmColumn(
                    { kind: 'integer', increment: true },
                    { primaryKey: true },
                )
                declare id: number;

                @OrmColumn({ kind: 'bigint', mode: 'bigint', increment: true })
                declare sequenceNumber: bigint;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare name: string;
            }

            const metadata = ormGetTable(AutoIncrement);
            expect(metadata).toBeDefined();

            const idCol = metadata?.columns.find((c) => c.propertyKey === 'id');
            expect(idCol?.type).toEqual({ kind: 'integer', increment: true });
            expect(idCol?.options?.primaryKey).toBe(true);

            const seqCol = metadata?.columns.find(
                (c) => c.propertyKey === 'sequenceNumber',
            );
            expect(seqCol?.type).toEqual({
                kind: 'bigint',
                mode: 'bigint',
                increment: true,
            });

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`auto_increment_${dialectName}`]).toBeDefined();
        });

        it('should handle unsigned numeric types', () => {
            @OrmTable(`unsigned_nums_${dialectName}`)
            class UnsignedNumbers {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'integer', unsigned: true })
                declare count: number;

                @OrmColumn({ kind: 'bigint', mode: 'bigint', unsigned: true })
                declare bigCount: bigint;

                @OrmColumn({ kind: 'float', unsigned: true })
                declare rating: number;

                @OrmColumn({ kind: 'double', unsigned: true })
                declare price: number;

                @OrmColumn({
                    kind: 'decimal',
                    precision: 10,
                    scale: 2,
                    unsigned: true,
                    mode: 'number',
                })
                declare amount: number;
            }

            const metadata = ormGetTable(UnsignedNumbers);
            expect(metadata).toBeDefined();

            const countCol = metadata?.columns.find(
                (c) => c.propertyKey === 'count',
            );
            expect(countCol?.type).toMatchObject({
                kind: 'integer',
                unsigned: true,
            });

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`unsigned_nums_${dialectName}`]).toBeDefined();
        });

        it('should handle table with multiple unique constraints and indexes together', () => {
            @OrmTable(`complex_constraints_${dialectName}`)
            @OrmTableUnique('uq_email', ['email'])
            @OrmTableUnique('uq_username', ['username'])
            @OrmTableUnique('uq_country_phone', ['countryCode', 'phone'])
            @OrmTableIndex('idx_email_search', ['email'])
            @OrmTableIndex('idx_username_search', ['username'])
            @OrmTableIndex('idx_postal', ['postalCode'])
            @OrmTableIndex('idx_country_postal', ['countryCode', 'postalCode'])
            class ComplexConstraints {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare email: string;

                @OrmColumn({ kind: 'varchar', length: 50 })
                declare username: string;

                @OrmColumn({ kind: 'varchar', length: 20 })
                declare phone: string;

                @OrmColumn({ kind: 'varchar', length: 10 })
                declare countryCode: string;

                @OrmColumn({ kind: 'varchar', length: 20 })
                declare postalCode: string;
            }

            const metadata = ormGetTable(ComplexConstraints);
            expect(metadata).toBeDefined();

            // Check unique constraints
            expect(metadata?.uniqueConstraints).toHaveLength(3);
            expect(
                metadata?.uniqueConstraints?.find((u) => u.name === 'uq_email'),
            ).toBeDefined();
            expect(
                metadata?.uniqueConstraints?.find(
                    (u) => u.name === 'uq_country_phone',
                ),
            ).toBeDefined();

            // Check indexes
            expect(metadata?.indexes).toHaveLength(4);
            expect(
                metadata?.indexes?.find((i) => i.name === 'idx_email_search'),
            ).toBeDefined();
            expect(
                metadata?.indexes?.find((i) => i.name === 'idx_country_postal'),
            ).toBeDefined();

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            expect(schema[`complex_constraints_${dialectName}`]).toBeDefined();
        });
    });

    describe('OrmJoinColumn Support', () => {
        it('should handle custom join column names with OrmJoinColumn', () => {
            // Declare classes first to avoid forward reference issues
            @OrmTable(`writers_${dialectName}`)
            class Writer {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare name: string;

                @OrmOneToMany(() => Article, { inverseSide: 'author' })
                declare articles: unknown;
            }

            @OrmTable(`articles_${dialectName}`)
            class Article {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 200 })
                declare title: string;

                @OrmColumn({ kind: 'integer' }, { name: 'writer_id' })
                declare writerId: number;

                @OrmManyToOne(() => Writer)
                @OrmJoinColumn({ name: 'writerId' }) // Use the property name
                declare author?: Writer;
            }

            const articleMeta = ormGetTable(Article);
            const writerMeta = ormGetTable(Writer);

            expect(articleMeta).toBeDefined();
            expect(writerMeta).toBeDefined();

            // Check that join column configuration is stored
            expect(articleMeta?.joinColumns).toBeDefined();
            expect(articleMeta?.joinColumns?.['author']).toEqual({
                name: 'writerId', // Property name
            });

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([articleMeta!, writerMeta!]);

            // Check tables were created
            expect(schema[`articles_${dialectName}`]).toBeDefined();
            expect(schema[`writers_${dialectName}`]).toBeDefined();

            // Check relations were created
            expect(schema[`articles_${dialectName}Relations`]).toBeDefined();
            expect(schema[`writers_${dialectName}Relations`]).toBeDefined();
        });

        it('should handle custom referenced column with OrmJoinColumn', () => {
            // Declare classes first to avoid forward reference issues
            @OrmTable(`owners_${dialectName}`)
            class Owner {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 50 }, { unique: true })
                declare code: string;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare name: string;

                @OrmOneToMany(() => Document, { inverseSide: 'owner' })
                declare documents: unknown;
            }

            @OrmTable(`documents_${dialectName}`)
            class Document {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 200 })
                declare title: string;

                @OrmColumn(
                    { kind: 'varchar', length: 50 },
                    { name: 'owner_code' },
                )
                declare ownerCode: string;

                @OrmManyToOne(() => Owner)
                @OrmJoinColumn({
                    name: 'ownerCode', // Use the property name
                    referencedColumnName: 'code',
                })
                declare owner?: Owner;
            }

            const docMeta = ormGetTable(Document);
            const ownerMeta = ormGetTable(Owner);

            expect(docMeta).toBeDefined();
            expect(ownerMeta).toBeDefined();

            // Check that join column configuration is stored
            expect(docMeta?.joinColumns?.['owner']).toEqual({
                name: 'ownerCode', // Property name
                referencedColumnName: 'code',
            });

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([docMeta!, ownerMeta!]);

            expect(schema[`documents_${dialectName}`]).toBeDefined();
            expect(schema[`owners_${dialectName}`]).toBeDefined();
        });

        it('should handle one-to-one with custom join column', () => {
            @OrmTable(`accounts_join_${dialectName}`)
            class Account {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 100 })
                declare email: string;

                @OrmOneToOne(() => Settings, { inverseSide: 'account' })
                declare settings: unknown;
            }

            @OrmTable(`settings_${dialectName}`)
            class Settings {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'integer' }, { unique: true })
                declare accountRef: number;

                @OrmColumn({ kind: 'boolean' })
                declare darkMode: boolean;

                @OrmOneToOne(() => Account)
                @OrmJoinColumn({ name: 'accountRef' }) // Use the property name
                declare account?: Account;
            }

            const accountMeta = ormGetTable(Account);
            const settingsMeta = ormGetTable(Settings);

            expect(accountMeta).toBeDefined();
            expect(settingsMeta).toBeDefined();

            // Check join column configuration
            expect(settingsMeta?.joinColumns?.['account']).toEqual({
                name: 'accountRef', // Property name
            });

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([accountMeta!, settingsMeta!]);

            expect(schema[`accounts_join_${dialectName}`]).toBeDefined();
            expect(schema[`settings_${dialectName}`]).toBeDefined();
            expect(
                schema[`accounts_join_${dialectName}Relations`],
            ).toBeDefined();
            expect(schema[`settings_${dialectName}Relations`]).toBeDefined();
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle columns with custom names', () => {
            @OrmTable(`custom_names_${dialectName}`)
            class CustomNames {
                @OrmColumn(
                    { kind: 'integer' },
                    { primaryKey: true, name: 'custom_id' },
                )
                declare id: number;

                @OrmColumn(
                    { kind: 'varchar', length: 100 },
                    { name: 'user_full_name' },
                )
                declare fullName: string;

                @OrmColumn(
                    { kind: 'datetime', mode: 'date' },
                    { name: 'created_timestamp' },
                )
                declare createdAt: Date;
            }

            const metadata = ormGetTable(CustomNames);
            expect(metadata).toBeDefined();

            const idCol = metadata?.columns.find((c) => c.propertyKey === 'id');
            expect(idCol?.options?.name).toBe('custom_id');

            const nameCol = metadata?.columns.find(
                (c) => c.propertyKey === 'fullName',
            );
            expect(nameCol?.options?.name).toBe('user_full_name');

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            const table = schema[`custom_names_${dialectName}`];
            expect(table).toBeDefined();
            // The actual columns should use the property keys in the schema object
            expect(table.id).toBeDefined();
            expect(table.fullName).toBeDefined();
            expect(table.createdAt).toBeDefined();
        });

        it('should handle table inheritance with proper metadata merging', () => {
            @OrmTable(`base_entity_${dialectName}`)
            class BaseEntity {
                @OrmPrimaryAutoColumn('serial')
                declare id: number;

                @OrmColumn({ kind: 'datetime', mode: 'date' })
                declare createdAt: Date;

                @OrmColumn({ kind: 'datetime', mode: 'date' })
                declare updatedAt: Date;
            }

            @OrmTable(`extended_entity_${dialectName}`)
            class ExtendedEntity extends BaseEntity {
                @OrmColumn({ kind: 'varchar', length: 100 })
                declare name: string;

                @OrmColumn({ kind: 'text' })
                declare description: string;
            }

            const metadata = ormGetTable(ExtendedEntity);
            expect(metadata).toBeDefined();

            // Should have columns from both base and extended class
            expect(metadata?.columns).toHaveLength(5);
            expect(
                metadata?.columns.find((c) => c.propertyKey === 'id'),
            ).toBeDefined();
            expect(
                metadata?.columns.find((c) => c.propertyKey === 'createdAt'),
            ).toBeDefined();
            expect(
                metadata?.columns.find((c) => c.propertyKey === 'updatedAt'),
            ).toBeDefined();
            expect(
                metadata?.columns.find((c) => c.propertyKey === 'name'),
            ).toBeDefined();
            expect(
                metadata?.columns.find((c) => c.propertyKey === 'description'),
            ).toBeDefined();

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            const table = schema[`extended_entity_${dialectName}`];
            expect(table).toBeDefined();
            expect(table.id).toBeDefined();
            expect(table.createdAt).toBeDefined();
            expect(table.updatedAt).toBeDefined();
            expect(table.name).toBeDefined();
            expect(table.description).toBeDefined();
        });

        it(`should support table-level decorators on abstract classes`, () => {
            // Abstract class with table-level decorators
            @OrmTableIndex('idx_base', ['baseField'])
            @OrmTableUnique('unq_unique_field', ['uniqueField'])
            abstract class AbstractEntity {
                @OrmColumn({ kind: 'varchar', length: 100 })
                declare baseField: string;

                @OrmColumn({ kind: 'varchar', length: 50 })
                declare uniqueField: string;
            }

            // Concrete class extending abstract class
            @OrmTable(`concrete_entity_${dialectName}`)
            @OrmPrimaryKey(['id'])
            class ConcreteEntity extends AbstractEntity {
                @OrmColumn({ kind: 'integer' })
                declare id: number;

                @OrmColumn({ kind: 'varchar', length: 200 })
                declare email: string;
            }

            const metadata = ormGetTable(ConcreteEntity);
            expect(metadata).toBeDefined();

            // Should have columns from both abstract and concrete class
            expect(metadata?.columns).toHaveLength(4);
            expect(
                metadata?.columns.find((c) => c.propertyKey === 'id'),
            ).toBeDefined();
            expect(
                metadata?.columns.find((c) => c.propertyKey === 'baseField'),
            ).toBeDefined();
            expect(
                metadata?.columns.find((c) => c.propertyKey === 'uniqueField'),
            ).toBeDefined();
            expect(
                metadata?.columns.find((c) => c.propertyKey === 'email'),
            ).toBeDefined();

            // Should have indexes from abstract class
            expect(metadata?.indexes).toHaveLength(1);
            const index = metadata?.indexes[0];
            expect(index?.columns).toEqual(['baseField']);

            // Should have unique constraints from abstract class
            expect(metadata?.uniqueConstraints).toHaveLength(1);
            const unique = metadata?.uniqueConstraints[0];
            expect(unique?.columns).toEqual(['uniqueField']);

            // Should have primary key from concrete class
            expect(metadata?.primaryKey).toBeDefined();
            expect(metadata?.primaryKey?.type).toBe('composite');
            if (metadata?.primaryKey?.type === 'composite') {
                expect(metadata.primaryKey.columns).toEqual(['id']);
            }

            const builder = new BuilderClass() as OrmSchemaBuilderDrizzle;
            const schema = builder.createSchema([metadata!]);

            const table = schema[`concrete_entity_${dialectName}`];
            expect(table).toBeDefined();
            expect(table.id).toBeDefined();
            expect(table.baseField).toBeDefined();
            expect(table.uniqueField).toBeDefined();
            expect(table.email).toBeDefined();
        });
    });
});

describe('requireColumnMode', () => {
    it('throws when a mode-bearing column carries no mode (JS callers bypass the type requirement)', () => {
        for (const kind of ['bigint', 'decimal', 'datetime']) {
            expect(() =>
                requireColumnMode(
                    {
                        propertyKey: 'legacyColumn',
                        type: { kind },
                    } as never,
                    ['number', 'bigint'],
                ),
            ).toThrow(/must declare mode/);
        }
    });

    it('returns the declared mode when present', () => {
        expect(
            requireColumnMode(
                {
                    propertyKey: 'col',
                    type: { kind: 'decimal', mode: 'string' },
                } as never,
                ['string', 'number', 'bigint'],
            ),
        ).toBe('string');
    });
});
