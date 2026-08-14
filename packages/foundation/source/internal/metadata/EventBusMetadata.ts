// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { BaseEvent } from '../../event/BaseEvent';
import { BaseEventListener } from '../../event/BaseEventListener';

export class EventBusMetadata {
    private readonly listeners: {
        listener: Constructor<BaseEventListener<BaseEvent>>;
        events: string[];
    }[] = [];

    addListener(
        events: string[],
        listener: Constructor<BaseEventListener<BaseEvent>>,
    ): void {
        this.listeners.push({ events, listener });
    }

    getListeners(): {
        listener: Constructor<BaseEventListener<BaseEvent>>;
        events: string[];
    }[] {
        return this.listeners;
    }
}
