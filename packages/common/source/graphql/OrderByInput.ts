// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrderByDirection } from './OrderByDirection';

export interface OrderByInput {
    key: string;
    direction?: OrderByDirection;
}
