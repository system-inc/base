// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';

export class GqlMetadata {
    private readonly operationContext: string[] = [];

    addGqlOperationContext(handler: BaseHandler) {
        this.operationContext.push(handler.getIdentifier());
    }

    requestedGqlOperationContext(handler: BaseHandler): boolean {
        return this.operationContext.includes(handler.getIdentifier());
    }
}
