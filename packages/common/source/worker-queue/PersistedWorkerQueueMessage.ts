// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { JsonObject } from '../json/Json';

/**
 * Defines a type and an id for an entity lookup.
 */
export interface EntityTypeMessage extends JsonObject {
    type: string;
    id: string;
}
