// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Base } from '../base/Base';

/**
 * Delegate in charge of configuring the Base application and
 * optionally responding to lifecycle events.
 */
export interface BaseWorkerDelegate {
    /**
     * Optional hook to run after Base has been initialized.
     * This is where you can add routes, middleware, etc. that are specific
     * to your application, but also not configurable in the BaseSettings.
     */
    onInitialize?(base: Base): Promise<void>;

    /**
     * Called when the worker starts listening for requests.
     * Not called on all platforms.
     */
    onStart?(): Promise<void>;

    /**
     * Called when the worker stops listening for requests.
     * Not called on all platforms.
     */
    onStop?(): Promise<number | void>;
}
