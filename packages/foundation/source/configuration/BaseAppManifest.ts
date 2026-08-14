// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type GraphQLDirective } from 'graphql';

import { DefaultConfigurationKey } from '@system-inc/base-common/configuration/NamedConfiguration';
import { DecoratorRegistry } from '@system-inc/base-common/decorator/DecoratorRegistry';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { PartialDictionary } from '@system-inc/base-common/type/Dictionary';
import { SessionContextProvider } from '../access-control/SessionContextProvider';
import type { BaseSettings } from '../base/BaseSettings';
import { InjectableDecoratorName } from '../dependency-injection/decorators/Injectable';
import { ProviderDecoratorName } from '../dependency-injection/decorators/Provider';
import { getModuleMembership } from '../dependency-injection/ModuleMembership';
import { BaseEvent } from '../event/BaseEvent';
import { BaseEventListener } from '../event/BaseEventListener';
import { EventBusListenerDecoratorName } from '../event/decorators/EventBusListener';
import { GqlResolverDecoratorName } from '../graphql/decorators/GqlResolver';
import { getAccessControlMetadata } from '../internal/access-control/AccessControlMetadata';
import {
    BaseMiddlewareRegistration,
    HandlerMiddlewareRegistration,
    isHandlerMiddlewareConstructor,
    isMiddlewareConstructor,
} from '../middleware/BaseMiddleware';
import { moduleUseInfo, type BaseModule } from '../module/BaseModule';
import { WorkerConfigValidator } from '../module/WorkerConfigValidator';
import { OrmTableDecoratorName } from '../orm/decorators/OrmTable';
import { OrmEntityClass } from '../orm/entity/OrmEntityClass';
import { ormHasTokenlessInjection } from '../orm/metadata/OrmTokenlessInjections';
import { WorkerQueueProcessorInterface } from '../queue/consumer/WorkerQueueProcessor';
import { WorkerQueueProcessorDecoratorName } from '../queue/decorators/WorkerQueueProcessor';
import { HttpServiceDecoratorName } from '../router/decorators/HttpService';
import { RpcServiceDecoratorName } from '../rpc/decorators/RpcService';
import { ScheduledExecutableDecoratorName } from '../scheduled/decorators/ScheduledExecutable';
import { ScheduledExecutableInterface } from '../scheduled/ScheduledExecutableInterface';
import { WebSocketContextMapping } from '../web-socket/WebSocketContextMapping';
import { WebSocketDelegateSettings } from '../web-socket/WebSocketSettings';

/**
 * The flattened view of a worker's whole module dependency graph. Each
 * registered `services` class is sorted by its decorator marks into the
 * dispatch buckets (GraphQL resolvers, router services, RPC services, queue
 * processors, scheduled executables, event-bus listeners), alongside ORM
 * entities, GraphQL directives, WebSocket delegates, and middleware — the
 * single structure the engine and dispatchers read instead of re-walking
 * modules. Built lazily by `BaseConfiguration` via
 * `BaseAppManifest.fromSettings`; `validate()` performs the boot-time
 * checks that sorting alone can't.
 */
export class BaseAppManifest {
    readonly orm: PartialDictionary<{
        // Owned: migrated by this worker.
        readonly entities: OrmEntityClass[];
        // Used for queries but owned/migrated elsewhere (externalSchema module
        // registration or an inheritSchema source). See OrmConfiguration.
        readonly externalEntities: OrmEntityClass[];
    }> = {};

    /**
     * Maps each DI-resolved class a module (or the worker's top-level
     * settings) registers — services, resolvers, processors, providers, … —
     * to the registration that carries it and the database that registration
     * resolves to. Registration does NOT route token-less
     * `@InjectRepository`/`@InjectDatabase` injections (only a declared
     * module key or the default does); this index exists for boot
     * validation: catching a non-default-database module's class that
     * carries token-less injections without declaring its membership, and
     * contradictory declared-vs-registered attributions.
     * See {@link validate} / {@link getDatabaseForClass}.
     */
    private readonly classDatabases = new Map<
        Constructor,
        { databaseName: string; moduleName: string }
    >();

    /**
     * Maps each registered module's name to the database it resolves to in
     * this worker (its `orm.databaseName`, as overridden by the worker's
     * `database` registration modifier, else the default). Powers declared
     * module membership: a class decorated `@Injectable(SomeModuleKey)` (or
     * any injectable-family decorator) resolves its token-less ORM
     * injections to this database. See {@link getDatabaseForModule}.
     */
    private readonly moduleDatabases = new Map<string, string>();

