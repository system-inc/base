// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { once } from 'events';
import { AddressInfo, createConnection, createServer, Server } from 'net';
import { networkInterfaces } from 'os';

import { CRON_ANY_TRIGGER } from '@system-inc/base-common/cron/CronExpression';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { BaseServerSettings } from '../../base/BaseServerSettings';
import { ExecutionModeType } from '../../configuration/ExecutionMode';
import { ScheduledExecutable } from '../../scheduled/decorators/ScheduledExecutable';
import {
    isScheduledExecutableContextScheduledEvent,
    ScheduledExecutableContext,
} from '../../scheduled/ScheduledExecutableContext';
import { ScheduledExecutableInterface } from '../../scheduled/ScheduledExecutableInterface';
import { ScheduledSettings } from '../../scheduled/ScheduledSettings';
import { BaseWorker } from '../BaseWorker';
import { BaseWorkerNodeRunner } from './BaseWorkerNodeRunner';

/**
 * An IPv4 address of this machine that isn't loopback, or `undefined` when
 * the machine has none (some CI sandboxes only have `lo`).
 */
const nonLoopbackAddress = Object.values(networkInterfaces())
    .flat()
    .find(
        (address) => address?.family === 'IPv4' && !address.internal,
    )?.address;

const itWithNonLoopbackAddress = nonLoopbackAddress ? it : it.skip;

async function freePort(): Promise<number> {
    const server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as AddressInfo).port;
    server.close();
    await once(server, 'close');
    return port;
}

/**
 * Resolves whether a TCP connection to the address is accepted.
 */
async function acceptsConnection(host: string, port: number): Promise<boolean> {
    const socket = createConnection({ host, port });
    try {
        await once(socket, 'connect');
        return true;
    } catch {
        return false;
    } finally {
        socket.destroy();
    }
}

function createRunner(server: BaseServerSettings): BaseWorkerNodeRunner {
    return new BaseWorkerNodeRunner(
        BaseWorker.create({
            name: 'node-runner-test',
            title: 'Node Runner Test',
            version: '1.0.0',
            modules: [],
            services: [],
            server: { '@default': server },
        }),
    );
}

describe('BaseWorkerNodeRunner', () => {
    const originalPort = process.env.PORT;
    let runner: BaseWorkerNodeRunner | undefined;

    beforeEach(() => {
        // process.env.PORT outranks settings; keep it from leaking in
        delete process.env.PORT;
    });

    afterEach(async () => {
        await runner?.stop();
        runner = undefined;
        if (originalPort !== undefined) {
            process.env.PORT = originalPort;
        }
    });

    itWithNonLoopbackAddress(
        'binds the configured host and refuses connections on other addresses',
        async () => {
            const port = await freePort();
            runner = createRunner({ port, host: '127.0.0.1' });
            await runner.start({ ENVIRONMENT: 'Test' });

            expect(await acceptsConnection('127.0.0.1', port)).toBe(true);
            expect(await acceptsConnection(nonLoopbackAddress!, port)).toBe(
                false,
            );
        },
    );

    itWithNonLoopbackAddress(
        'binds every interface when no host is configured',
        async () => {
            const port = await freePort();
            runner = createRunner({ port });
            await runner.start({ ENVIRONMENT: 'Test' });

            expect(await acceptsConnection('127.0.0.1', port)).toBe(true);
            expect(await acceptsConnection(nonLoopbackAddress!, port)).toBe(
                true,
            );
        },
    );

    it('rejects start() when the port is already taken', async () => {
        const port = await freePort();
        const occupant: Server = createServer();
        occupant.listen(port, '127.0.0.1');
        await once(occupant, 'listening');
        try {
            runner = createRunner({ port, host: '127.0.0.1' });
            await expect(
                runner.start({ ENVIRONMENT: 'Test' }),
            ).rejects.toMatchObject({ code: 'EADDRINUSE' });
        } finally {
            occupant.close();
            await once(occupant, 'close');
        }
    });

    it('rejects a URL-valued host before binding', async () => {
        runner = createRunner({
            port: await freePort(),
            host: 'https://app-test.example.workers.dev',
        });
        await expect(runner.start({ ENVIRONMENT: 'Test' })).rejects.toThrow(
            "server['@default'].host must be a hostname or IP address",
        );
    });

    it('stops listening once stop() resolves', async () => {
        const port = await freePort();
        runner = createRunner({ port, host: '127.0.0.1' });
        await runner.start({ ENVIRONMENT: 'Test' });

        await runner.stop();

        expect(await acceptsConnection('127.0.0.1', port)).toBe(false);
    });
});

interface ScheduledRun {
    readonly executable: string;
    readonly scope: string;
    readonly cron?: string;
    readonly scheduledTime?: number;
}

const scheduledRuns: ScheduledRun[] = [];

function recordRun(executable: string, context: ScheduledExecutableContext) {
    scheduledRuns.push({
        executable,
        scope: context.container.scope,
        ...(isScheduledExecutableContextScheduledEvent(context) && {
            cron: context.cron,
            scheduledTime: context.scheduledTime,
        }),
    });
}

@ScheduledExecutable('*/5 * * * *')
class EveryFiveMinutes implements ScheduledExecutableInterface {
    async execute(context: ScheduledExecutableContext): Promise<void> {
        recordRun('EveryFiveMinutes', context);
    }
}

@ScheduledExecutable(CRON_ANY_TRIGGER)
class OnAnyTrigger implements ScheduledExecutableInterface {
    async execute(context: ScheduledExecutableContext): Promise<void> {
        recordRun('OnAnyTrigger', context);
    }
}

