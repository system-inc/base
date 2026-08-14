// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';

/** What a `@PaginationInputFor` class declared, keyed by the input class. */
export interface PaginationInputMetadata {
    entity: Constructor;
    filterColumns?: ReadonlySet<string>;
    /** Full runtime order allowlist: entity columns ∪ virtual keys. */
    orderColumns?: ReadonlySet<string>;
    /** The subset of `orderColumns` that are resolver-translated keys. */
    virtualOrderColumns?: ReadonlySet<string>;
}

const paginationInputMetadata = new Map<
    Constructor<object>,
    PaginationInputMetadata
>();

/**
 * Which class claimed each generated name prefix, so a second claim on the
 * same prefix fails at its own declaration rather than as an unattributed
 * schema-build error later.
 */
const paginationInputBaseNames = new Map<string, Constructor<object>>();

/**
 * Resolve the declared pagination metadata for an input class, walking the
 * prototype chain so a subclass of a declared input inherits its contract.
 */
export function getPaginationInputMetadata(
    inputClass: Constructor<object>,
): PaginationInputMetadata | undefined {
    let current: Constructor<object> | null = inputClass;
    while (current) {
        const metadata = paginationInputMetadata.get(current);
        if (metadata) {
            return metadata;
        }
        current = Object.getPrototypeOf(current) as Constructor<object> | null;
    }
    return undefined;
}

/** All declared pagination inputs — consumed by `base check` tooling. */
export function getAllPaginationInputMetadata(): ReadonlyMap<
    Constructor<object>,
    PaginationInputMetadata
> {
    return paginationInputMetadata;
}

/**
 * Records what a declaration resolved to. Called by `@PaginationInputFor`
 * once the declaration has been fully validated.
 */
export function recordPaginationInputMetadata(
    inputClass: Constructor<object>,
    metadata: PaginationInputMetadata,
): void {
    paginationInputMetadata.set(inputClass, metadata);
}

/**
 * The class currently owning a generated name prefix, or `undefined` if the
 * prefix is unclaimed.
 */
export function getPaginationInputBaseNameOwner(
    baseName: string,
): Constructor<object> | undefined {
    return paginationInputBaseNames.get(baseName);
}

/**
 * Claims a generated name prefix for a declaration. Called last by
 * `@PaginationInputFor`, so only a declaration that fully succeeded owns its
 * generated names.
 */
export function claimPaginationInputBaseName(
    baseName: string,
    inputClass: Constructor<object>,
): void {
    paginationInputBaseNames.set(baseName, inputClass);
}
