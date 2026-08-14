// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmUpdateDateColumn } from '../decorators/OrmUpdateDateColumn';
import { OrmBaseEntity } from './OrmBaseEntity';

export abstract class OrmMutableBaseEntity extends OrmBaseEntity {
    @OrmUpdateDateColumn({ name: 'updatedAt' })
    declare updatedAt: Date;

    /**
     * Whether this row has been updated since it was created.
     *
     * `updatedAt` is initialized to the same instant as `createdAt` on insert,
     * then bumped on every update — so the row has never been updated exactly
     * when `updatedAt === createdAt`. (This replaces the old "updatedAt is
     * null" sentinel, which couldn't work on backends where the column is
     * NOT NULL.)
     */
    get hasBeenUpdated(): boolean {
        return this.updatedAt.getTime() !== this.createdAt.getTime();
    }
}
