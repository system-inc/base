// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmTableMetadata } from '../metadata/OrmTableMetadata';

export interface OrmSchemaBuilder {
    createSchema(metadata: OrmTableMetadata[]): void;
}
