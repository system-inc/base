// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { DeferredActions } from '../../request/DeferredActions';

/**
 * Utility class to defer actions until after a response has been returned.
 */
export class DeferredExecutor implements DeferredActions {
    private _actions: (() => Promise<unknown>)[] = [];

    append(action: () => Promise<unknown>) {
        this._actions.push(action);
    }

    /**
     * Runs every pending action, then clears the queue — so calling
     * `execute()` again only runs actions appended since the last call and
     * never re-runs completed ones. This "drain" semantics is what lets a
     * long-lived, never-disposed container (e.g. the shared `@websocket`
     * container) be drained once per event without replaying prior work.
     *
     * The outer loop keeps draining while actions remain, so an action that
     * appends further actions still has them run in the same call — matching
     * the previous live-array iteration. Snapshot-then-clear is synchronous,
     * so an action is only ever owned by one drain even under concurrency.
     */
    async execute(): Promise<void> {
        while (this._actions.length > 0) {
            const actions = this._actions;
            this._actions = [];
            for (const action of actions) {
                try {
                    await action();
                } catch (error) {
                    if (error instanceof Error) {
                        Logger.error(
                            LogCategory.Base,
                            'Error executing deferred action:',
                            error.message,
                            error.stack,
                        );
                    } else {
                        Logger.error(
                            LogCategory.Base,
                            'Error executing deferred action:',
                            error,
                        );
                    }
                }
            }
        }
    }
}
