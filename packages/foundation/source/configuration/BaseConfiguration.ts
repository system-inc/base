// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    DefaultConfigurationKey,
    namedConfigurationGetValue,
} from '@system-inc/base-common/configuration/NamedConfiguration';
import { DefaultRpcEndpoint } from '@system-inc/base-common/rpc/protocol/DefaultRpcEndpoint';
import { Secret } from '@system-inc/base-common/secret/Secret';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { BaseSettings } from '../base/BaseSettings';
import { getModuleMembership } from '../dependency-injection/ModuleMembership';
import { BaseEvent } from '../event/BaseEvent';
import { BaseEventListener } from '../event/BaseEventListener';
import { GqlSettings } from '../graphql/GqlSettings';
import { LoggingSettings } from '../logging/LoggingSettings';
import { ModuleSettings } from '../module/ModuleSettings';
import { OrmAdapterType } from '../orm/database/adapter/OrmAdapterType';
import { OrmEntityClass } from '../orm/entity/OrmEntityClass';
import { OrmSettings } from '../orm/settings/OrmSettings';
import { WorkerQueueProcessorInterface } from '../queue/consumer/WorkerQueueProcessor';
import { WorkerQueueSettings } from '../queue/WorkerQueueSettings';
import { RouterSettings } from '../router/RouterSettings';
import { RpcServiceSettings, RpcSettings } from '../rpc/RpcSettings';
import { ScheduledExecutableInterface } from '../scheduled/ScheduledExecutableInterface';
import { ScheduledSettings } from '../scheduled/ScheduledSettings';
import { BaseAppManifest } from './BaseAppManifest';
import { BaseEnvironmentKeys } from './BaseEnivronmentKeys';
import { BaseEnvironmentKey } from './BaseEnvironmentKey';
import { BaseModuleKey } from './BaseModuleKey';
import { EnvironmentVariables } from './EnvironmentVariables';
import { Runtime } from './Runtime';

/**
 * Base configuration information that can be injected by consumers.
 *
 * Environment variables are not directly exposed. Use typed
 * {@link BaseEnvironmentKey} instances with {@link getEnvironmentVariable} or
 * {@link requireEnvironmentVariable} to access individual values.
 */
export class BaseConfiguration {
    /**
     * Parsed runtime configuration for modules, database and graphql.
     * These settings are pulled when the settings dependency graph is parsed.
     * It gets flattened into these object to make initialization of the
     * modules, database and graphql easier.
     */
    private getManifest(): BaseAppManifest {
        if (!this._manifest) {
            this._manifest = BaseAppManifest.fromSettings(this._settings);
        }
        return this._manifest;
    }
    private _manifest: BaseAppManifest | null = null;

    constructor(
        private readonly _environmentVariables: EnvironmentVariables,
        private readonly _settings: BaseSettings,
        readonly instanceId: string = crypto.randomUUID(),
    ) {}

    /**
     * The name of this Base application.
     */
    get name(): string {
        return this._settings.name;
    }

    get title(): string {
        return this._settings.title;
    }

    /**
     * The version of this Base application.
     */
    get version(): string {
        return this._settings.version;
    }

    /**
     * The environment Base is running in, eg. Development or Production.
     */
    get runtime(): Runtime {
        if (!this._runtime) {
            this._runtime = new Runtime(this);
        }
        return this._runtime;
    }
    private _runtime: Runtime | null = null;

    get delegate(): BaseSettings['delegate'] {
        return this._settings.delegate;
    }

    get modules(): BaseSettings['modules'] {
        return this._settings.modules;
    }

