// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmAdapter } from './OrmAdapter';

export interface OrmDurableAdapter extends OrmAdapter {
    migrate(): Promise<void>;
}

export function isDurableAdapter(
    adapter: OrmAdapter,
): adapter is OrmDurableAdapter {
    return 'migrate' in adapter;
}
