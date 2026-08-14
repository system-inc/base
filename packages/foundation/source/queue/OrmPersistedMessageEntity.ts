// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { PersistentMessageStatus } from '@system-inc/base-common/worker-queue/PersistentMessageStatus';
import { OrmColumn } from '../orm/decorators/OrmColumn';
import { OrmColumnIndex } from '../orm/decorators/OrmColumnIndex';
import { OrmMutableBaseEntity } from '../orm/entity/OrmMutableBaseEntity';

/**
 * Base class for messages that are persisted before being queued.
 * Orm (Drizzle) counterpart of {@link PersistedMessageEntity}: the row
 * tracks the message's processing status across the queue lifecycle.
 * Extend it with the message's specific data.
 */
export abstract class OrmPersistedMessageEntity extends OrmMutableBaseEntity {
    @OrmColumnIndex()
    @OrmColumn({ kind: 'enum', values: PersistentMessageStatus })
    declare status: PersistentMessageStatus;

    /**
     * The time at which the status was last changed.
     */
    @OrmColumn({ kind: 'datetime', mode: 'date' }, { nullable: true })
    declare statusChangedAt: Date | null;

    /**
     * Metadata specifically related to the current status of the job.
     */
    @OrmColumn({ kind: 'json' }, { nullable: true })
    declare statusMeta: object | null;

    /**
     * Update the status of the job.
     */
    updateStatus(status: PersistentMessageStatus, statusMeta?: object) {
        this.status = status;
        this.statusChangedAt = new Date();
        this.statusMeta = statusMeta || null;
    }
}
