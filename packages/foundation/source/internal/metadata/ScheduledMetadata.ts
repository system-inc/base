// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

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
}
