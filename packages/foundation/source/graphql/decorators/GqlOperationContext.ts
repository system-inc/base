// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { createParameterDecorator } from '@system-inc/type-graphql/decorators/createParameterDecorator';

import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import { GenericTrap } from '@system-inc/base-common/type/UtilityTypes';
import { getBaseMetadata } from '../../base/BaseMetadata';
import { TypedParameterDecorator } from '../../dependency-injection/TypedParameterDecorator';
import {
    GqlOperationContext,
    gqlOperationContextKey,
} from '../GqlOperationContext';

/**
 * Injects the {@link GqlOperationContext} for the surrounding GraphQL
 * operation. The decorated parameter must be typed as a
 * `GqlOperationContext<T>`; the `base/inject-type-matches-parameter`
 * lint rule enforces this at compile time.
 *
 * Pass an explicit generic argument
 * (e.g. `@InjectGqlOperationContext<OpContextResult>()`) to additionally
 * pin the selection-set element type. With no argument the parameter
 * may be any `GqlOperationContext<...>`.
 *
 * @example
 * ```ts
 * @GqlQuery(() => OperationInfo)
 * async operationInfo(
 *     @InjectGqlOperationContext()
 *     operationContext: GqlOperationContext<OperationInfo>,
 * ): Promise<OperationInfo> {
 *     return {
 *         operationType: operationContext.type,
 *         selectedFields: Object.keys(operationContext.selectionSet),
 *     };
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function InjectGqlOperationContext<T = any>(): TypedParameterDecorator<
    GqlOperationContext<T>
> {
    const decorator: ParameterDecorator = (
        target: object,
        propertyKey: string | symbol | undefined,
        parameterIndex: number,
    ) => {
        if (propertyKey) {
            const handler = BaseHandler.fromDecorator(target, propertyKey);
            getBaseMetadata().graphql.addGqlOperationContext(handler);
            // Read the operation context back by the field's response path —
            // the same key GqlMiddleware stored it under — so aliased
            // duplicates of this resolver each get their own selection set
            // rather than sharing a resolver-method-keyed slot.
            createParameterDecorator(
                ({ context, info }) =>
                    (context as GenericTrap<object>)[
                        gqlOperationContextKey(info)
                    ],
            )(target, propertyKey, parameterIndex);
        }
    };
    return decorator as TypedParameterDecorator<GqlOperationContext<T>>;
}
