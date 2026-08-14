// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseEvent } from './BaseEvent';

export interface BaseEventListener<T extends BaseEvent> {
    onEvent(event: T): void | Promise<void>;
}
