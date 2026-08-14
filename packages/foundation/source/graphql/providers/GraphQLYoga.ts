// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { createResolversMap } from '@system-inc/type-graphql/utils/createResolversMap';
import { NoSchemaIntrospectionCustomRule, printSchema } from 'graphql';
import { createSchema, createYoga, type Plugin } from 'graphql-yoga';

import { GqlConfiguration } from '../../configuration/BaseConfiguration';
import { gqlBuildSchema } from '../GqlBuildSchema';
import { gqlMaskError } from '../GqlMaskError';
import { GqlServer } from '../GqlServer';
import { GqlServerProvider } from '../GqlServerProvider';

/**
 * An implementation of the GqlServerProvider using GraphQL Yoga.
 * https://the-guild.dev/graphql/yoga-server/docs
 */
export class GraphQLYoga implements GqlServerProvider {
    async getGqlServer(config: GqlConfiguration): Promise<GqlServer> {
        const schema = await gqlBuildSchema(config);
        const typeDefs = printSchema(schema);
        const resolvers = createResolversMap(schema);

        const plugins: Plugin[] = [];
        if (!config.introspection) {
            plugins.push({
                onValidate({ addValidationRule }) {
                    addValidationRule(NoSchemaIntrospectionCustomRule);
                },
            });
        }

        const yoga = createYoga({
            schema: createSchema({
                typeDefs: typeDefs,
                resolvers: resolvers,
            }),
            maskedErrors: {
                errorMessage: 'Unexpected error',
                maskError: gqlMaskError.bind(this),
            },
            graphiql: config.graphiql,
            landingPage: false,
            plugins: plugins,
            // Disable Yoga's built-in CORS handling. Yoga's default reflects
            // any Origin and sets Access-Control-Allow-Credentials: true,
            // which is the textbook credentialed CORS misconfiguration. The
            // BaseRouter wraps the GraphQL handler and runs its own CORS
            // logic with an explicit allowlist, but corsify short-circuits
            // when Allow-Origin is already present, so Yoga's headers win
            // unless we suppress them here. With cors: false, the router's
            // allowlist becomes the only source of CORS headers on these
            // responses.
            cors: false,
        });

        return {
            type: 'GraphQL Yoga',
            schema,
            async handleRequest(request) {
                return await yoga.handleRequest(request, {});
            },
        };
    }
}
