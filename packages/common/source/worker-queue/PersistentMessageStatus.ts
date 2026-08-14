// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * The different statuses that a job on a worker queue can be in.
 */
export enum PersistentMessageStatus {
    Pending = 'Pending',
    Processing = 'Processing',
    Success = 'Success',
    Failed = 'Failed',
    Cancelled = 'Cancelled',
}

export namespace PersistentMessageStatus {
    /**
     * Determines if the status is a final status for the queue job.
     *
     * @param status
     * @returns
     */
    export function isFinalStatus(status: PersistentMessageStatus): boolean {
        return (
            status === PersistentMessageStatus.Success ||
            status === PersistentMessageStatus.Failed ||
            status === PersistentMessageStatus.Cancelled
        );
    }
}
