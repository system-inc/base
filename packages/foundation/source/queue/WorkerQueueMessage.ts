// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Represents a message that will be sent to a worker queue.
 */
export interface WorkerQueueMessage<PayloadType = unknown> {
    type: string;
    payload: PayloadType;
}

/**
 * A message that has been received by a woker queue
 * and will processed by a WorkerQueueProcessor.
 *
 * This interface extends the Message interface from the Cloudflare Workers Types.
 */
export type WorkerQueueProcessorMessage<PayloadType = unknown> = Message<
    WorkerQueueMessage<PayloadType>
>;
