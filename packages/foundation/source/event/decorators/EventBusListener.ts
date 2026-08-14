// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DecoratorRegistry } from '@system-inc/base-common/decorator/DecoratorRegistry';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { getBaseMetadata } from '../../base/BaseMetadata';
import { BaseEvent } from '../BaseEvent';
import { BaseEventListener } from '../BaseEventListener';

export const EventBusListenerDecoratorName = 'EventBusListener';

export function EventBusListener(events: string[] | string) {
    return function <
        T extends new (...args: any[]) => BaseEventListener<BaseEvent>,
    >(constructor: T) {
        if (typeof events === 'string') {
            events = [events];
        }
        DecoratorRegistry.get().mark(
            constructor as Constructor<object>,
            EventBusListenerDecoratorName,
        );
        getBaseMetadata().eventBus.addListener(events, constructor);
    };
}
