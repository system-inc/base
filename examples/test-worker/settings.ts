// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseSettings } from '@system-inc/base-foundation/base/BaseSettings';
import { GraphQLYoga } from '@system-inc/base-foundation/graphql/providers/GraphQLYoga';
import { PlanetScaleProvider } from '@system-inc/base-foundation/orm/database/adapter/drizzle/mysql/PlanetScaleProvider';
import { D1Provider } from '@system-inc/base-foundation/orm/database/adapter/drizzle/sqlite/D1Provider';
import { OrmArticleEntity } from './source/entities/OrmArticleEntity';
import { OrmAuthorEntity } from './source/entities/OrmAuthorEntity';
import { OrmBookEntity } from './source/entities/OrmBookEntity';
import { OrmBookGenreEntity } from './source/entities/OrmBookGenreEntity';
import { OrmCategoryEntity } from './source/entities/OrmCategoryEntity';
import { OrmCommentEntity } from './source/entities/OrmCommentEntity';
import { OrmCompositeEntity } from './source/entities/OrmCompositeEntity';
import { OrmGenreEntity } from './source/entities/OrmGenreEntity';
import { OrmOrderEntity } from './source/entities/OrmOrderEntity';
import { OrmPostEntity } from './source/entities/OrmPostEntity';
import { OrmProductCategoryEntity } from './source/entities/OrmProductCategoryEntity';
import { OrmProductEntity } from './source/entities/OrmProductEntity';
import { OrmProductTagEntity } from './source/entities/OrmProductTagEntity';
import { OrmTagEntity } from './source/entities/OrmTagEntity';
import { OrmTestEntity } from './source/entities/OrmTestEntity';
import { OrmUserEntity } from './source/entities/OrmUserEntity';
import { TestWorkerProviders } from './source/injection/TestWorkerProviders';
import { QueueOptOut } from './source/modules/queue-opt-out/QueueOptOutModule';
import {
    TestScheduledExecutable,
    TestScheduledExecutable1,
} from './source/scheduled/TestScheduledExecutable';
import {
    AccessControlTestService,
    TestSessionContextProvider,
} from './source/services/AccessControlTestService';
import { crossDispatcherTokenMiddleware } from './source/services/CrossDispatcherInjection';
import { GqlTestService } from './source/services/GqlTestService';
import { OrmDatabaseTestService } from './source/services/OrmDatabaseTestService';
import { OrmRepositoryTestService } from './source/services/OrmRepositoryTestService';
import { RouterTestService } from './source/services/RouterTestService';
import { RpcTestService } from './source/services/RpcTestService';

const ormEntities = [
    OrmTestEntity,
    OrmCompositeEntity,
    OrmCommentEntity,
    OrmPostEntity,
    OrmUserEntity,
    OrmCategoryEntity,
    OrmOrderEntity,
    OrmProductEntity,
    OrmProductCategoryEntity,
    OrmProductTagEntity,
    OrmTagEntity,
    OrmArticleEntity,
    OrmAuthorEntity,
    OrmBookEntity,
    OrmBookGenreEntity,
    OrmGenreEntity,
];

export const TestWorkerSettings: BaseSettings = {
    name: 'test-worker',
    version: '1.0.0',
    title: 'Test Worker',
    server: {
        '@default': {
            port: 3001,
        },
    },
    modules: [
        // A queue processor stripped by `queue: false` — the worker must pass
        // `base check` without any [[queues.consumers]] in wrangler.toml.
        QueueOptOut().with({ queue: false }),
    ],
    orm: {
        '@default': {
            adapterType: 'drizzle',
            databaseType: { dialect: 'mysql', driver: 'planetscale' },
            adapter: PlanetScaleProvider,
            entities: ormEntities,
        },
        d1: {
            adapterType: 'drizzle',
            databaseType: { dialect: 'sqlite', driver: 'd1' },
            adapter: D1Provider,
            binding: 'TEST_DATABASE',
            entities: ormEntities,
        },
    },
    // Self-describing services — each class's decorator (@GqlResolver,
    // @HttpService, @RpcService, @ScheduledExecutable) declares its dispatch
    // surface; the manifest sorts them at boot. Configuration-carrying
    // settings (graphql provider, cors, rpc visibility, middleware) stay in
    // their subsystem slots below.
    services: [
        AccessControlTestService,
        GqlTestService,
        RouterTestService,
        OrmRepositoryTestService,
        OrmDatabaseTestService,
        RpcTestService,
        TestScheduledExecutable,
        TestScheduledExecutable1,
        TestWorkerProviders,
    ],
    graphql: {
        type: GraphQLYoga,
    },
    router: {
        cors: {
            allowedHeaders: ['Content-Type', '*'],
            preflight: true,
            allowedOrigins: {
                '@default': '*',
            },
            allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowCredentials: true,
        },
    },
    rpc: {
        service: {
            visibility: 'public',
        },
    },
    accessControl: {
        // The worker's one identity seam — the reference implementation
        // the access-control routes above are enforced through.
        provider: TestSessionContextProvider,
    },
    middleware: {
        // Cross-dispatcher coverage: the test reads
        // `x-cross-dispatcher-token` once via HTTP and once via
        // GraphQL and asserts both extract the same value through
        // `@InjectRequestContext(crossDispatcherTokenKey)`.
        global: [crossDispatcherTokenMiddleware],
    },
};
