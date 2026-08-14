// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { CountingSemaphore } from '@system-inc/base-common/concurrent/CountingSemaphore';
import { CRON_ANY_TRIGGER } from '@system-inc/base-common/cron/CronExpression';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { numberClamp } from '@system-inc/base-common/number/Clamp';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { getBaseMetadata } from '../../base/BaseMetadata';
import { BaseInjectionContainer } from '../../dependency-injection/BaseInjectionContainer';
import { BaseEventBus } from '../../event/BaseEventBus';
import {
    UnhandledExceptionEvent,
    UnhandledExceptionEventName,
} from '../../event/UnhandledExceptionEvent';
import { ScheduledExecutableContext } from '../../scheduled/ScheduledExecutableContext';
import { ScheduledExecutableInterface } from '../../scheduled/ScheduledExecutableInterface';
import { ScheduledMetadata } from '../metadata/ScheduledMetadata';

const MAX_CONCURRENCY = 10;
const MIN_CONCURRENCY = 1;

/**
 *
 */
export class ScheduledRunner {
    private readonly metadata: ScheduledMetadata;
    private readonly semaphore: CountingSemaphore;

    constructor(
        protected readonly container: BaseInjectionContainer,
        private readonly scheduledExecutors: ReadonlyArray<
            Constructor<ScheduledExecutableInterface>
        >,
        concurrency: number = MIN_CONCURRENCY,
    ) {
        this.metadata = getBaseMetadata().scheduled;
        concurrency = numberClamp(
            concurrency,
            MIN_CONCURRENCY,
            MAX_CONCURRENCY,
        );
        this.semaphore = new CountingSemaphore(concurrency);
    }

    async runScheduled(
        context: ScheduledExecutableContext,
        cron?: string,
    ): Promise<void> {
        const executablesFromMetadata: Set<
            Constructor<ScheduledExecutableInterface>
        > = new Set();
        if (cron) {
            this.metadata
                .getScheduledExecutables(cron)
                .forEach((executable) => {
                    executablesFromMetadata.add(executable);
                });
        }

        // get tasks registered against CRON_ANY_TRIGGER — they fire on every trigger
        this.metadata
            .getScheduledExecutables(CRON_ANY_TRIGGER)
            .forEach((executable) => {
                executablesFromMetadata.add(executable);
            });

        // merge the two arrays and filter out any that aren't in the list of scheduled executors
        const executables = Array.from(executablesFromMetadata).filter(
            (executor) => this.scheduledExecutors.includes(executor),
        );

        // run the tasks if there are any
        if (executables.length > 0) {
            await this.runExecutables(executables, context);
        } else {
            Logger.warn(
                LogCategory.Scheduled,
                'No ScheduledExecutables found for cron: %s',
                cron,
            );
        }
    }

    private async runExecutables(
        executables: ReadonlyArray<Constructor<ScheduledExecutableInterface>>,
        context: ScheduledExecutableContext,
    ): Promise<void> {
        const jobs: Promise<void>[] = [];
        for (const executable of executables) {
            // wait for the next available processing slot
            await this.semaphore.acquire();

            const job = (async () => {
                try {
                    await this.runExecutable(executable, context);
                } finally {
                    this.semaphore.release();
                }
            })();

            jobs.push(job);
        }

        // Let every scheduled executable run (allSettled, so one failure
        // doesn't cancel its siblings), then fail the run as a whole if any
        // threw. Propagating is what lets the platform see the failure — a
        // cron run reports failure, and a Durable Object alarm is retried by
        // workerd — instead of a silent false success.
        const results = await Promise.allSettled(jobs);
        const failures = results
            .filter(
                (result): result is PromiseRejectedResult =>
                    result.status === 'rejected',
            )
            .map((result) => result.reason as unknown);
        if (failures.length === 1) {
            throw failures[0];
        }
        if (failures.length > 1) {
            throw new AggregateError(
                failures,
                `${failures.length} scheduled executables failed`,
            );
        }
    }

    private async runExecutable(
        executableConstructor: Constructor<ScheduledExecutableInterface>,
        context: ScheduledExecutableContext,
    ): Promise<void> {
        Logger.debug(
            LogCategory.Scheduled,
            'Running ScheduledExecutable: %s',
            executableConstructor.name,
        );
        try {
            // create the executable and run it
            const executable =
                this.container.resolve<ScheduledExecutableInterface>(
                    executableConstructor,
                );
            await executable.execute(context);
        } catch (error) {
            // log with the executable name for context, then rethrow so the
            // failure reaches the platform (see runExecutables)
            Logger.error(
                LogCategory.Scheduled,
                'Failed to run ScheduledExecutable: %s',
                executableConstructor.name,
                error,
            );
            // surface the failure to unhandled-exception listeners — the
            // deferred drain in Base.runDeferredActions delivers it even
            // though the error rethrows below. Fires on every failed
            // attempt (alarms retry); dedup is the listener's concern.
            this.container
                .resolve(BaseEventBus)
                .defer<UnhandledExceptionEvent>({
                    name: UnhandledExceptionEventName,
                    error,
                    surface: 'scheduled',
                    detail: executableConstructor.name,
                });
            throw error;
        }
    }
}
