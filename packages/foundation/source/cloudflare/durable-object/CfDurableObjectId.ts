// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseError } from '../../error/BaseError';
import { CfDurableObjectInput } from './CfDurableObjectInput';

/**
 * Resolves the explicit {@link DurableObjectId} named by a
 * {@link CfDurableObjectInput}, or `undefined` when neither `id` nor `name`
 * was supplied — leaving the caller to choose its own default (a fresh
 * unique id for durable objects, the singleton name for containers).
 *
 * An empty-string `id`/`name` is rejected rather than silently ignored: a
 * truthiness check used to let `{ id: '' }` fall through to the default, so
 * an uninitialized identifier quietly addressed a brand-new instance
 * instead of the one the caller meant.
 */
export function resolveExplicitObjectId(
    namespace: Pick<
        DurableObjectNamespace<Rpc.DurableObjectBranded>,
        'idFromString' | 'idFromName'
    >,
    input: CfDurableObjectInput | undefined,
): DurableObjectId | undefined {
    if (input?.id !== undefined) {
        assertNonEmpty(input.id, 'id');
        return namespace.idFromString(input.id);
    }
    if (input?.name !== undefined) {
        assertNonEmpty(input.name, 'name');
        return namespace.idFromName(input.name);
    }
    return undefined;
}

function assertNonEmpty(value: string, field: 'id' | 'name'): void {
    if (value === '') {
        throw BaseError.fromMessage(
            `Durable object ${field} must be a non-empty string`,
        );
    }
}
