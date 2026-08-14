// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { addSerializableObjectMetadata } from '../internal/SerializableMetadata';

/**
 * Marks a class as serializable, allowing instances to be converted to JSON
 * with `serialize` and reconstructed with `deserialize`. Only properties
 * marked `@SerializableField` cross the wire — internal fields never leak.
 *
 * @example
 * ```ts
 * @SerializableObject()
 * export class ChargeInput {
 *     @SerializableField(() => String)
 *     accountId: string;
 *
 *     @SerializableField(() => Number, { optional: true })
 *     amount?: number;
 * }
 * ```
 */
export function SerializableObject(): ClassDecorator {
    return (target: Function) => {
        addSerializableObjectMetadata(target as Constructor);
    };
}
