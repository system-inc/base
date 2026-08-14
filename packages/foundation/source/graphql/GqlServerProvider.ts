// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { GqlConfiguration } from '../configuration/BaseConfiguration';
import { GqlServer } from './GqlServer';

/**
 * Provides an implementation of GraphQL to the Worker.
 *
 * Providers own schema construction and any third-party server wiring
 * (type-graphql, graphql-yoga, etc.). Keeping that surface here — rather
 * than in the foundation's `GqlDispatcher` — ensures the heavy GraphQL
 * dependencies only land in workers that actually import a provider.
 */
export interface GqlServerProvider {
    /**
     * Build the schema and return a ready-to-serve GraphQL server.
     */
    getGqlServer(config: GqlConfiguration): Promise<GqlServer> | GqlServer;
}