    /**
     * The database name an undeclared module resolves to. Normally
     * `DefaultConfigurationKey` ('@default'), but when the worker configures
     * exactly one database under a non-default name, that single database is
     * the default in spirit (matching getDatabaseNameForClass) — otherwise a
     * module's entities would be orphaned in a phantom '@default' database.
     * Set from settings in {@link fromSettings}.
     */
    defaultDatabaseName: string = DefaultConfigurationKey;

    readonly eventBus: {
        readonly listeners: Constructor<BaseEventListener<BaseEvent>>[];
    } = {
        listeners: [],
    };

    readonly graphql: {
        readonly resolvers: Constructor<object>[];
        readonly directives: GraphQLDirective[];
    } = {
        resolvers: [],
        directives: [],
    };

    readonly queue: {
        processors: Constructor<WorkerQueueProcessorInterface>[];
    } = {
        processors: [],
    };

    readonly router: {
        readonly services: Constructor<object>[];
    } = {
        services: [],
    };

    readonly rpc: {
        readonly services: Constructor<object>[];
    } = {
        services: [],
    };

    readonly scheduled: {
        executables: Constructor<ScheduledExecutableInterface>[];
    } = {
        executables: [],
    };

    readonly webSocket: {
        delegates: WebSocketDelegateSettings[];
        mappings: WebSocketContextMapping[];
    } = {
        delegates: [],
        mappings: [],
    };

    /**
     * Aggregated middleware across all modules, ordered by module dependency
     * (as declared by `uses:`).
     */
    readonly middleware: {
        global: BaseMiddlewareRegistration[];
        handler: HandlerMiddlewareRegistration[];
    } = {
        global: [],
        handler: [],
    };

    /**
     * The worker's session-context provider — the single identity seam for
     * access control, registered via `accessControl.provider` in worker or
     * module settings. `providerSource` records who registered it, for
     * conflict errors.
     */
    readonly accessControl: {
        provider: Constructor<SessionContextProvider> | null;
        providerSource: string | null;
    } = {
        provider: null,
        providerSource: null,
    };

    /**
     * Registers the session-context provider. Exactly one provider may be
     * registered across the worker and all its modules — a second,
     * different registration is a contradiction and throws. Registering
     * the same class twice is idempotent.
     */
    registerAccessControlProvider(
        provider: Constructor<SessionContextProvider>,
        source: string,
    ): void {
        if (
            this.accessControl.provider &&
            this.accessControl.provider !== provider
        ) {
            throw new Error(
                `Two different SessionContextProviders are registered: ` +
                    `"${this.accessControl.provider.name}" (via ${this.accessControl.providerSource}) ` +
                    `and "${provider.name}" (via ${source}). A worker has exactly one ` +
                    `identity seam — remove one of the accessControl.provider registrations.`,
            );
        }
        this.accessControl.provider = provider;
        this.accessControl.providerSource = source;
    }

    /**
     * Aggregated CLI-time extension points across all modules.
     */
    readonly cli: {
        configValidators: WorkerConfigValidator[];
    } = {
        configValidators: [],
    };

    getOrmSettings(databaseName: string): {
        readonly entities: OrmEntityClass[];
        readonly externalEntities: OrmEntityClass[];
    } {
        if (!this.orm[databaseName]) {
            this.orm[databaseName] = {
                entities: [],
                externalEntities: [],
            };
        }
        return this.orm[databaseName]!;
    }

    /**
     * Records that `target` is registered by `moduleName`, which resolves to
     * `databaseName`. Idempotent for the same database; a class registered in
     * two modules that resolve to *different* databases is a contradictory
     * attribution and throws — the class must declare its membership (or take
     * an explicit binding) instead.
     */
    registerClassDatabase(
        target: Constructor,
        databaseName: string,
        moduleName: string,
    ): void {
        const existing = this.classDatabases.get(target);
        if (existing !== undefined && existing.databaseName !== databaseName) {
            throw new Error(
                `Class "${target.name}" is registered in modules that resolve to ` +
                    `different databases ("${existing.databaseName}" via module ` +
                    `"${existing.moduleName}" and "${databaseName}" via module ` +
                    `"${moduleName}"), so its attribution is contradictory. Declare ` +
                    `the class's module with @Injectable(SomeModuleKey), inject an ` +
                    `explicit database with @InjectDatabase(binding) / ` +
                    `@InjectRepository(entity, binding), or pass the ` +
                    `database/repository in as an argument.`,
            );
        }
        this.classDatabases.set(target, { databaseName, moduleName });
    }

