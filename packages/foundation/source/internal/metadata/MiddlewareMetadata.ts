// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { HandlerMiddlewareRegistration } from '../../middleware/BaseMiddleware';

export class MiddlewareMetadata {
    private readonly metadata: Dictionary<HandlerMiddlewareRegistration[]> = {};

    addMiddleware(
        identifier: string,
        middleware: HandlerMiddlewareRegistration[],
    ) {
        // Append rather than replace: stacking two @WithMiddleware decorators
        // on the same class or method must register both, not silently drop
        // all but the last-applied one. Copy the incoming array so later calls
        // don't mutate a caller's array.
        const existing = this.metadata[identifier];
        if (existing) {
            existing.push(...middleware);
        } else {
            this.metadata[identifier] = [...middleware];
        }
    }

    getMiddleware(
        identifier: string,
    ): HandlerMiddlewareRegistration[] | undefined {
        return this.metadata[identifier];
    }

    getMiddlewareForHandler(
        handler: BaseHandler,
    ): HandlerMiddlewareRegistration[] | undefined {
        const classMiddleware = this.getMiddleware(handler.className);
        const operationMiddleware = this.getMiddleware(handler.getIdentifier());
        if (classMiddleware && operationMiddleware) {
            return [...classMiddleware, ...operationMiddleware];
        } else if (classMiddleware) {
            return classMiddleware;
        } else if (operationMiddleware) {
            return operationMiddleware;
        }
        return undefined;
    }
}
