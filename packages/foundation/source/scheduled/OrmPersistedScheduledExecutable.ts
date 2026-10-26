// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { ScheduledExecutableStatus } from '@system-inc/base-common/scheduled/ScheduledExecutableStatus';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmRepository } from '../orm/database/repository/OrmRepository';
import { OrmScheduledExecutableEntity } from './OrmScheduledExecutableEntity';
import { ScheduledExecutableContext } from './ScheduledExecutableContext';
import { ScheduledExecutableInterface } from './ScheduledExecutableInterface';

/**
 * Base class for scheduled executables whose runs are recorded in the
 * database: each run inserts an {@link OrmScheduledExecutableEntity} row
 * (status `Processing`), then marks it `Completed` or `Failed`.
 *
 * `run` returning `false` is a soft failure: recorded as `Failed`, and the
 * scheduled run still succeeds. A thrown error is recorded as `Failed` and
 * then rethrown, so it reaches the platform like any other executable's —
 * a cron run reports failure, a Durable Object alarm is retried, and
 * unhandled-exception listeners hear of it (see `ScheduledRunner`).
 */
export abstract class OrmPersistedScheduledExecutable<
    EntityType extends OrmScheduledExecutableEntity,
> implements ScheduledExecutableInterface {
    protected readonly identifier: string = this.constructor.name;

    protected readonly repository: OrmRepository<OrmScheduledExecutableEntity>;

    constructor(
        protected readonly type: Constructor<OrmScheduledExecutableEntity>,
        repository: OrmRepository<EntityType>,
        identifier?: string,
    ) {
        // OrmRepository is invariant in its entity type, so widen the
        // subclass repository once here instead of at every consumer.
        this.repository =
            repository as unknown as OrmRepository<OrmScheduledExecutableEntity>;
        if (identifier) {
            this.identifier = identifier;
        }
    }

    async execute(context: ScheduledExecutableContext): Promise<void> {
        // fetch the last run from the database
        const lastRun = await this.repository.findOne({
            where: {
                identifier: this.identifier,
            },
            order: {
                createdAt: 'DESC',
            },
        });

        let shouldRun = true;
        if (this.shouldRun) {
            shouldRun = await this.shouldRun(lastRun as EntityType | null);
        }
        if (!shouldRun) {
            Logger.debug(
                LogCategory.Scheduled,
                'ScheduledExecutable: %s should not run, skipping',
                this.identifier,
            );
            return;
        }

        // create a new entry in the database for the scheduled executable
        const executableEntity = new this.type();
        executableEntity.identifier = this.identifier;
        if (context.type === 'scheduled') {
            executableEntity.cron = context.cron;
        }
        executableEntity.status = ScheduledExecutableStatus.Processing;
        await this.repository.insert(executableEntity);

        // run the executable
        try {
            const result = await this.run(
                executableEntity as EntityType,
                context,
            );
            if (result === false) {
                executableEntity.status = ScheduledExecutableStatus.Failed;
            } else {
                executableEntity.status = ScheduledExecutableStatus.Completed;
            }
            await this.repository.update(executableEntity);
            Logger.debug(
                LogCategory.Scheduled,
                `ScheduledExecutable: ${this.identifier} completed` +
                    (typeof result === 'boolean'
                        ? ` with result: ${result}`
                        : '.'),
            );
        } catch (error) {
            const message = `ScheduledExecutable error: ${this.identifier}, ${describeError(error)}`;
            Logger.error(LogCategory.Scheduled, message);
            executableEntity.status = ScheduledExecutableStatus.Failed;
            executableEntity.message = message;
            try {
                await this.repository.update(executableEntity);
            } catch (recordError) {
                // the run's own failure is the one that matters — don't let
                // a failed status write replace it
                Logger.error(
                    LogCategory.Scheduled,
                    'ScheduledExecutable: %s could not record its failure:',
                    this.identifier,
                    recordError,
                );
            }
            throw error;
        }
    }

    /**
     * Determines if the ScheduledExecutable should run.
     * Override this method to implement custom logic.
     *
     * @param _lastRun A record of the last run.
     */
    protected shouldRun(
        _lastRun: EntityType | null,
    ): boolean | Promise<boolean> {
        return true;
    }

    /**
     * Runs the ScheduledExecutable.
     *
     * @param entity The record of the current run.
     */
    protected abstract run(
        entity: EntityType,
        context: ScheduledExecutableContext,
    ): Promise<boolean | void>;
}

function describeError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    try {
        return JSON.stringify(error) ?? String(error);
    } catch {
        // BigInt and circular values can't be JSON-stringified
        return String(error);
    }
}
