// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { getBaseMetadata } from '../base/BaseMetadata';
import { BaseInjectionContainer } from '../dependency-injection/BaseInjectionContainer';
import { BaseInjections } from '../dependency-injection/BaseInjections';
import { BaseEvent } from './BaseEvent';
import { BaseEventBus } from './BaseEventBus';
import { BaseEventListener } from './BaseEventListener';

const emitted: string[] = [];

class OkListener implements BaseEventListener<BaseEvent> {
    async onEvent(): Promise<void> {
        emitted.push('OkListener');
    }
}

class FailListener implements BaseEventListener<BaseEvent> {
    async onEvent(): Promise<void> {
        emitted.push('FailListener');
        throw new Error('listener boom');
    }
}

class OtherFailListener implements BaseEventListener<BaseEvent> {
    async onEvent(): Promise<void> {
        emitted.push('OtherFailListener');
        throw new Error('other boom');
    }
}

const deferredActions: Array<() => Promise<void>> = [];
const container = {
    resolve: (token: unknown) => {
        if (token === BaseInjections.DeferredActions.toString()) {
            return {
                append: (action: () => Promise<void>) => {
                    deferredActions.push(action);
                },
            };
        }
        return new (token as new () => unknown)();
    },
} as unknown as BaseInjectionContainer;

describe('BaseEventBus', () => {
    beforeEach(() => {
        emitted.length = 0;
        deferredActions.length = 0;
    });

    it('propagates a listener failure from awaited publish()', async () => {
        getBaseMetadata().eventBus.addListener(['evt.fail'], FailListener);
        const bus = new BaseEventBus([FailListener], container);
        await expect(bus.publish({ name: 'evt.fail' })).rejects.toThrow(
            'listener boom',
        );
    });

    it('emits to every listener and aggregates when several fail', async () => {
        getBaseMetadata().eventBus.addListener(['evt.two'], FailListener);
        getBaseMetadata().eventBus.addListener(['evt.two'], OtherFailListener);
        const bus = new BaseEventBus(
            [FailListener, OtherFailListener],
            container,
        );
        await expect(bus.publish({ name: 'evt.two' })).rejects.toBeInstanceOf(
            AggregateError,
        );
        expect(emitted).toContain('FailListener');
        expect(emitted).toContain('OtherFailListener');
    });

    it('resolves when all listeners succeed', async () => {
        getBaseMetadata().eventBus.addListener(['evt.ok'], OkListener);
        const bus = new BaseEventBus([OkListener], container);
        await expect(bus.publish({ name: 'evt.ok' })).resolves.toBeUndefined();
        expect(emitted).toEqual(['OkListener']);
    });

    it('defer stays best-effort: a failing listener does not reject the deferred action', async () => {
        getBaseMetadata().eventBus.addListener(['evt.defer'], FailListener);
        const bus = new BaseEventBus([FailListener], container);
        bus.defer({ name: 'evt.defer' });
        expect(deferredActions).toHaveLength(1);
        await expect(deferredActions[0]!()).resolves.toBeUndefined();
    });
});
