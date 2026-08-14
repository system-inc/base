// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { GqlField } from './decorators/GqlField';
import { GqlObjectType } from './decorators/GqlObjectType';

@GqlObjectType()
export class OperationResult {
    @GqlField(() => Boolean)
    success: boolean;

    @GqlField(() => String, { nullable: true })
    message?: string;
}