    /**
     * The database name the registration carrying `target` resolves to, or
     * `undefined` if the class isn't registered by any module or worker
     * settings slot. Validation only — token-less ORM injections resolve
     * through declared module membership or the default database, never
     * through registration.
     */
    getDatabaseForClass(target: Constructor): string | undefined {
        return this.classDatabases.get(target)?.databaseName;
    }

    /**
     * Records the database a module resolves to in this worker.
     * @internal called while the module graph flattens
     */
    registerModuleDatabase(moduleName: string, databaseName: string): void {
        this.moduleDatabases.set(moduleName, databaseName);
    }

    /**
     * The database name a module resolves to in this worker, or `undefined`
     * if no module with that name is registered here.
     */
    getDatabaseForModule(moduleName: string): string | undefined {
        return this.moduleDatabases.get(moduleName);
    }

    /**
     * Boot-time validation of the flattened manifest. The dispatch buckets
     * need no decorator assertions — they can only be filled by the
     * `services` sorter, which requires the decorator to place a class at
     * all (a class with no recognized decorator throws during sorting).
     * What remains: entity slots (still registered directly, not sorted by
     * decorator) and declared-module-membership consistency.
     */
    validate(): void {
        const registry = DecoratorRegistry.get();
        for (const [name, settings] of Object.entries(this.orm)) {
            if (!settings) {
                continue;
            }
            registry.assertAll(
                settings.entities,
                OrmTableDecoratorName,
                `orm[${name}].entities`,
            );
            // External entities are real entities too (queried, just not
            // migrated here), so they must carry @OrmTable as well.
            registry.assertAll(
                settings.externalEntities,
                OrmTableDecoratorName,
                `orm[${name}].externalEntities`,
            );
        }
        // webSocket.delegates is intentionally not validated: the settings
        // type is `Constructor<WebSocketDelegate>` so TS enforces the shape
        // structurally, and the per-delegate runtime config (name, path,
        // rpcEndpoint) lives on the settings object — there is no
        // companion decorator that would otherwise carry it.

        // A registered handler carrying access-control decorators with no
        // provider is a contradiction:
        // it would be unenforceable at request time, so fail here rather
        // than serve it unprotected. Scoped to the dispatch surfaces the
        // session-access middleware guards — decorators run at import time,
        // so classes this worker merely imports transitively (without
        // registering) must not demand a provider.
        if (!this.accessControl.provider) {
            const accessControlledClasses = new Set<string>();
            for (const target of [
                ...this.router.services,
                ...this.graphql.resolvers,
                ...this.rpc.services,
            ]) {
                if (
                    getAccessControlMetadata().hasSessionAccessOptionsForClass(
                        target,
                    )
                ) {
                    accessControlledClasses.add(target.name);
                }
            }
            if (accessControlledClasses.size > 0) {
                throw new Error(
                    `Registered handlers use @RequireSessionAccess/@WithSessionAccess ` +
                        `(${[...accessControlledClasses].join(', ')}), but no ` +
                        `SessionContextProvider is registered. Register exactly one ` +
                        `implementation via \`accessControl: { provider: ... }\` in ` +
                        `the worker settings or a module's settings.`,
                );
            }
        }

        // Declared module membership (@Injectable(SomeModuleKey), …) must
        // agree with the module graph, and token-less ORM injections must be
        // attributable: registration never routes injections, so a class a
        // non-default-database module registers has to declare its membership
        // (or take explicit bindings) — otherwise it would silently resolve
        // to the default database.
        for (const [target, registration] of this.classDatabases) {
            const membership = getModuleMembership(target);
            if (membership) {
                const declaredDatabase = this.moduleDatabases.get(
                    membership.name,
                );
                if (declaredDatabase === undefined) {
                    throw new Error(
                        `Class "${target.name}" declares membership in module "${membership.name}", but no module with that name is registered in this worker.`,
                    );
                }
                if (declaredDatabase !== registration.databaseName) {
                    throw new Error(
                        `Class "${target.name}" declares membership in module "${membership.name}" (database "${declaredDatabase}"), but is registered by module "${registration.moduleName}" resolving to database "${registration.databaseName}". A class belongs to exactly one module — remove the conflicting declaration or align the registrations.`,
                    );
                }
            } else if (
                registration.databaseName !== DefaultConfigurationKey &&
                ormHasTokenlessInjection(target)
            ) {
                throw new Error(
                    `Class "${target.name}" is registered by module "${registration.moduleName}" (database "${registration.databaseName}") and uses token-less @InjectRepository/@InjectDatabase, but does not declare its module membership — registration does not route injections, so they would resolve to the default database. Stamp the class with its module key (e.g. @Injectable(SomeModuleKey) / @WorkerScoped(SomeModuleKey)), or select the database explicitly with an injection binding.`,
                );
            }
        }
    }

