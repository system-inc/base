// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { CronScheduler } from './CronScheduler';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

describe('CronScheduler', () => {
    let scheduler: CronScheduler | undefined;

    beforeEach(() => {
        jest.useFakeTimers({ now: new Date('2026-11-02T10:00:30Z') });
    });

    afterEach(async () => {
        await scheduler?.stop();
        scheduler = undefined;
        jest.useRealTimers();
    });

    function startWith(
        triggers: string[],
        run: (cron: string, scheduledTime: number) => Promise<void>,
    ): jest.Mock {
        const mock = jest.fn(run);
        scheduler = new CronScheduler(triggers, mock);
        scheduler.start();
        return mock;
    }

    it('fires each trigger at its next time, in UTC, with the planned scheduledTime', async () => {
        const run = startWith(['*/5 * * * *', '0 11 * * *'], async () => {});

        await jest.advanceTimersByTimeAsync(4 * MINUTE);
        expect(run).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(30_000); // 10:05:00
        expect(run).toHaveBeenCalledWith(
            '*/5 * * * *',
            Date.parse('2026-11-02T10:05:00Z'),
        );

        await jest.advanceTimersByTimeAsync(55 * MINUTE); // 11:00:00
        expect(run).toHaveBeenCalledWith(
            '0 11 * * *',
            Date.parse('2026-11-02T11:00:00Z'),
        );
        expect(
            run.mock.calls.filter(([cron]) => cron === '*/5 * * * *'),
        ).toHaveLength(12);
    });

    it('skips a fire while the trigger’s previous run is still in flight', async () => {
        let finish: () => void = () => {};
        const run = startWith(
            ['* * * * *'],
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                }),
        );

        await jest.advanceTimersByTimeAsync(30_000); // 10:01 — starts
        await jest.advanceTimersByTimeAsync(2 * MINUTE); // 10:02, 10:03 — skipped
        expect(run).toHaveBeenCalledTimes(1);

        finish();
        await jest.advanceTimersByTimeAsync(MINUTE); // 10:04 — runs again
        expect(run).toHaveBeenCalledTimes(2);

        // let the second run settle, so stop() (which waits for it) returns
        finish();
    });

    it('keeps the schedule after a failed run', async () => {
        const run = startWith(['* * * * *'], () =>
            Promise.reject(new Error('boom')),
        );

        await jest.advanceTimersByTimeAsync(30_000 + 2 * MINUTE);
        expect(run).toHaveBeenCalledTimes(3);
    });

    it('fires a trigger more than 24.8 days away on time, not immediately', async () => {
        // next 1 January is two months out: past setTimeout's limit
        const run = startWith(['0 0 1 1 *'], async () => {});

        await jest.advanceTimersByTimeAsync(30 * DAY);
        expect(run).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(
            Date.parse('2027-01-01T00:00:00Z') - Date.now(),
        );
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith(
            '0 0 1 1 *',
            Date.parse('2027-01-01T00:00:00Z'),
        );
    });

    it('fires once after a stall instead of catching up the missed runs', async () => {
        const run = startWith(['* * * * *'], async () => {});

        // the process stalls (a laptop sleeps) for an hour: the clock moves
        // on but no timer runs
        jest.setSystemTime(Date.now() + 60 * MINUTE);
        await jest.advanceTimersByTimeAsync(30_000);
        expect(run).toHaveBeenCalledTimes(1);

        // and the next fire is the next minute from now, not 10:02
        await jest.advanceTimersByTimeAsync(MINUTE);
        expect(run).toHaveBeenCalledTimes(2);
    });

    it('stops firing once stopped, and waits for a run in flight', async () => {
        let finish: () => void = () => {};
        const run = startWith(
            ['* * * * *'],
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                }),
        );
        await jest.advanceTimersByTimeAsync(30_000);
        expect(run).toHaveBeenCalledTimes(1);

        let stopped = false;
        const stopping = scheduler!.stop().then(() => {
            stopped = true;
        });
        await jest.advanceTimersByTimeAsync(0);
        expect(stopped).toBe(false);

        finish();
        await stopping;
        await jest.advanceTimersByTimeAsync(10 * MINUTE);
        expect(run).toHaveBeenCalledTimes(1);
    });
});
