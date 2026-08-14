// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmPartialEntityAs } from '../OrmPartialEntity';

export type OrmFindOptionsOrder<T> = OrmPartialEntityAs<T, 'ASC' | 'DESC'>;