    /**
     * Builds a manifest by aggregating all registered classes and handlers
     * from the provided settings, including all module dependencies.
     */
    static fromSettings(settings: BaseSettings): BaseAppManifest {
        const manifest = new BaseAppManifest();

        // Classes registered at the worker's top level (not through a module)
        // are attributable to the worker itself, which resolves to the default
        // database — index them so their token-less ORM injections stay
        // unambiguous even in a multi-database worker.
        const indexWorkerClass = (target: Constructor) =>
            manifest.registerClassDatabase(
                target,
                DefaultConfigurationKey,
                'worker settings',
            );

        // Resolve the effective default database: when exactly one database is
        // configured under a non-default name, it is the default in spirit.
        const databaseNames = settings.orm ? Object.keys(settings.orm) : [];
        if (
            databaseNames.length === 1 &&
            databaseNames[0] !== DefaultConfigurationKey
        ) {
            manifest.defaultDatabaseName = databaseNames[0]!;
        }

        // top level orm settings
        if (settings.orm) {
            for (const [database, ormSettings] of Object.entries(
                settings.orm,
            )) {
                manifest.orm[database] = {
                    // Copy the settings arrays — module flattening pushes into
                    // these lists, and aliasing the caller's settings would
                    // duplicate entities on a second fromSettings().
                    // Worker-declared `entities` are owned.
                    entities: [...(ormSettings?.entities || [])],
                    // Worker-declared `externalEntities` are query-only; more are
                    // appended by externalSchema module registrations and by
                    // inheritSchema resolution (see resolveInheritedSchemas).
                    externalEntities: [
                        ...(ormSettings?.externalEntities || []),
                    ],
                };
            }
        }

        // top level graphql directives (instances, not classes)
        if (settings.graphql?.directives) {
            manifest.graphql.directives.push(...settings.graphql.directives);
        }
        // websocket delegates
        if (settings.webSocket?.delegates) {
            manifest.webSocket.delegates.push(...settings.webSocket.delegates);
            for (const delegate of settings.webSocket.delegates) {
                indexWorkerClass(delegate.delegate);
            }
        }
        // top-level services — self-describing classes sorted into dispatch
        // buckets by their decorators (no feature toggles at the worker
        // level; a worker simply doesn't list what it doesn't want).
        settings.services?.forEach((service) => {
            sortServiceIntoBuckets(manifest, service, ALL_DISPATCH_FEATURES);
            indexWorkerClass(service);
        });
        // websocket mappings
        if (settings.webSocket?.mappings) {
            manifest.webSocket.mappings.push(...settings.webSocket.mappings);
        }
        // top-level middleware
        if (settings.middleware?.global) {
            manifest.middleware.global.push(...settings.middleware.global);
        }
        if (settings.middleware?.handler) {
            manifest.middleware.handler.push(...settings.middleware.handler);
        }
        // top-level access-control provider
        if (settings.accessControl?.provider) {
            manifest.registerAccessControlProvider(
                settings.accessControl.provider,
                'worker settings',
            );
            indexWorkerClass(settings.accessControl.provider);
        }
        // top-level cli validators
        if (settings.cli?.configValidators) {
            manifest.cli.configValidators.push(
                ...settings.cli.configValidators,
            );
        }

        // walk module dependencies
        if (settings.modules) {
            const walkedModules = new Map<string, BaseModule<unknown>>();
            for (const module of settings.modules) {
                walkModuleDependencies(
                    manifest,
                    module,
                    walkedModules,
                    settings.modules,
                );
            }
        }

        // resolve `inheritSchema` after all entities (worker + modules) are
        // aggregated, so an inheriting database sees the source's full set.
        if (settings.orm) {
            resolveInheritedSchemas(manifest, settings.orm);
        }

        manifest.validate();

        return manifest;
    }
}

