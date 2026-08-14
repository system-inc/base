// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RequireOnlyOne } from '@system-inc/base-common/type/UtilityTypes';

/**
 * The input for creating a durable object. It can be either an id or a name, but not both.
 *
 * When id is specified this is assumed to be the actual 64 character id of the durable object,
 * and will be converted to a DurableObjectId using the namespace's idFromString method.
 *
 * When name is specified, the namespace's idFromName method will be used to generate the DurableObjectId.
 */
export type CfDurableObjectInput = RequireOnlyOne<
    {
        id: string;
        name: string;
    },
    'id' | 'name'
>;
