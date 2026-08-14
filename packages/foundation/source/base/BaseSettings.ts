// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { NamedConfiguration } from '@system-inc/base-common/configuration/NamedConfiguration';
import type { Constructor } from '@system-inc/base-common/type/Constructor';
import type { AccessControlSettings } from '../access-control/AccessControlSettings';
import type { CfDurableObjectSettings } from '../cloudflare/durable-object/CfDurableObjectSettings';
import type { GqlSettings } from '../graphql/GqlSettings';
import type { KeyValueStorageSettings } from '../key-value-storage/KeyValueStorageSettings';
import type { LoggingSettings } from '../logging/LoggingSettings';
import {
    BaseMiddlewareRegistration,
    HandlerMiddlewareRegistration,
} from '../middleware/BaseMiddleware';
import type { BaseModule } from '../module/BaseModule';
import type { WorkerConfigValidator } from '../module/WorkerConfigValidator';
import type { ObjectStoreSettings } from '../object-store/ObjectStoreSettings';
import type { OrmAdapterType } from '../orm/database/adapter/OrmAdapterType';
import type { OrmSettings } from '../orm/settings/OrmSettings';
import type { WorkerQueueSettings } from '../queue/WorkerQueueSettings';
import type { RouterSettings } from '../router/RouterSettings';
import type { RpcSettings } from '../rpc/RpcSettings';
import type { ScheduledSettings } from '../scheduled/ScheduledSettings';
import type { WebSocketSettings } from '../web-socket/WebSocketSettings';
import type { BaseWorkerDelegate } from '../worker/BaseWorkerDelegate';
import type { BaseServerSettings } from './BaseServerSettings';

/**
 * The BaseSettings interface provides configuration for your Base Worker.
 * Each of these fields can be optionally set by implementing this interface.
 */
export interface BaseSettings {
    /**
     * The name of the Base Worker.
     */
    readonly name: string;

    /**
     * The title of the project.
     */
    readonly title: string;

    /**
     * The version of the Base Worker.
     */
    readonly version: string;

    /**
     * The environment or list of environments that this worker should be deployed to.
     */
    readonly deployEnvironment?: string | string[];

    /**
     * Opt-in for running module integration tests with this worker.
     * - true: run integration tests for ALL modules this worker registers
     * - string[]: run integration tests only for the listed module names
     * - undefined (default): no module integration tests
     */
    readonly moduleTest?: boolean | string[];

    /**
     * Settings for the local development server.
     */
    readonly server?: NamedConfiguration<BaseServerSettings>;

    /**
     * A delegate for receiving events from the Base Worker.
     */
    readonly delegate?: Constructor<BaseWorkerDelegate>;

    /**
     * The list of modules to load for the Base Worker.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly modules?: BaseModule<any>[];

    /**
     * The settings for the ORM this Base Worker can access.
     */
    readonly orm?: NamedConfiguration<OrmSettings<OrmAdapterType>>;

    /**
     * The settings for the key value storage this Base Worker can access.
     */
    readonly keyValueStorage?: KeyValueStorageSettings;

    /**
     * The settings for object storage (R2 / S3-compatible buckets) this Base
     * Worker can access. Buckets declared here can be injected via
     * `@InjectObjectStore(...)` without requiring the `FileStorage` module.
     */
    readonly objectStore?: ObjectStoreSettings;

    /**
     * Logging settings — the default and per-category log thresholds and
     * the request-log switch. The `LOG_LEVEL` environment variable
     * overrides the thresholds at deploy time.
     */
    readonly logging?: LoggingSettings;

    /**
     * The router settings for the Base Worker (CORS, rewrites). Route
     * handler classes go in `services`.
     */
    readonly router?: RouterSettings;

    /**
     * The GraphQL settings for the Base Worker (provider type, route,
     * directives, graphiql/introspection). Resolver classes go in
     * `services`.
     */
    readonly graphql?: GqlSettings;

    /**
     * The RPC settings for the Base Worker.
     */
    readonly rpc?: RpcSettings;

    /**
     * Middleware settings for this module.
     */
    readonly middleware?: {
        /**
         * Middleware that runs on every request handled by this application.
         *
         * Middleware runs in module dependency order (as declared by `uses:`).
         * Accepts either a function or a class constructor. Classes are
         * resolved from the DI container.
         *
         * Return void to continue to the next middleware; return a Response
         * to short-circuit the pipeline; throw to signal a failure.
         */
        readonly global?: BaseMiddlewareRegistration[];

        /**
         * Middleware that runs before each handler method, after the
         * dispatcher has resolved `rc.handler`. Used for per-handler
         * concerns like rate limiting and access control, typically in
         * combination with a method decorator that stores metadata the
         * middleware reads.
         *
         * Runs in module dependency order. Same short-circuit semantics
         * as `global` middleware. The `HandlerRequestContext` passed to
         * these middlewares guarantees `rc.handler` is set.
         */
        readonly handler?: HandlerMiddlewareRegistration[];
    };

    /**
     * CLI-time extension points for the worker.
     */
    readonly cli?: {
        /**
         * Validators run by the `check-worker` CLI command against
         * the worker's deployment configuration.
         */
        readonly configValidators?: WorkerConfigValidator[];
    };

    /**
     * The access-control settings for the Base Worker — registers the
     * worker's `SessionContextProvider` (apps whose identity system lives
     * in a module register it through that module's settings instead).
     */
    readonly accessControl?: AccessControlSettings;

    /**
     * The WebSocket settings for the Base Worker.
     */
    readonly webSocket?: WebSocketSettings;

    /**
     * The cron settings for the Base Worker.
     */
    readonly scheduled?: ScheduledSettings;

    /**
     * The queue settings for the Base Worker.
     */
    readonly queue?: WorkerQueueSettings;

    /**
     * The classes this worker contributes — the single class slot. Each
     * class's decorators declare what it is: dispatch decorators
     * (`@GqlResolver`, `@HttpService`, `@RpcService`,
     * `@WorkerQueueProcessor`, `@ScheduledExecutable`, `@EventBusListener`)
     * sort it into the matching dispatch surface(s) at boot; `@Provider`
     * hosts and injectable-family classes are loaded so their registrations
     * run. A class with no recognized base decorator is a boot error.
     * Configuration-carrying settings (cors, rpc visibility, webSocket
     * delegates, middleware, directives) stay in their subsystem slots;
     * entities go in `orm`.
     */
    readonly services?: Constructor<object>[];

    /**
     * The settings for Cloudflare Durable Objects.
     */
    readonly durableObjects?: CfDurableObjectSettings[];

    /**
     * The settings for Cloudflare Containers.
     */
    readonly containers?: CfDurableObjectSettings[];
}

/**
 * Runtime guard for a `BaseSettings` object — checks for the required
 * `name`, `version`, and `title` fields.
 */
export function isBaseSettings(value: unknown): value is BaseSettings {
    return (
        typeof value === 'object' &&
        value !== null &&
        'name' in value &&
        'version' in value &&
        'title' in value
    );
}
