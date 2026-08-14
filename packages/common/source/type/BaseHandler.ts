// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from './Constructor';

/**
 * Identifies a handler (class + method) being invoked for a request.
 *
 * Populated by the dispatcher (Router, RpcDispatcher, GqlMiddleware) once
 * the specific handler method is known, and read by middleware and the
 * various metadata systems for handler-scoped lookups.
 */
export class BaseHandler {
    /**
     * Build a {@link BaseHandler} from the `target` and `propertyKey`
     * arguments TypeScript hands to a decorator. Centralizes the cast
     * from the decorator-typed `target.constructor` (`Function`) to
     * the framework's `Constructor<object>` so call sites stay clean.
     */
    static fromDecorator(
        target: object,
        propertyKey: string | symbol,
    ): BaseHandler {
        return new BaseHandler(
            target.constructor as Constructor<object>,
            String(propertyKey),
        );
    }

    constructor(
        readonly target: Constructor<object>,
        readonly methodName: string,
    ) {}

    get className(): string {
        return this.target.name;
    }

    getIdentifier(): string {
        return `${this.className}.${this.methodName}`;
    }
}
