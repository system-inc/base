// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { CRON_ANY_TRIGGER } from '@system-inc/base-common/cron/CronExpression';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { ScheduledExecutableInterface } from '../../scheduled/ScheduledExecutableInterface';

export class ScheduledMetadata {
    private readonly executables: {
        [key: string]: Constructor<ScheduledExecutableInterface>[];
    } = {};

    addScheduledExecutable(
        executable: Constructor<ScheduledExecutableInterface>,
        cron: string,
    ) {
        if (!this.executables[cron]) {
            this.executables[cron] = [];
        }
        this.executables[cron].push(executable);
    }

    getScheduledExecutables(
        cron: string,
    ): Constructor<ScheduledExecutableInterface>[] {
        return this.executables[cron] || [];
    }

    /**
     * The cron expressions at least one of the given (registered)
     * executables is registered against, sorted — the triggers a platform
     * without its own cron service must fire. `CRON_ANY_TRIGGER` isn't a
     * schedule, so it's left out.
     */
    getTriggersFor(
        executables: ReadonlyArray<Constructor<ScheduledExecutableInterface>>,
    ): string[] {
        return Object.entries(this.executables)
            .filter(
                ([cron, registered]) =>
                    cron !== CRON_ANY_TRIGGER &&
                    registered.some((executable) =>
                        executables.includes(executable),
                    ),
            )
            .map(([cron]) => cron)
            .sort();
    }
}
