// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { ResolverData } from '@system-inc/type-graphql/typings/resolver-data';
import type { NonEmptyArray } from '@system-inc/type-graphql/typings/utils/NonEmptyArray';
import { buildSchema } from '@system-inc/type-graphql/utils/buildSchema';
import { type GraphQLSchema } from 'graphql';

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { GqlConfiguration } from '../configuration/BaseConfiguration';
import { ArgumentValidationError } from '../error/ArgumentValidationError';
import { GqlContext } from '../internal/graphql/GqlContext';
import { GqlMiddleware } from '../internal/graphql/GqlMiddleware';
import { validate } from '../validation/ValidationEngine';

/**
 * Build a GraphQL schema from a {@link GqlConfiguration}.
 *
 * Shared primitive for any GqlServerProvider that uses type-graphql.
 * Lives at the foundation level (not inside a specific provider) so other
 * providers — Apollo, Mercurius, etc. — can reuse the same DI/validation/
 * middleware wiring.
 */
export async function gqlBuildSchema(
    config: GqlConfiguration,
): Promise<GraphQLSchema> {
    return buildSchema({
        // type is compatible with TypeGraphQL's expected schema option
        // but we have to cast it to their non-empty array type
        resolvers: config.resolvers as NonEmptyArray<Constructor<object>>,
        emitSchemaFile: false,
        // Defer to our own DI container instead of TypeGraphQL's default.
        container: {
            get: (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                someClass: any,
                resolverData: ResolverData<GqlContext>,
            ) => {
                return resolverData.context.request.context.container.resolve(
                    someClass,
                );
            },
        },
        // We use our own middleware stack for authentication.
        // Hardcode to 'error' in case anyone tries to use the @Authorized decorator.
        authMode: 'error',
        // Use our own validation function so behavior is consistent across
        // GraphQL, Route, and RPC.
        validateFn: async (value, _metadata) => {
            if (typeof value === 'object' && value !== null) {
                const validationErrors = await validate(value);
                if (validationErrors.length > 0) {
                    Logger.debug(
                        LogCategory.Gql,
                        'GraphQL validation errors:',
                        validationErrors,
                    );
                    throw new ArgumentValidationError(validationErrors);
                }
            }
        },
        // We only allow one global middleware and it's the one we provide.
        globalMiddlewares: [GqlMiddleware],
        directives: config.directives,
    });
}
