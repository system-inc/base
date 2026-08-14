// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { cronExpressionIsValid } from '@system-inc/base-common/cron/CronExpression';
import { DecoratorRegistry } from '@system-inc/base-common/decorator/DecoratorRegistry';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { getBaseMetadata } from '../../base/BaseMetadata';
import { ScheduledExecutableInterface } from '../ScheduledExecutableInterface';

export const ScheduledExecutableDecoratorName = 'ScheduledExecutable';

/**
 * This decorator is used to register an Executable that
 * can be called on a scheduled basis.
 *
 * If no cron expression is provided the class is decorator-marked but is not
 * registered with the ScheduledRunner — it will not auto-run on any trigger.
 * Modules that wire the executable up later with a config-supplied cron should
 * use this form. To opt into running on every trigger the worker receives,
 * pass CRON_ANY_TRIGGER explicitly.
 */
export function ScheduledExecutable(cron?: string) {
    return function <
        T extends new (...args: any[]) => ScheduledExecutableInterface,
    >(constructor: T) {
        DecoratorRegistry.get().mark(
            constructor as Constructor<object>,
            ScheduledExecutableDecoratorName,
        );
        if (cron) {
            // if a cron expression was provided make sure its valid
            if (!cronExpressionIsValid(cron)) {
                throw new Error(
                    `Invalid cron expression: ${cron} registered for ${constructor.name}`,
                );
            }
            getBaseMetadata().scheduled.addScheduledExecutable(
                constructor,
                cron,
            );
        }
    };
}
