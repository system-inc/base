// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ExtractTablesWithRelations } from 'drizzle-orm';

import { DrizzleFullSchema } from './DrizzleDefaultSchema';

export type DrizzleSchema<T> = ExtractTablesWithRelations<DrizzleFullSchema<T>>;
