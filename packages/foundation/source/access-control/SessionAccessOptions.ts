// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { SessionAccessRequirements } from './SessionAccessRequirements';

/**
 * A handler's effective access-control record: its
 * {@link SessionAccessRequirements} plus the enforcement mode. This is
 * what the decorators store in metadata (class + method options merge),
 * what the session-access middleware enforces, and what the
 * `SessionContextProvider` receives for option-dependent policy.
 */
export interface SessionAccessOptions extends SessionAccessRequirements {
    /**
     * If set to true, the user does not need to be authenticated to access the resource,
     * but the session will be loaded if the user is authenticated.
     *
     * Set by the decorator choice: `@WithSessionAccess` sets it true,
     * `@RequireSessionAccess` false.
     */
    skipAuthorization?: boolean;
}
