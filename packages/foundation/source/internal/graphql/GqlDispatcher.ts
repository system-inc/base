// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type GraphQLSchema } from 'graphql';

import { GqlConfiguration } from '../../configuration/BaseConfiguration';
import { GqlServer } from '../../graphql/GqlServer';
import { GqlServerProvider } from '../../graphql/GqlServerProvider';
import { BaseRequest } from '../request/BaseRequest';

/**
 * Per-worker GraphQL orchestrator. Holds the user-configured provider and
 * lazily fetches the underlying server on first use.
 *
 * Intentionally kept dependency-free: anything that touches type-graphql,
 * graphql-yoga, or graphql's runtime lives in the provider so that workers
 * without GraphQL don't pull those packages into their bundles.
 */
export class GqlDispatcher {
    private _gqlServer: GqlServer | null = null;

    constructor(
        private readonly gqlProvider: GqlServerProvider,
        private readonly config: GqlConfiguration,
    ) {}

    async getSchema(): Promise<GraphQLSchema> {
        return (await this.getGqlServer()).schema;
    }

    async handleRequest(request: BaseRequest): Promise<Response> {
        return (await this.getGqlServer()).handleRequest(request);
    }

    private async getGqlServer(): Promise<GqlServer> {
        if (this._gqlServer) {
            return this._gqlServer;
        }

        if (this.config.resolvers.length === 0) {
            throw new Error('At least one GraphQL resolver must be provided');
        }

        this._gqlServer = await this.gqlProvider.getGqlServer(this.config);
        return this._gqlServer;
    }
}
