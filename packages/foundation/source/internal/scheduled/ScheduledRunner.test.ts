// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { getBaseMetadata } from '../../base/BaseMetadata';
import { BaseInjectionContainer } from '../../dependency-injection/BaseInjectionContainer';
import { ScheduledExecutableContext } from '../../scheduled/ScheduledExecutableContext';
import { ScheduledRunner } from './ScheduledRunner';

const ran: string[] = [];

class SucceedingExecutable {
    async execute(): Promise<void> {
        ran.push('SucceedingExecutable');
    }
}

class FailingExecutable {
    async execute(): Promise<void> {
        ran.push('FailingExecutable');
        throw new Error('boom');
    }
}

class OtherFailingExecutable {
    async execute(): Promise<void> {
        ran.push('OtherFailingExecutable');
        throw new Error('boom2');
    }
}

const container = {
    resolve: (ctor: new () => unknown) => new ctor(),
} as unknown as BaseInjectionContainer;

function contextFor(cron: string): ScheduledExecutableContext {
    return {
        type: 'scheduled',
        cron: cron,
        scheduledTime: 0,
        noRetry: () => {},
        container: container,
    };
}

describe('ScheduledRunner error propagation', () => {
    beforeEach(() => {
        ran.length = 0;
    });

    it('propagates a single executable failure so the platform can retry', async () => {
        const cron = '1 1 1 1 1';
        getBaseMetadata().scheduled.addScheduledExecutable(
            FailingExecutable,
            cron,
        );
        const runner = new ScheduledRunner(container, [FailingExecutable], 1);
        await expect(
            runner.runScheduled(contextFor(cron), cron),
        ).rejects.toThrow('boom');
    });

    it('runs every executable and aggregates when more than one fails', async () => {
        const cron = '2 2 2 2 2';
        getBaseMetadata().scheduled.addScheduledExecutable(
            FailingExecutable,
            cron,
        );
        getBaseMetadata().scheduled.addScheduledExecutable(
            OtherFailingExecutable,
            cron,
        );
        const runner = new ScheduledRunner(
            container,
            [FailingExecutable, OtherFailingExecutable],
            1,
        );
        await expect(
            runner.runScheduled(contextFor(cron), cron),
        ).rejects.toBeInstanceOf(AggregateError);
        // both ran despite the first failing (allSettled, not short-circuit)
        expect(ran).toContain('FailingExecutable');
        expect(ran).toContain('OtherFailingExecutable');
    });

    it('does not throw when all executables succeed', async () => {
        const cron = '3 3 3 3 3';
        getBaseMetadata().scheduled.addScheduledExecutable(
            SucceedingExecutable,
            cron,
        );
        const runner = new ScheduledRunner(
            container,
            [SucceedingExecutable],
            1,
        );
        await expect(
            runner.runScheduled(contextFor(cron), cron),
        ).resolves.toBeUndefined();
        expect(ran).toEqual(['SucceedingExecutable']);
    });
});
