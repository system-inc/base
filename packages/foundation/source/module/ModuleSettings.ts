// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type GraphQLDirective } from 'graphql';

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { AccessControlSettings } from '../access-control/AccessControlSettings';
import {
    BaseMiddlewareRegistration,
    HandlerMiddlewareRegistration,
} from '../middleware/BaseMiddleware';
import { OrmEntityClass } from '../orm/entity/OrmEntityClass';
import { WebSocketContextMapping } from '../web-socket/WebSocketContextMapping';
import { WebSocketDelegateSettings } from '../web-socket/WebSocketSettings';
import { WorkerConfigValidator } from './WorkerConfigValidator';

/**
 * An interface for defining all modules settings in Base.
 *
 * Modules are self-contained pieces of functionality that can be used in multiple places.
 * You can combine the functionality of multiple modules by using them together in your Workers.
 */
export interface BaseModuleSettings {
    /**
     * Orm settings for this module.
     */
    readonly orm?: {
        /**
         * The name of the database to use for this module.
         * If not provided, the default database will be used.
         */
        readonly databaseName?: string;

        /**
         * A list of Entities to be loaded for this module.
         */
        readonly entities?: OrmEntityClass[];

        /**
         * Tables this module needs in its database **schema** to query/join,
         * but does NOT own (another module/worker owns and migrates them).
         * They build into the runtime query schema but are excluded from this
         * module's migration scope — the module-level analog of the worker's
         * `orm.<db>.externalEntities`.
         *
         * This makes a module self-describing about its schema dependencies:
         * reference another module's exported entity array (e.g.
         * `externalEntities: [...AccountSchema]`) so any worker that registers
         * this module automatically gets those tables in scope — no need to
         * re-list them per worker. Distinct from `uses`, which declares a
         * *module* dependency (services/ordering), not a table dependency.
         *
         * Several modules declaring the same external table is fine: the schema
         * is keyed per-database by table name, so overlap is idempotent.
         */
        readonly externalEntities?: OrmEntityClass[];
    };

    /**
     * GraphQL settings for this module. Resolvers are contributed through
     * the unified `services` array (sorted in by their `@GqlResolver`
     * decorator); this slot carries what can't be a class list.
     */
    readonly graphql?: {
        /**
         * A list of GraphQL Directives to be loaded for this module.
         */
        readonly directives?: GraphQLDirective[];
    };

    readonly webSocket?: {
        /**
         * A list of WebSocketDelegates to be loaded for this module.
         */
        readonly delegates?: WebSocketDelegateSettings[];

        /**
         * Mappings that copy values from the {@link RequestContext} into
         * the {@link WebSocketInfo} context bag at connect time.
         *
         * Modules use this to make per-request values (device id,
         * session id, etc.) available to subsequent WebSocket messages
         * without re-running the HTTP-path middleware.
         */
        readonly mappings?: WebSocketContextMapping[];
    };

    /**
     * Access-control settings for this module. A module that implements
     * the worker's identity system contributes its
     * {@link import('../access-control/SessionContextProvider').SessionContextProvider}
     * here; exactly one provider may be registered across the worker and
     * all its modules.
     */
    readonly accessControl?: AccessControlSettings;

    /**
     * Middleware settings for this module.
     */
    readonly middleware?: {
        /**
         * Middleware that runs on every request handled by this application,
         * before the request is dispatched to any specific handler.
         *
         * Runs in module dependency order (as declared by `uses:`). Accepts
         * either a function or a class constructor — classes are resolved
         * from the DI container.
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
     * The classes this module provides to the system — the single class
     * slot. Each class's decorators declare what it is: dispatch decorators
     * (`@GqlResolver`, `@HttpService`, `@RpcService`,
     * `@WorkerQueueProcessor`, `@ScheduledExecutable`, `@EventBusListener`)
     * sort it into the matching dispatch surface(s) at boot, honoring this
     * registration's feature toggles; `@Provider` hosts and
     * injectable-family classes are loaded so their registrations run. A
     * class with no recognized base decorator is a boot error — it can't do
     * anything, so listing it is a mistake (usually a forgotten decorator).
     * Configuration-carrying settings (directives, webSocket delegates,
     * middleware) stay in their subsystem slots; entities go in
     * `orm.entities`.
     */
    readonly services?: Constructor<object>[];

    /**
     * CLI-time extension points for the module.
     */
    readonly cli?: {
        /**
         * Validators run by the `base check` CLI command against
         * the worker's deployment configuration. Each module can
         * contribute checks to ensure its required bindings, env
         * vars, or other settings are present.
         */
        readonly configValidators?: WorkerConfigValidator[];
    };
}

/**
 * A type for defining the settings for a module.
 */
export type ModuleSettings<ModuleSpecificSettings> = BaseModuleSettings &
    ModuleSpecificSettings;
