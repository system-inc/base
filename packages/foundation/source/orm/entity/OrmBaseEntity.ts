// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumnIndex } from '../decorators/OrmColumnIndex';
import { OrmCreateDateColumn } from '../decorators/OrmCreateDateColumn';
import { OrmPrimaryAutoColumn } from '../decorators/OrmPrimaryAutoColumn';
import { OrmTrackingEntity } from './OrmTrackingEntity';

export abstract class OrmBaseEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumnIndex()
    @OrmCreateDateColumn({ name: 'createdAt' })
    declare createdAt: Date;
}
