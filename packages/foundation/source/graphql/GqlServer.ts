// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type GraphQLSchema } from 'graphql';

import { BaseRequest } from '../internal/request/BaseRequest';

/**
 * Interface for a GraphQL server that can handle GraphQL requests.
 */
export interface GqlServer {
    /**
     * The type of GraphQL server, eg. 'apollo', 'yoga', etc. This is used for logging and debugging purposes.
     */
    readonly type: string;

    /**
     * The compiled GraphQL schema. Exposed for tooling (eg. printing SDL,
     * generating typed clients) — request handling does not need to read it.
     */
    readonly schema: GraphQLSchema;

    /**
     * Handles a GraphQL request and returns a response.
     */
    handleRequest(request: BaseRequest): Promise<Response>;
}
