// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { AlarmScheduledEvent } from '../cloudflare/durable-object/core/AlarmScheduledEvent';
import { BaseInjectionContainer } from '../dependency-injection/BaseInjectionContainer';

export type ScheduledExecutableContext =
    | ScheduledExecutableContextScheduledEvent
    | ScheduledExecutableContextAlarmInvocationInfo;

export interface ScheduledExecutableContextScheduledEvent extends ScheduledExecutableContextBase {
    readonly type: 'scheduled';
    readonly scheduledTime: number;
    readonly cron: string;
    noRetry(): void;
}

export interface ScheduledExecutableContextAlarmInvocationInfo extends ScheduledExecutableContextBase {
    readonly type: 'alarm';
    readonly isRetry: boolean;
    readonly retryCount: number;
}

interface ScheduledExecutableContextBase {
    readonly container: BaseInjectionContainer;
}

export function isScheduledExecutableContextScheduledEvent(
    object: unknown,
): object is ScheduledExecutableContextScheduledEvent {
    return (
        (object as ScheduledExecutableContextScheduledEvent).type ===
        'scheduled'
    );
}

export function isScheduledExecutableContextAlarmInvocationInfo(
    object: unknown,
): object is ScheduledExecutableContextAlarmInvocationInfo {
    return (
        (object as ScheduledExecutableContextAlarmInvocationInfo).type ===
        'alarm'
    );
}

export namespace ScheduledExecutableContext {
    export function create(
        scheduledEvent: ScheduledEvent,
        container: BaseInjectionContainer,
    ): ScheduledExecutableContext {
        return scheduledEvent instanceof AlarmScheduledEvent
            ? {
                  type: 'alarm',
                  isRetry: scheduledEvent.alarmInfo?.isRetry ?? false,
                  retryCount: scheduledEvent.alarmInfo?.retryCount ?? 0,
                  container,
              }
            : {
                  type: 'scheduled',
                  cron: scheduledEvent.cron,
                  scheduledTime: scheduledEvent.scheduledTime,
                  // Wrap rather than copy the reference: on Cloudflare the
                  // event is a workerd ScheduledController whose noRetry is a
                  // JSG-wrapped method that throws "Illegal invocation" unless
                  // called with the controller as `this`.
                  noRetry: () => scheduledEvent.noRetry(),
                  container,
              };
    }
}
