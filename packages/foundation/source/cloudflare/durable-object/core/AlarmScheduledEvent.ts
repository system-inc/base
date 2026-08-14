// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * A scheduled event for an alarm, allowing it to be
 * passed to the worker for processing using the
 * handleScheduled call.
 */
// we have to implement the ScheduledEvent interface rather than extend
// because it borks the cli for some reason, concrete types from Cloudflare
// cannot be found when it starts up for some reason.
export class AlarmScheduledEvent implements ScheduledEvent {
    constructor(readonly alarmInfo?: AlarmInvocationInfo) {}

    // properties from ScheduledEvent
    scheduledTime: number;
    cron: string;
    noRetry(): void {
        throw new Error('Method not implemented.');
    }
    waitUntil(_promise: Promise<unknown>): void {
        throw new Error('Method not implemented.');
    }

    // properties from Event
    bubbles: boolean;
    cancelBubble: boolean;
    cancelable: boolean;
    composed: boolean;
    currentTarget: EventTarget | null;
    defaultPrevented: boolean;
    eventPhase: number;
    isTrusted: boolean;
    returnValue: boolean;
    srcElement: EventTarget | null;
    target: EventTarget | null;
    timeStamp: number;
    type: string;
    composedPath(): EventTarget[] {
        throw new Error('Method not implemented.');
    }
    initEvent(_type: string, _bubbles?: boolean, _cancelable?: boolean): void {
        throw new Error('Method not implemented.');
    }
    preventDefault(): void {
        throw new Error('Method not implemented.');
    }
    stopImmediatePropagation(): void {
        throw new Error('Method not implemented.');
    }
    stopPropagation(): void {
        throw new Error('Method not implemented.');
    }
    NONE: 0;
    CAPTURING_PHASE: 1;
    AT_TARGET: 2;
    BUBBLING_PHASE: 3;
}
