// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { GqlField } from './decorators/GqlField';
import { GqlObjectType } from './decorators/GqlObjectType';

@GqlObjectType()
export class StatusRecord {
    @GqlField(() => String)
    status: string;

    @GqlField(() => Date)
    timestamp: Date;

    @GqlField(() => String, { nullable: true })
    description?: string;
}
