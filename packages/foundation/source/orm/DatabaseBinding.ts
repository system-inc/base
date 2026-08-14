// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TypedBinding } from '../dependency-injection/TypedBinding';

/**
 * Binding for a named ORM data context. The name corresponds to a
 * registered configuration. Used with `@InjectDatabase(...)` and as
 * the optional database selector for the ORM `@InjectRepository(...)`.
 */
export class DatabaseBinding extends TypedBinding {
    declare private readonly __database: 'Database';
}
