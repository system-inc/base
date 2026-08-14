// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TypedKey } from '@system-inc/base-common/type/TypedKey';

/**
 * A branded key for type-safe access to module settings.
 *
 * Modules define keys for their settings, binding the module name
 * and settings type together so consumers can't get them out of sync:
 *
 * ```ts
 * const StripeSettings = BaseModuleKey.create<StripeModuleSettings>('Stripe');
 *
 * const settings = configuration.getModuleSettings(StripeSettings);
 * settings.queues?.webhookEvents?.name;  // fully typed
 * ```
 *
 * Extends {@link TypedKey} with the `'module'` scope brand so module
 * settings keys cannot be confused with request-context, environment,
 * or WebSocket keys at the type level.
 */
export class BaseModuleKey<T> extends TypedKey<T, 'module'> {
    /**
     * Creates a typed module settings key.
     *
     * @example
     * ```ts
     * const MyModule = BaseModuleKey.create<MyModuleSettings>('MyModule');
     * ```
     */
    static create<T>(name: string): BaseModuleKey<T> {
        return new BaseModuleKey<T>(name);
    }
}
