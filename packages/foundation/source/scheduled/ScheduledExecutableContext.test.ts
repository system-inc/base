// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseInjectionContainer } from '../dependency-injection/BaseInjectionContainer';
import {
    isScheduledExecutableContextScheduledEvent,
    ScheduledExecutableContext,
} from './ScheduledExecutableContext';

describe('ScheduledExecutableContext.create', () => {
    it('calls noRetry with the controller as `this` so it does not throw', () => {
        let noRetryCalled = false;
        // Mimic a workerd ScheduledController: noRetry relies on `this` being
        // the controller, so an unbound copy would throw "Illegal invocation".
        const controller = {
            cron: '0 * * * *',
            scheduledTime: 123,
            noRetry(): void {
                if (this !== controller) {
                    throw new TypeError('Illegal invocation');
                }
                noRetryCalled = true;
            },
        };

        const context = ScheduledExecutableContext.create(
            controller as unknown as ScheduledEvent,
            {} as BaseInjectionContainer,
        );

        expect(isScheduledExecutableContextScheduledEvent(context)).toBe(true);
        if (isScheduledExecutableContextScheduledEvent(context)) {
            expect(() => context.noRetry()).not.toThrow();
        }
        expect(noRetryCalled).toBe(true);
    });
});
