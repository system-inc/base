// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type GraphQLDirective } from 'graphql';

import { NamedConfiguration } from '@system-inc/base-common/configuration/NamedConfiguration';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { GqlServerProvider } from './GqlServerProvider';

/**
 * GraphQL settings for a Worker.
 */
export interface GqlSettings {
    /**
     * The type of GraphQL adapter to use.
     */
    readonly type: Constructor<GqlServerProvider>;

    /**
     * The route to use for the GraphQL server.
     *
     * @default '/graphql'
     */
    readonly route?: string;

    /**
     * The directives to load for the Worker.
     */
    readonly directives?: GraphQLDirective[];

    /**
     * Whether to expose the in-browser GraphiQL playground at the GraphQL
     * route (served on GET requests).
     *
     * Defaults to `true` in development environments and `false` in
     * production. Set explicitly to override the env-aware default.
     *
     * Disabling in production is recommended: the playground is a
     * convenience for developers and has no use to end users in production.
     *
     * Disabling in production also removes graphiql's GET handler from the GraphQL route.
     */
    readonly graphiql?: NamedConfiguration<boolean>;

    /**
     * Whether schema introspection queries (`__schema`, `__type`) are
     * permitted.
     *
     * Defaults to `true` in development environments and `false` in
     * production. Set explicitly to override the env-aware default.
     *
     * Disabling in production prevents anonymous clients from enumerating
     * the full schema surface (queries, mutations, input types, return
     * shapes), which is the primary recon step for crafting targeted
     * attacks against private resolvers. Frontend codegen and tooling
     * should consume the schema from the development environment, not
     * production.
     */
    readonly introspection?: NamedConfiguration<boolean>;
}