function createScheduledRunner(
    services: Constructor<object>[],
    server: BaseServerSettings,
    scheduled?: ScheduledSettings,
): BaseWorkerNodeRunner {
    return new BaseWorkerNodeRunner(
        BaseWorker.create({
            name: 'node-runner-scheduled-test',
            title: 'Node Runner Scheduled Test',
            version: '1.0.0',
            modules: [],
            services,
            server: { '@default': server },
            scheduled,
        }),
    );
}

describe('BaseWorkerNodeRunner scheduled executables', () => {
    let runner: BaseWorkerNodeRunner | undefined;

    beforeEach(() => {
        delete process.env.PORT;
        scheduledRuns.length = 0;
    });

    afterEach(async () => {
        await runner?.stop();
        runner = undefined;
        jest.useRealTimers();
    });

    /**
     * Fakes the clock and timers only: the HTTP server's own callbacks
     * (nextTick, setImmediate) stay real.
     */
    function fakeClockAt(iso: string) {
        jest.useFakeTimers({
            now: new Date(iso),
            doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
        });
    }

    it('fires an executable on its cron, in a @scheduled container', async () => {
        fakeClockAt('2026-11-02T10:01:00Z');
        runner = createScheduledRunner([EveryFiveMinutes], {
            port: await freePort(),
            host: '127.0.0.1',
        });
        await runner.start({ ENVIRONMENT: 'Test' });

        await jest.advanceTimersByTimeAsync(3 * 60_000);
        expect(scheduledRuns).toEqual([]);

        await jest.advanceTimersByTimeAsync(60_000); // 10:05
        expect(scheduledRuns).toEqual([
            {
                executable: 'EveryFiveMinutes',
                scope: '@scheduled',
                cron: '*/5 * * * *',
                scheduledTime: Date.parse('2026-11-02T10:05:00Z'),
            },
        ]);
    });

    it('stops firing once the runner stops', async () => {
        fakeClockAt('2026-11-02T10:01:00Z');
        runner = createScheduledRunner([EveryFiveMinutes], {
            port: await freePort(),
            host: '127.0.0.1',
        });
        await runner.start({ ENVIRONMENT: 'Test' });

        await runner.stop();
        await jest.advanceTimersByTimeAsync(30 * 60_000);
        expect(scheduledRuns).toEqual([]);
    });

    it('does not fire when the run config sets scheduled: false', async () => {
        fakeClockAt('2026-11-02T10:01:00Z');
        runner = createScheduledRunner([EveryFiveMinutes], {
            port: await freePort(),
            host: '127.0.0.1',
            scheduled: false,
        });
        await runner.start({ ENVIRONMENT: 'Test' });

        await jest.advanceTimersByTimeAsync(30 * 60_000);
        expect(scheduledRuns).toEqual([]);
    });

    it('fires the triggers scheduled.triggers names, including for CRON_ANY_TRIGGER executables', async () => {
        fakeClockAt('2026-11-02T10:01:00Z');
        runner = createScheduledRunner(
            [OnAnyTrigger],
            { port: await freePort(), host: '127.0.0.1' },
            { triggers: ['0 * * * *'] },
        );
        await runner.start({ ENVIRONMENT: 'Test' });

        await jest.advanceTimersByTimeAsync(59 * 60_000); // 11:00
        expect(scheduledRuns).toEqual([
            {
                executable: 'OnAnyTrigger',
                scope: '@scheduled',
                cron: '0 * * * *',
                scheduledTime: Date.parse('2026-11-02T11:00:00Z'),
            },
        ]);
    });

    it('rejects start() on a trigger it can’t schedule', async () => {
        runner = createScheduledRunner(
            [OnAnyTrigger],
            { port: await freePort(), host: '127.0.0.1' },
            { triggers: [CRON_ANY_TRIGGER] },
        );
        await expect(runner.start({ ENVIRONMENT: 'Test' })).rejects.toThrow(
            "scheduled.triggers has 'ANY_TRIGGER', which isn't a cron expression the runner can schedule",
        );
    });

    it('fires a trigger by hand on /__scheduled under --test-scheduled in local mode', async () => {
        const port = await freePort();
        runner = createScheduledRunner([EveryFiveMinutes], {
            port,
            host: '127.0.0.1',
        });
        await runner.start({
            ENVIRONMENT: 'Test',
            EXECUTION_MODE: ExecutionModeType.Local,
            TEST_SCHEDULED: 'true',
        });

        const response = await fetch(
            `http://127.0.0.1:${port}/__scheduled?cron=*/5+*+*+*+*`,
        );
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('Ran scheduled event');
        expect(scheduledRuns).toMatchObject([
            {
                executable: 'EveryFiveMinutes',
                scope: '@scheduled',
                cron: '*/5 * * * *',
            },
        ]);
    });

    it('does not serve /__scheduled without --test-scheduled', async () => {
        const port = await freePort();
        runner = createScheduledRunner([EveryFiveMinutes], {
            port,
            host: '127.0.0.1',
        });
        await runner.start({
            ENVIRONMENT: 'Test',
            EXECUTION_MODE: ExecutionModeType.Local,
        });

        const response = await fetch(
            `http://127.0.0.1:${port}/__scheduled?cron=*/5+*+*+*+*`,
        );
        expect(response.status).toBe(404);
        expect(scheduledRuns).toEqual([]);
    });
});
