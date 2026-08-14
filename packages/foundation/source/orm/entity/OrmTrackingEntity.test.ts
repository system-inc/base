// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '../decorators/OrmColumn';
import { OrmManyToOne } from '../decorators/OrmManyToOne';
import { OrmOneToMany } from '../decorators/OrmOneToMany';
import { OrmTable } from '../decorators/OrmTable';
import { OrmTrackingEntity } from './OrmTrackingEntity';

// Test entities
@OrmTable('users')
class UserEntity extends OrmTrackingEntity {
    @OrmColumn({ kind: 'uuid' }, { primaryKey: true })
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 255 })
    declare name: string;

    @OrmColumn({ kind: 'varchar', length: 255 })
    declare email: string;

    @OrmOneToMany(() => PostEntity, { inverseSide: 'author' })
    posts?: PostEntity[];

    // Custom property not in metadata
    customField?: string;
}

@OrmTable('posts')
class PostEntity extends OrmTrackingEntity {
    @OrmColumn({ kind: 'uuid' }, { primaryKey: true })
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 255 })
    declare title: string;

    @OrmColumn({ kind: 'text' })
    declare content: string;

    @OrmColumn({ kind: 'uuid' })
    declare authorId: string;

    @OrmManyToOne(() => UserEntity, { inverseSide: 'posts' })
    declare author?: UserEntity;
}

describe('OrmTrackingEntity', () => {
    describe('toJSON serialization', () => {
        it('should serialize only column properties when no relations or custom fields are set', () => {
            const user = UserEntity.from({
                id: '123',
                name: 'John Doe',
                email: 'john@example.com',
            });

            const json = user.toJSON();

            expect(json).toEqual({
                id: '123',
                name: 'John Doe',
                email: 'john@example.com',
            });

            // Should not include internal fields
            expect(json).not.toHaveProperty('_changedFields');
            expect(json).not.toHaveProperty('__id');
            expect(json).not.toHaveProperty('__name');
            expect(json).not.toHaveProperty('__email');
        });

        it('should include loaded relations in serialization', () => {
            const user = UserEntity.from({
                id: '123',
                name: 'John Doe',
                email: 'john@example.com',
            });

            // Simulate loaded relation
            user.posts = [
                PostEntity.from({
                    id: 'post1',
                    title: 'First Post',
                    content: 'Content',
                    authorId: '123',
                }),
            ];

            const json = user.toJSON();

            expect(json).toEqual({
                id: '123',
                name: 'John Doe',
                email: 'john@example.com',
                posts: [
                    {
                        id: 'post1',
                        title: 'First Post',
                        content: 'Content',
                        authorId: '123',
                    },
                ],
            });
        });

        it('should include custom properties in serialization', () => {
            const user = UserEntity.from({
                id: '123',
                name: 'John Doe',
                email: 'john@example.com',
            });

            // Add a custom property
            user.customField = 'custom value';

            const json = user.toJSON();

            expect(json).toEqual({
                id: '123',
                name: 'John Doe',
                email: 'john@example.com',
                customField: 'custom value',
            });
        });

        it('should not include undefined relations', () => {
            const post = PostEntity.from({
                id: 'post1',
                title: 'Test Post',
                content: 'Content',
                authorId: '123',
            });

            // author relation is undefined (not loaded)
            const json = post.toJSON();

            expect(json).toEqual({
                id: 'post1',
                title: 'Test Post',
                content: 'Content',
                authorId: '123',
            });

            // Should not have the author property
            expect(json).not.toHaveProperty('author');
        });

        it('should handle nested relations correctly', () => {
            const user = UserEntity.from({
                id: '123',
                name: 'John Doe',
                email: 'john@example.com',
            });

            const post = PostEntity.from({
                id: 'post1',
                title: 'Test Post',
                content: 'Content',
                authorId: '123',
            });

            // Set up bidirectional relation
            post.author = user;
            user.posts = [post];

            const postJson = post.toJSON();

            expect(postJson).toEqual({
                id: 'post1',
                title: 'Test Post',
                content: 'Content',
                authorId: '123',
                author: {
                    id: '123',
                    name: 'John Doe',
                    email: 'john@example.com',
                    posts: [], // Circular reference is skipped
                },
            });
        });

        it('should throw on circular reference in strict mode', () => {
            const user = UserEntity.from({
                id: '123',
                name: 'John Doe',
                email: 'john@example.com',
            });

            const post = PostEntity.from({
                id: 'post1',
                title: 'Test Post',
                content: 'Content',
                authorId: '123',
            });

            // Set up bidirectional relation
            post.author = user;
            user.posts = [post];

            // Should throw in strict mode
            expect(() => post.toJSON({ strict: true })).toThrow(
                'Circular reference detected during JSON serialization',
            );
        });
    });

    describe('change tracking', () => {
        it('should track changes to properties', () => {
            const user = UserEntity.from({
                id: '123',
                name: 'John Doe',
                email: 'john@example.com',
            });

            // Clear initial changes from creation
            user['clearChangedFields']();

            // Make a change
            user.name = 'Jane Doe';

            const changes = user.getChangedFields();
            expect(changes).toEqual({
                name: 'Jane Doe',
            });
        });

        it('should clear changes after save', () => {
            const user = UserEntity.from({
                id: '123',
                name: 'John Doe',
                email: 'john@example.com',
            });

            // Clear initial changes from creation
            user['clearChangedFields']();

            user.name = 'Jane Doe';
            expect(Object.keys(user.getChangedFields())).toHaveLength(1);

            // Simulate after save
            user['afterSave']();

            expect(Object.keys(user.getChangedFields())).toHaveLength(0);
        });
    });

    describe('clone', () => {
        it('should create a deep copy with cleared change tracking', () => {
            const user = UserEntity.from({
                id: '123',
                name: 'John Doe',
                email: 'john@example.com',
            });

            user.customField = 'custom';
            user.name = 'Jane Doe'; // This creates a change

            const clone = user.clone<UserEntity>();

            // Values should be copied
            expect(clone.id).toBe('123');
            expect(clone.name).toBe('Jane Doe');
            expect(clone.email).toBe('john@example.com');
            expect(clone.customField).toBe('custom');

            // Changes should be cleared
            expect(Object.keys(clone.getChangedFields())).toHaveLength(0);

            // Should be a different instance
            expect(clone).not.toBe(user);
        });
    });

    describe('undecorated subclasses', () => {
        // The view-type pattern: a GraphQL view extends its entity and
        // adds computed getters, without any ORM decorators of its own.
        class UserView extends UserEntity {
            get displayName(): string {
                return `@${this.name}`;
            }

            resetChanges(): void {
                this.clearChangedFields();
            }
        }

        it('resolves the parent entity metadata and tracks changes', () => {
            const view = new UserView();
            Object.assign(
                view,
                UserEntity.from({
                    id: '123',
                    name: 'John Doe',
                    email: 'john@example.com',
                }),
            );

            expect(view.displayName).toBe('@John Doe');

            view.resetChanges();
            view.name = 'Jane Doe';
            expect(Object.keys(view.getChangedFields())).toEqual(['name']);
        });
    });
});
