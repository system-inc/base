// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmAfterLoad } from '../decorators/OrmAfterLoad';
import { OrmColumn } from '../decorators/OrmColumn';
import { OrmCreateDateColumn } from '../decorators/OrmCreateDateColumn';
import { OrmPrimaryAutoColumn } from '../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../decorators/OrmTable';
import { OrmUpdateDateColumn } from '../decorators/OrmUpdateDateColumn';
import { OrmTrackingEntity } from '../entity/OrmTrackingEntity';
import { OrmEntityHydrator } from './OrmEntityHydrator';

@OrmTable('test_users')
class TestUser extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 255 })
    declare name: string;

    @OrmColumn({ kind: 'integer' })
    declare age: number;

    @OrmColumn({ kind: 'boolean' }, { nullable: true })
    declare isActive?: boolean;

    @OrmCreateDateColumn()
    declare createdAt: Date;

    @OrmUpdateDateColumn()
    declare updatedAt: Date;

    afterLoadCalled = false;

    @OrmAfterLoad()
    protected onAfterLoad() {
        this.afterLoadCalled = true;
    }
}

describe('OrmEntityHydrator', () => {
    describe('hydrateOne', () => {
        it('should hydrate a raw object into an entity instance', () => {
            const raw = {
                id: '123',
                name: 'John Doe',
                age: 30,
                isActive: true,
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
            };

            const result = OrmEntityHydrator.hydrateOne(raw, TestUser, {});

            expect(result).toBeInstanceOf(TestUser);
            expect(result!.id).toBe('123');
            expect(result!.name).toBe('John Doe');
            expect(result!.age).toBe(30);
            expect(result!.isActive).toBe(true);
            expect(result!.createdAt).toEqual(new Date('2024-01-01'));
            expect(result!.updatedAt).toEqual(new Date('2024-01-02'));
        });

        it('should return null for null input', () => {
            const result = OrmEntityHydrator.hydrateOne(null, TestUser, {});
            expect(result).toBeNull();
        });

        it('should return null for undefined input', () => {
            const result = OrmEntityHydrator.hydrateOne(
                undefined,
                TestUser,
                {},
            );
            expect(result).toBeNull();
        });

        it('should call afterLoad lifecycle hook', () => {
            const raw = {
                id: '123',
                name: 'John Doe',
                age: 30,
            };

            const result = OrmEntityHydrator.hydrateOne(raw, TestUser, {});
            expect(result!.afterLoadCalled).toBe(true);
        });

        it('should clear changed fields after hydration', () => {
            const raw = {
                id: '123',
                name: 'John Doe',
                age: 30,
            };

            const result = OrmEntityHydrator.hydrateOne(raw, TestUser, {});
            const changedFields = result!.getChangedFields();
            expect(Object.keys(changedFields)).toHaveLength(0);
        });

        it('should return raw object when raw option is true', () => {
            const raw = {
                id: '123',
                name: 'John Doe',
                age: 30,
            };

            const result = OrmEntityHydrator.hydrateOne(raw, TestUser, {
                raw: true,
            });
            expect(result).toBe(raw);
            expect(result).not.toBeInstanceOf(TestUser);
        });
    });

    describe('hydrateMany', () => {
        it('should hydrate an array of raw objects', () => {
            const rawArray = [
                {
                    id: '1',
                    name: 'User 1',
                    age: 25,
                },
                {
                    id: '2',
                    name: 'User 2',
                    age: 35,
                },
            ];

            const results = OrmEntityHydrator.hydrateMany(
                rawArray,
                TestUser,
                {},
            );

            expect(results).toHaveLength(2);
            expect(results[0]).toBeInstanceOf(TestUser);
            expect(results[0].id).toBe('1');
            expect(results[0].name).toBe('User 1');
            expect(results[1]).toBeInstanceOf(TestUser);
            expect(results[1].id).toBe('2');
            expect(results[1].name).toBe('User 2');
        });

        it('should return empty array for empty input', () => {
            const results = OrmEntityHydrator.hydrateMany([], TestUser, {});
            expect(results).toEqual([]);
        });

        it('should return raw array when raw option is true', () => {
            const rawArray = [
                { id: '1', name: 'User 1' },
                { id: '2', name: 'User 2' },
            ];

            const results = OrmEntityHydrator.hydrateMany(rawArray, TestUser, {
                raw: true,
            });
            expect(results).toBe(rawArray);
            expect(results[0]).not.toBeInstanceOf(TestUser);
        });
    });

    describe('Entity.from static method', () => {
        it('should be used for hydration when available', () => {
            const raw = {
                id: '123',
                name: 'Jane Smith',
                age: 28,
            };

            const result = OrmEntityHydrator.hydrateOne(raw, TestUser, {});

            expect(result).toBeInstanceOf(TestUser);
            expect(result!.id).toBe('123');
            expect(result!.name).toBe('Jane Smith');
            expect(result!.age).toBe(28);
        });
    });
});