// ── Private helpers for module dependency walking ──

/**
 * Which dispatch surfaces are enabled for a registration — used to honor a
 * module registration's feature toggles when sorting its unified `services`.
 */
interface EnabledDispatchFeatures {
    readonly eventBus: boolean;
    readonly graphql: boolean;
    readonly queue: boolean;
    readonly router: boolean;
    readonly rpc: boolean;
    readonly scheduled: boolean;
}

const ALL_DISPATCH_FEATURES: EnabledDispatchFeatures = {
    eventBus: true,
    graphql: true,
    queue: true,
    router: true,
    rpc: true,
    scheduled: true,
};

/**
 * Sorts a self-describing class from a `services` array into the dispatch
 * bucket(s) its decorators declare — the decorator is the single statement
 * of the class's role, so no per-kind settings slot exists. A class with
 * several dispatch decorators lands in each matching bucket;
 * injectable-family and `@Provider`-host classes are simply loaded. A class
 * with no recognized base decorator throws: it can do nothing, so listing
 * it is a mistake — usually a forgotten decorator, which would otherwise
 * silently drop the class from its dispatch surface.
 */
function sortServiceIntoBuckets(
    manifest: BaseAppManifest,
    target: Constructor<object>,
    enabled: EnabledDispatchFeatures,
): void {
    const registry = DecoratorRegistry.get();
    // Recognition is independent of the feature toggles: a resolver in a
    // `graphql: false` registration is still a recognized, deliberate class
    // — its wiring is stripped, not its legitimacy.
    const recognized =
        registry.has(target, GqlResolverDecoratorName) ||
        registry.has(target, HttpServiceDecoratorName) ||
        registry.has(target, RpcServiceDecoratorName) ||
        registry.has(target, WorkerQueueProcessorDecoratorName) ||
        registry.has(target, ScheduledExecutableDecoratorName) ||
        registry.has(target, EventBusListenerDecoratorName) ||
        registry.has(target, InjectableDecoratorName) ||
        registry.has(target, ProviderDecoratorName);
    if (!recognized) {
        throw new Error(
            `Class "${target.name}" is listed in services but carries no recognized base decorator, so it would do nothing. Add the decorator that declares what it is — a dispatch decorator (@GqlResolver, @HttpService, @RpcService, @WorkerQueueProcessor, @ScheduledExecutable, @EventBusListener), an injectable-family decorator (@Injectable, @WorkerScoped, @ContainerScoped, @ResolutionScoped, @Singleton), or a @Provider method. Entities belong under orm entities, not services.`,
        );
    }
    if (enabled.graphql && registry.has(target, GqlResolverDecoratorName)) {
        manifest.graphql.resolvers.push(target);
    }
    if (enabled.router && registry.has(target, HttpServiceDecoratorName)) {
        manifest.router.services.push(target);
    }
    if (enabled.rpc && registry.has(target, RpcServiceDecoratorName)) {
        manifest.rpc.services.push(target);
    }
    if (
        enabled.queue &&
        registry.has(target, WorkerQueueProcessorDecoratorName)
    ) {
        manifest.queue.processors.push(
            target as Constructor<WorkerQueueProcessorInterface>,
        );
    }
    if (
        enabled.scheduled &&
        registry.has(target, ScheduledExecutableDecoratorName)
    ) {
        manifest.scheduled.executables.push(
            target as Constructor<ScheduledExecutableInterface>,
        );
    }
    if (
        enabled.eventBus &&
        registry.has(target, EventBusListenerDecoratorName)
    ) {
        manifest.eventBus.listeners.push(
            target as Constructor<BaseEventListener<BaseEvent>>,
        );
    }
}