    /**
     * The database name a class's token-less `@InjectRepository`/
     * `@InjectDatabase` resolves to.
     *
     * Precedence:
     * 1. the class's declared module membership (`@Injectable(SomeModuleKey)`,
     *    `@WorkerScoped(SomeModuleKey)`, …) — resolved through the module
     *    graph, so the worker's `database` registration modifier applies;
     * 2. the default database — a deliberate, uniform contract for an
     *    undeclared class, identical in every worker. (When exactly one
     *    database is configured under a non-default name, that database is
     *    the default in spirit and is used.)
     *
     * Registration deliberately does NOT route injections — it is discovery
     * and exposure, not attribution. `BaseAppManifest.validate()` catches, at
     * boot, a class registered by a non-default-database module that carries
     * token-less injections without declaring its membership; a misrouted
     * default is additionally caught by the runtime entity guard
     * (`requireOwnEntity`).
     */
    getDatabaseNameForClass(target: Constructor): string {
        const membership = getModuleMembership(target);
        if (membership) {
            const databaseName = this.getManifest().getDatabaseForModule(
                membership.name,
            );
            if (databaseName === undefined) {
                throw new Error(
                    `Class "${target.name}" declares membership in module "${membership.name}", but no module with that name is registered in this worker. Register the module, or select a database explicitly with @InjectDatabase(binding) / @InjectRepository(entity, binding).`,
                );
            }
            return databaseName;
        }

        const databaseNames = this._settings.orm
            ? Object.keys(this._settings.orm)
            : [];
        if (databaseNames.length === 1) {
            return databaseNames[0]!;
        }
        return DefaultConfigurationKey;
    }

    getOrmConfiguration(databaseName?: string): OrmConfiguration {
        if (!this._settings.orm) {
            throw new Error(`No ORM settings found.`);
        }

        if (!databaseName) {
            databaseName = DefaultConfigurationKey;
        }

        const ormSettings = namedConfigurationGetValue(
            this._settings.orm,
            databaseName,
            undefined,
        );

        if (!ormSettings) {
            throw new Error(
                `Settings for "${databaseName}" not found in ORM settings.`,
            );
        }

        const entities = this.getManifest().getOrmSettings(databaseName);
        return {
            ...ormSettings,
            ...entities,
            databaseName,
        };
    }

    get router(): RouterConfiguration {
        return {
            ...this._settings.router,
            services: this.getManifest().router.services,
        };
    }

    get graphql(): GqlConfiguration | undefined {
        if (!this._settings.graphql) {
            return undefined;
        }
        if (this._gql) {
            return this._gql;
        }
        // Production-default hardening of the GraphQL surface. Each flag
        // can be overridden per-worker via GqlSettings; the env-aware
        // default keeps dev ergonomic and prod safe without any consumer
        // configuration.
        const isDevelopment = this.runtime.environment.isDevelopment;
        const useGraphiql = this._settings.graphql?.graphiql
            ? namedConfigurationGetValue(
                  this._settings.graphql.graphiql,
                  this.runtime.environment.type,
              )
            : undefined;
        const useIntrospection = this._settings.graphql?.introspection
            ? namedConfigurationGetValue(
                  this._settings.graphql.introspection,
                  this.runtime.environment.type,
              )
            : undefined;
        this._gql = {
            type: this._settings.graphql.type,
            route: this._settings.graphql.route ?? '/graphql',
            resolvers: this.getManifest().graphql.resolvers,
            directives: this.getManifest().graphql.directives,
            graphiql: useGraphiql ?? isDevelopment,
            introspection: useIntrospection ?? isDevelopment,
        };
        return this._gql;
    }
    private _gql: GqlConfiguration | null = null;

    get rpcClient(): RpcSettings['client'] {
        return this._settings.rpc?.client;
    }

    get rpcServer(): RpcServerConfiguration | undefined {
        if (this.getManifest().rpc.services.length === 0) {
            return undefined;
        }
        return {
            ...this._settings.rpc?.service,
            route: this._settings.rpc?.service?.route ?? DefaultRpcEndpoint,
            allowedWorkers: this._settings.rpc?.service?.allowedWorkers ?? [],
            visibility: this._settings.rpc?.service?.visibility ?? 'internal',
            procedures: this.getManifest().rpc.services,
        };
    }

    get scheduled(): ScheduledConfiguration | undefined {
        if (this.getManifest().scheduled.executables.length === 0) {
            return undefined;
        }
        return {
            ...this._settings.scheduled,
            executables: this.getManifest().scheduled.executables,
        };
    }

