// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RequestContextKey } from '../request/RequestContextKey';
import { SessionContext } from './SessionContext';

/**
 * The request-context key the session-access middleware stores the
 * resolved {@link SessionContext} under.
 *
 * Handlers read it to get the identity for the current request:
 *
 * ```ts
 * const sessionContext = requestContext.get(SessionContextRequestKey);
 * ```
 *
 * Set only when the handler carries access-control metadata and the
 * provider resolved a session — under `@WithSessionAccess` an anonymous
 * request leaves it unset.
 */
export const SessionContextRequestKey =
    RequestContextKey.create<SessionContext>('sessionContext');
