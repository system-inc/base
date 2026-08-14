// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { YogaInitialContext } from 'graphql-yoga';

import { BaseRequest } from '../request/BaseRequest';

/**
 * Base GraphQL Context. This is the context that is passed to the GraphQL resolvers.
 */
export interface GqlContext extends YogaInitialContext {
    /**
     * The HTTP request.
     *
     * Overrides the default request type from Yoga to use our BaseRequest,
     * which has additional functionality and context.
     */
    readonly request: BaseRequest;

    /**
     * A list of GraphQL operations that will run as part of the request.
     */
    readonly operations: ReadonlyArray<string>;
}