function walkModuleDependencies(
    manifest: BaseAppManifest,
    module: BaseModule<unknown>,
    walkedModules: Map<string, BaseModule<unknown>>,
    allModules: BaseModule<unknown>[],
) {
    // Break cycles/diamonds in the dependency graph — but only when it is the
    // SAME module reached again. Two DIFFERENT modules sharing a name (with
    // their own, possibly contradictory, settings and registration modifiers)
    // is a mistake, not a re-visit: fail loudly rather than silently dropping
    // the second registration.
    const alreadyWalked = walkedModules.get(module.name);
    if (alreadyWalked) {
        if (alreadyWalked === module) {
            return;
        }
        throw new Error(
            `Two different modules are registered with the name "${module.name}". ` +
                `Module names must be unique — rename one, or register a single instance ` +
                `(a second registration's settings and modifiers would otherwise be silently dropped).`,
        );
    }
    walkedModules.set(module.name, module);

    // if the module has no dependencies, gather its metadata immediately
    if (!module.uses) {
        gatherModuleMetadata(module, manifest);
        return;
    }

    // walk all dependencies first
    for (const use of module.uses) {
        const { module: moduleKey, when } = moduleUseInfo(use);
        // A feature-scoped dependency is dropped when that feature is stripped
        // from the declaring module — e.g. `{ module: Account, when: 'graphql' }`
        // is not required when this module is registered with `graphql: false`.
        if (when && module.options?.[when] === false) {
            continue;
        }
        const dependency = allModules.find((m) => m.name === moduleKey.name);
        if (!dependency) {
            throw new Error(
                `Module "${moduleKey.name}" was not found in the modules list, ` +
                    `but is required by the module "${module.name}". Does it need to be added to ` +
                    `the module list in your project settings?`,
            );
        }
        walkModuleDependencies(manifest, dependency, walkedModules, allModules);
    }

    // then gather this module's metadata
    gatherModuleMetadata(module, manifest);
}

function gatherModuleMetadata(module: BaseModule, manifest: BaseAppManifest) {
    // Registration modifiers (BaseModuleOptions) are applied here — the single
    // point where a worker's per-registration choices take effect. `=== false`
    // strips a feature; `externalSchema` redirects entities to the query-only
    // bucket; `database` redirects the whole module to a named database.
    const options = module.options;
    // The database this module resolves to in this worker. `database` (a
    // per-registration override) wins over the module's own `databaseName`,
    // then the default. Drives both entity placement and module-aware
    // resolution (every class below is indexed against it).
    const moduleDatabase =
        options?.database ??
        module.settings.orm?.databaseName ??
        manifest.defaultDatabaseName;
    manifest.registerModuleDatabase(module.name, moduleDatabase);
    // Index a DI-resolved class against this module's database so its token-less
    // ORM injections resolve here. Throws on a class shared by modules that
    // resolve to different databases (see registerClassDatabase).
    const indexClass = (target: Constructor) =>
        manifest.registerClassDatabase(target, moduleDatabase, module.name);
    // orm — skipped entirely when `orm: false`. The module's own `entities` are
    // owned, or routed to the external (query-only, not migrated) bucket when
    // `externalSchema: true`. The module's declared `externalEntities` are tables
    // it queries but never owns, so they are ALWAYS external regardless of the
    // externalSchema modifier. Both target the module's resolved database.
    if (options?.orm !== false && module.settings.orm) {
        const ormSettings = manifest.getOrmSettings(moduleDatabase);
        if (module.settings.orm.entities) {
            const target = options?.externalSchema
                ? ormSettings.externalEntities
                : ormSettings.entities;
            target.push(...module.settings.orm.entities);
        }
        if (module.settings.orm.externalEntities) {
            ormSettings.externalEntities.push(
                ...module.settings.orm.externalEntities,
            );
        }
    }
    // graphql directives (instances, not classes)
    if (options?.graphql !== false && module.settings.graphql?.directives) {
        manifest.graphql.directives.push(...module.settings.graphql.directives);
    }
    // websocket delegates + mappings
    if (options?.webSocket !== false && module.settings.webSocket) {
        if (module.settings.webSocket.delegates) {
            manifest.webSocket.delegates.push(
                ...module.settings.webSocket.delegates,
            );
            for (const delegate of module.settings.webSocket.delegates) {
                indexClass(delegate.delegate);
            }
        }
        if (module.settings.webSocket.mappings) {
            manifest.webSocket.mappings.push(
                ...module.settings.webSocket.mappings,
            );
        }
    }
    // middleware — appended in module dependency order. Strippable because a
    // module's global middleware runs on EVERY request; a worker that wants the
    // module's services but not its (HTTP-assuming) middleware sets middleware: false.
    if (options?.middleware !== false && module.settings.middleware) {
        if (module.settings.middleware.global) {
            manifest.middleware.global.push(
                ...module.settings.middleware.global,
            );
            // Index class-based middleware against this module's database so
            // its token-less ORM injections resolve here, like every other
            // DI-resolved class above; function middleware has no injections.
            for (const registration of module.settings.middleware.global) {
                if (isMiddlewareConstructor(registration)) {
                    indexClass(registration);
                }
            }
        }
        if (module.settings.middleware.handler) {
            manifest.middleware.handler.push(
                ...module.settings.middleware.handler,
            );
            for (const registration of module.settings.middleware.handler) {
                if (isHandlerMiddlewareConstructor(registration)) {
                    indexClass(registration);
                }
            }
        }
    }
    // access-control provider — plumbing like services/cli, so no feature
    // toggle: a module that carries the worker's identity seam carries it
    // wherever it is registered.
    if (module.settings.accessControl?.provider) {
        manifest.registerAccessControlProvider(
            module.settings.accessControl.provider,
            `module "${module.name}"`,
        );
        indexClass(module.settings.accessControl.provider);
    }
    // cli validators
    if (module.settings.cli?.configValidators) {
        manifest.cli.configValidators.push(
            ...module.settings.cli.configValidators,
        );
    }
    // services — the single class slot: each class is sorted into the
    // dispatch bucket(s) its decorators declare (honoring this
    // registration's feature toggles); injectable-family and @Provider-host
    // classes are simply loaded. All are indexed for boot validation of
    // database attribution.
    module.settings.services?.forEach((service) => {
        sortServiceIntoBuckets(manifest, service, {
            eventBus: options?.eventBus !== false,
            graphql: options?.graphql !== false,
            queue: options?.queue !== false,
            router: options?.router !== false,
            rpc: options?.rpc !== false,
            scheduled: options?.scheduled !== false,
        });
        indexClass(service);
    });
}