    get eventBus(): EventBusConfiguration | undefined {
        if (this.getManifest().eventBus.listeners.length === 0) {
            return undefined;
        }
        return {
            listeners: this.getManifest().eventBus.listeners,
        };
    }

    get logging(): LoggingConfiguration {
        return {
            ...this._settings.logging,
            directive: this.getEnvironmentVariable(
                BaseEnvironmentKeys.LogLevel,
            ),
            requestLog: this._settings.logging?.requestLog ?? true,
        };
    }

    get keyValueStorage(): BaseSettings['keyValueStorage'] {
        return this._settings.keyValueStorage;
    }

    get objectStore(): BaseSettings['objectStore'] {
        return this._settings.objectStore;
    }

    get queue(): WorkerQueueConfiguration | undefined {
        const processors = this.getManifest().queue.processors;
        if (!this._settings.queue && processors.length === 0) {
            return undefined;
        }
        return {
            ...this._settings.queue,
            processors,
        };
    }

    get durableObjects(): BaseSettings['durableObjects'] {
        return this._settings.durableObjects;
    }

    get containers(): BaseSettings['containers'] {
        return this._settings.containers;
    }

    /**
     * WebSocket configuration, including delegate settings and
     * module-registered context mappings.
     */
    get webSocket(): BaseSettings['webSocket'] {
        if (this.getManifest().webSocket.delegates.length === 0) {
            return undefined;
        }
        return {
            ...this._settings.webSocket,
            delegates: this.getManifest().webSocket.delegates,
            mappings: this.getManifest().webSocket.mappings,
        };
    }

    /**
     * The aggregated middleware across all modules, ordered by module dependency.
     *
     * @internal Framework use only. The router iterates this on every request.
     */
    get middleware() {
        return this.getManifest().middleware;
    }

    /**
     * The worker's access-control registration (the session-context
     * provider), aggregated from worker and module settings.
     *
     * @internal Framework use only. The session-access middleware resolves
     * the provider through this.
     */
    get accessControl() {
        return this.getManifest().accessControl;
    }

    /**
     * CLI-time extension points aggregated across all modules.
     *
     * @internal CLI use only.
     */
    get cli() {
        return this.getManifest().cli;
    }

    /**
     * Gets an environment variable by typed key.
     * Returns `undefined` if the variable is not set.
     *
     * Keys declared via {@link BaseEnvironmentKey.createSecret} are
     * auto-wrapped in a {@link Secret} so the raw value never flows
     * into logs without an explicit `.reveal()`.
     */
    getEnvironmentVariable<T>(key: BaseEnvironmentKey<T>): T | undefined {
        const rawValue = this._environmentVariables[key.name];
        if (rawValue === undefined) {
            return undefined;
        }
        if (key.isSecret) {
            return new Secret(rawValue) as unknown as T;
        }
        return rawValue as T;
    }

    /**
     * Gets an environment variable by typed key.
     * Throws if the variable is not set.
     */
    requireEnvironmentVariable<T>(key: BaseEnvironmentKey<T>): T {
        const value = this.getEnvironmentVariable(key);
        if (value === undefined) {
            throw new Error(
                `Required environment variable '${key.name}' is not set.`,
            );
        }
        return value;
    }

    /**
     * Gets the settings for a specific module by typed key.
     */
    getModuleSettings<T>(key: BaseModuleKey<T>): ModuleSettings<T> {
        const module = this._settings.modules?.find(
            (module) => module.name === key.name,
        );
        if (!module) {
            throw new Error(
                `Module settings not found for module: ${key.name}`,
            );
        }
        return module.settings as ModuleSettings<T>;
    }

    getVersionInfo(): VersionInfo {
        return {
            name: this.name,
            version: this.version,
            environment: this.runtime.environment.type,
            commit: this.getEnvironmentVariable(
                BaseEnvironmentKeys.CommitSha,
            )?.substring(0, 8),
            builtAt: this.getEnvironmentVariable(
                BaseEnvironmentKeys.BuildTimestamp,
            ),
            id: this.getEnvironmentVariable(
                BaseEnvironmentKeys.CfVersionMetadata,
            )?.id?.substring(0, 8),
            deployedAt: this.getEnvironmentVariable(
                BaseEnvironmentKeys.CfVersionMetadata,
            )?.timestamp,
        };
    }

