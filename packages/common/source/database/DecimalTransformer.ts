// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Decimal } from 'decimal.js';

/**
 * Marshals Decimal values to/from their string database representation.
 * Structurally satisfies the ORM's value-transformer shape (`to`/`from`)
 * without coupling base-common to an ORM package.
 */
export class DecimalTransformer {
    /**
     * Used to marshal Decimal when writing to the database.
     */
    to(decimal?: Decimal): string | null {
        return decimal?.toString() ?? null;
    }
    /**
     * Used to unmarshal Decimal when reading from the database.
     */
    from(decimal?: string | null): Decimal | null {
        return decimal === undefined || decimal === null
            ? null
            : new Decimal(decimal);
    }
}
