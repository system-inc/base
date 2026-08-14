// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * What a handler requires of the session — the parameter of
 * `@RequireSessionAccess` / `@WithSessionAccess`. Matching is any-of
 * for both lists; an absent or empty list requires nothing.
 *
 * Whether the requirements are *enforced* (reject anonymous requests)
 * or merely resolved-if-present is decided by which decorator you
 * choose, not here — see
 * {@link import('./SessionAccessOptions').SessionAccessOptions} for the
 * handler's effective record including that mode.
 */
export interface SessionAccessRequirements {
    /**
     * The roles that are allowed to access the resource.
     * If the user has any of these roles, they will be allowed to access the resource.
     */
    roles?: string[];

    /**
     * The entitlements that are required to access the resource.
     * If the user has any of these entitlements, they will be allowed to access the resource.
     */
    entitlements?: string[];
}
