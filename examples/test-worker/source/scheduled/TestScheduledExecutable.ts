// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    CRON_ANY_TRIGGER,
    CRON_EVERY_MINUTE,
} from '@system-inc/base-common/cron/CronExpression';
import { ScheduledExecutable } from '@system-inc/base-foundation/scheduled/decorators/ScheduledExecutable';
import { ScheduledExecutableContext } from '@system-inc/base-foundation/scheduled/ScheduledExecutableContext';
import { ScheduledExecutableInterface } from '@system-inc/base-foundation/scheduled/ScheduledExecutableInterface';

@ScheduledExecutable(CRON_ANY_TRIGGER)
export class TestScheduledExecutable implements ScheduledExecutableInterface {
    execute(context: ScheduledExecutableContext): void | Promise<void> {
        console.log(TestScheduledExecutable.name, context);
    }
}

@ScheduledExecutable(CRON_EVERY_MINUTE)
export class TestScheduledExecutable1 implements ScheduledExecutableInterface {
    execute(context: ScheduledExecutableContext): void | Promise<void> {
        console.log(TestScheduledExecutable1.name, context);
    }
}