    /**
     * Controls `JSON.stringify()` output.
     */
    toJSON() {
        return this.safeRepresentation();
    }

    /**
     * Controls string coercion (template literals, `String()`, `"" + obj`).
     */
    toString(): string {
        return `BaseConfiguration(${this.name} v${this.version})`;
    }

    /**
     * Controls `console.log()` output in Node.js and Cloudflare Workers.
     */
    [Symbol.for('nodejs.util.inspect.custom')]() {
        return this.safeRepresentation();
    }

    /**
     * Returns a safe representation for all serialization and logging paths.
     * Excludes environment variable values, the DI container, settings internals,
     * and the manifest.
     */
    private safeRepresentation() {
        return {
            instanceId: this.instanceId,
            name: this.name,
            version: this.version,
            runtime: this.runtime,
            graphql: this.graphql,
            // env var keys only — never values (may contain secrets)
            environmentVariables: Object.keys(this._environmentVariables),
        };
    }
}

/**
 * Runtime ORM configuration for one named database: the database's settings
 * plus the entity lists the manifest aggregated (owned `entities` and
 * queried-only `externalEntities`).
 */
export type OrmConfiguration = OrmSettings<OrmAdapterType> & {
    readonly databaseName: string;
    /**
     * Entities this database owns: migrated by this worker and used for
     * queries.
     */
    readonly entities: OrmEntityClass[];
    /**
     * Entities this worker uses for queries but does NOT own/migrate — the
     * schema is managed elsewhere (a sibling worker's `externalSchema` module
     * registration, or an `inheritSchema` source database). Built into the
     * runtime query schema, but excluded from migration generation.
     */
    readonly externalEntities: OrmEntityClass[];
};

// The runtime configuration shapes extend the (config-only) settings types
// with the class lists the manifest aggregated from `services` — settings
// carry configuration, the manifest carries the classes.
export interface RouterConfiguration extends RouterSettings {
    readonly services: Constructor<object>[];
}

/**
 * Runtime GraphQL configuration: the GraphQL settings with defaults applied
 * (including the environment-aware `graphiql`/`introspection` toggles) plus
 * the resolver classes the manifest aggregated.
 */
export type GqlConfiguration = Required<
    Omit<GqlSettings, 'graphiql' | 'introspection'>
> & {
    readonly resolvers: Constructor<object>[];
    readonly graphiql: boolean;
    readonly introspection: boolean;
};

/**
 * Runtime RPC server configuration: the RPC service settings with defaults
 * applied plus the procedure classes the manifest aggregated.
 */
export type RpcServerConfiguration = Required<RpcServiceSettings> & {
    readonly procedures: Constructor<object>[];
};

export interface WorkerQueueConfiguration extends WorkerQueueSettings {
    readonly processors: Constructor<WorkerQueueProcessorInterface>[];
}

/**
 * Runtime logging configuration: the settings-level defaults (level +
 * per-category overrides), the `LOG_LEVEL` environment directive (which
 * wins where both are set — the engine applies it last at boot), and the
 * request-log switch with its default applied.
 */
export interface LoggingConfiguration extends LoggingSettings {
    readonly directive?: string;
    readonly requestLog: boolean;
}

export interface ScheduledConfiguration extends ScheduledSettings {
    readonly executables: Constructor<ScheduledExecutableInterface>[];
}

/**
 * Runtime event-bus configuration: the `@EventBusListener` classes the
 * manifest aggregated.
 */
export interface EventBusConfiguration {
    readonly listeners: Constructor<BaseEventListener<BaseEvent>>[];
}

/**
 * Build and deployment identity for a worker: its name and version plus the
 * commit, build timestamp, and deployment metadata stamped by the build.
 */
export interface VersionInfo {
    name: string;
    version: string;
    environment: string;
    commit?: string;
    builtAt?: string;
    id?: string;
    deployedAt?: string;
}
