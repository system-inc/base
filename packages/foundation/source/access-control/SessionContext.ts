// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * The identity resolved for an authenticated request.
 *
 * Produced by the app's registered
 * {@link import('./SessionContextProvider').SessionContextProvider} and
 * stored on the request context under
 * {@link import('./SessionContextRequestKey').SessionContextRequestKey}.
 * Handlers read it to answer "who is making this request?"; the
 * framework's session-access middleware reads `accessRoles` /
 * `entitlements` to authorize handlers decorated with
 * `@RequireSessionAccess`.
 *
 * The identity model is session + account + actor: `accountId` is who
 * authenticated; `actorId` is who is acting — the key modules use for
 * row ownership. An implementation may distinguish the two (e.g. an
 * account acting through one of several profiles) or set them equal.
 *
 * Every member is deliberately required — handlers and modules read this
 * shape everywhere, so the cost of "not modeled" lands on the one
 * implementation, not on every read site. Each field has an honest
 * degenerate value for apps that don't model the concept: no actor
 * concept → `actorId` equals `accountId` (the account acts as itself)
 * and `getActor()` returns the account; no entitlements → `[]` (this
 * session holds none; entitlement-gated handlers correctly 403).
 */
export interface SessionContext<ActorType = unknown> {
    /**
     * The session id.
     */
    readonly sessionId: string;

    /**
     * The authenticated subject.
     */
    readonly accountId: string;

    /**
     * The acting identity — the key modules use for row ownership.
     */
    readonly actorId: string;

    /**
     * The access roles assigned to the account, filtered by the provider
     * to those currently valid (active, unexpired, scoped to the actor).
     */
    readonly accessRoles: ReadonlyArray<string>;

    /**
     * The entitlements assigned to the actor, filtered by the provider
     * to those currently valid.
     */
    readonly entitlements: ReadonlyArray<string>;

    /**
     * Determines if the session has a specific access role.
     *
     * If the role provided is an array, it checks if any of the roles are present.
     * If a single role is provided, it checks for that specific role.
     *
     * @param role A role or roles to check for access.
     */
    hasAccessRole(role: string | string[]): boolean;

    /**
     * Determines if the session has a specific entitlement.
     *
     * If the entitlement provided is an array, it checks if any of the entitlements are present.
     * If a single entitlement is provided, it checks for that specific entitlement.
     *
     * @param entitlement An entitlement or entitlements to check for access.
     */
    hasEntitlement(entitlement: string | string[]): boolean;

    /**
     * Get the full actor object.
     */
    getActor(): Readonly<ActorType>;
}