// Resolve `inheritSchema`: a database with `inheritSchema: 'X'` is a replica of
// X's schema, so it gains X's complete entity set as EXTERNAL entities —
// queryable here, but owned/migrated by X, never by the inheriting database. The
// inheriting database keeps its own `entities` as owned. Resolution is
// transitive (`a → b → c`) with missing-target and cycle detection. Source
// databases are left untouched.
function resolveInheritedSchemas(
    manifest: BaseAppManifest,
    ormSettings: NonNullable<BaseSettings['orm']>,
): void {
    // The complete schema a database sees = its owned entities ∪ its external
    // entities (including everything pulled in by inheritance). Memoized.
    const completeSets = new Map<string, OrmEntityClass[]>();

    const resolve = (name: string, stack: string[]): OrmEntityClass[] => {
        const cached = completeSets.get(name);
        if (cached) {
            return cached;
        }

        const entry = manifest.orm[name];
        const ownEntities = entry?.entities ?? [];
        const source = ormSettings[name]?.inheritSchema;

        if (source) {
            if (!(source in ormSettings)) {
                throw new Error(
                    `ORM database '${name}' sets inheritSchema: '${source}', but no ORM database named '${source}' is configured.`,
                );
            }
            if (stack.includes(name)) {
                throw new Error(
                    `Circular inheritSchema detected: ${[...stack, name].join(' → ')}.`,
                );
            }
            // Everything the source sees that this database doesn't already own
            // becomes external here (queryable, not migrated).
            const inherited = resolve(source, [...stack, name]);
            if (entry) {
                const ownSet = new Set(ownEntities);
                const externalSet = new Set(entry.externalEntities);
                for (const inheritedEntity of inherited) {
                    if (
                        !ownSet.has(inheritedEntity) &&
                        !externalSet.has(inheritedEntity)
                    ) {
                        entry.externalEntities.push(inheritedEntity);
                        externalSet.add(inheritedEntity);
                    }
                }
            }
        }

        const complete = [
            ...new Set([...ownEntities, ...(entry?.externalEntities ?? [])]),
        ];
        completeSets.set(name, complete);
        return complete;
    };

    for (const name of Object.keys(ormSettings)) {
        if (!ormSettings[name]?.inheritSchema) {
            continue;
        }
        // resolve() mutates the inheriting database's `externalEntities` in
        // place; the owned `entities` are deliberately left untouched.
        resolve(name, []);
    }
}
