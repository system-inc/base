// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { SessionContextProvider } from './SessionContextProvider';

/**
 * Access-control settings — registered at the worker level
 * (`BaseSettings.accessControl`) or contributed by a module
 * (`ModuleSettings.accessControl`).
 */
export interface AccessControlSettings {
    /**
     * The application's {@link SessionContextProvider} implementation —
     * the identity seam the session-access middleware resolves sessions
     * through. Exactly one provider may be registered across the worker
     * and all its modules; registering two different providers is a boot
     * error, as is using `@RequireSessionAccess` / `@WithSessionAccess`
     * with none registered.
     *
     * The class is resolved from the request-scoped DI container, so it
     * can inject services (give it an injectable-family decorator if it
     * has constructor dependencies).
     */
    readonly provider?: Constructor<SessionContextProvider>;
}
