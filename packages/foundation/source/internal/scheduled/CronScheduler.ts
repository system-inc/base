// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { dateFromCronExpression } from '@system-inc/base-common/cron/CronExpressionDate';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';

/**
 * The longest delay `setTimeout` honors (2³¹−1 ms, about 24.8 days); a
 * longer one fires immediately, so longer waits are chained.
 */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Runs one trigger's scheduled work. `scheduledTime` is the planned fire
 * time (epoch ms), not when the timer actually fired.
 */
export type CronRun = (cron: string, scheduledTime: number) => Promise<void>;

/**
 * Fires cron triggers on a timer, for platforms without a cron service of
 * their own (Node). Times are UTC, as Cloudflare's cron triggers are.
 *
 * - After each fire the next time is computed from now, never by a fixed
 *   interval: after a sleep or a stall a trigger fires once, without
 *   catching up the runs it missed.
 * - A trigger whose previous run is still in flight skips that fire (and
 *   logs it) rather than overlapping itself.
 * - A failed run is logged and never stops the schedule.
 */
export class CronScheduler {
    private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly inFlight = new Map<string, Promise<void>>();
    private stopped = false;

    constructor(
        private readonly triggers: ReadonlyArray<string>,
        private readonly run: CronRun,
    ) {}

    start(): void {
        for (const cron of new Set(this.triggers)) {
            this.scheduleNext(cron, Date.now());
        }
    }

    /**
     * Cancels every timer, then resolves once in-flight runs settle.
     * Idempotent.
     */
    async stop(): Promise<void> {
        this.stopped = true;
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
        await Promise.allSettled(this.inFlight.values());
    }

    /**
     * Schedules the first fire strictly after `after` (or after now, if
     * later), so a timer that fires a moment early can't fire the same
     * time twice.
     */
    private scheduleNext(cron: string, after: number): void {
        if (this.stopped) {
            return;
        }
        const fireAt = dateFromCronExpression(
            cron,
            Math.max(after, Date.now()),
        ).getTime();
        this.waitUntil(cron, fireAt);
    }

    private waitUntil(cron: string, fireAt: number): void {
        const delay = fireAt - Date.now();
        this.timers.set(
            cron,
            delay > MAX_TIMEOUT_MS
                ? setTimeout(() => this.waitUntil(cron, fireAt), MAX_TIMEOUT_MS)
                : setTimeout(() => this.fire(cron, fireAt), Math.max(0, delay)),
        );
    }

    private fire(cron: string, scheduledTime: number): void {
        if (this.inFlight.has(cron)) {
            Logger.warn(
                LogCategory.Scheduled,
                'Skipping cron %s: its previous run is still in progress.',
                cron,
            );
        } else {
            const run = this.run(cron, scheduledTime)
                .catch((error: unknown) => {
                    Logger.warn(
                        LogCategory.Scheduled,
                        'Scheduled run for cron %s failed:',
                        cron,
                        error,
                    );
                })
                .finally(() => this.inFlight.delete(cron));
            this.inFlight.set(cron, run);
        }
        this.scheduleNext(cron, scheduledTime);
    }
}
