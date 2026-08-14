// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { BaseConfiguration } from '../configuration/BaseConfiguration';
import { BaseModuleKey } from '../configuration/BaseModuleKey';
import { ModuleSettings } from './ModuleSettings';

/**
 * Class for defining a module in Base.
 */
export class BaseModule<ModuleSpecificSettings = unknown> {
    /**
     * Creates a Base module.
     *
     * @param create The specification for the module.
     * @param options The options for the module.
     * @returns The created module.
     */
    static create<ModuleSpecificSettings>(
        create: BaseModuleCreate<ModuleSpecificSettings>,
        options?: BaseModuleOptions,
    ): BaseModule<ModuleSpecificSettings> {
        const baseModule = new BaseModule(
            create.key,
            create.settings,
            create.uses,
            create.onCreate,
            create.onInitialize,
        );
        // Registration modifiers are recorded here, but applied once when the
        // manifest is flattened (BaseAppManifest) — never by mutating settings
        // at construction. This keeps a single application point regardless of
        // whether options arrive via `create` or `.with()`.
        if (options) {
            baseModule._options = options;
        }
        baseModule.onCreate();
        return baseModule;
    }

    /**
     * The module's identity — the same `BaseModuleKey` consumers use with
     * `uses`, `configuration.getModuleSettings(key)`, and declared module
     * membership (`@Injectable(key)`). Its phantom settings type is bound to
     * this module's settings at `create`, so the key and the module can't
     * drift apart in name or in type.
     */
    readonly key: BaseModuleKey<ModuleSpecificSettings>;

    /**
     * The name of the module (derived from {@link key}).
     */
    get name(): string {
        return this.key.name;
    }

    /**
     * Settings for this module.
     */
    readonly settings: ModuleSettings<ModuleSpecificSettings>;

    /**
     * A list of modules that this module uses. Entries may be feature-scoped
     * (`{ module, when }`) so they drop out when that feature is stripped.
     */
    readonly uses?: ReadonlyArray<ModuleUse>;

    /**
     * Registration modifiers applied to this module instance (recorded by
     * `create`/`with`, applied when the manifest is flattened).
     */
    get options(): BaseModuleOptions | undefined {
        return this._options;
    }

    private _options?: BaseModuleOptions;

    /**
     * Applies registration modifiers to this module instance and returns it,
     * for chaining at the point of registration:
     *
     * @example
     * modules: [Flow({ ... }).with({ graphql: false })]
     *
     * Repeated calls merge. Modifiers are applied once, during manifest
     * flattening — `with` only records intent.
     */
    with(options: BaseModuleOptions): this {
        this._options = { ...this._options, ...options };
        return this;
    }

    private readonly _onCreate?: (
        settings: ModuleSettings<ModuleSpecificSettings>,
    ) => void;

    private readonly _onInitialize?: (
        settings: ModuleSettings<ModuleSpecificSettings>,
        configuration: BaseConfiguration,
    ) => void | Promise<void>;

    private constructor(
        key: BaseModuleKey<ModuleSpecificSettings>,
        settings: ModuleSettings<ModuleSpecificSettings>,
        uses?: ReadonlyArray<ModuleUse>,
        onCreate?: (settings: ModuleSettings<ModuleSpecificSettings>) => void,
        onInitialize?: (
            settings: ModuleSettings<ModuleSpecificSettings>,
            configuration: BaseConfiguration,
        ) => void | Promise<void>,
    ) {
        this.key = key;
        this.settings = settings;
        this.uses = uses;
        this._onCreate = onCreate;
        this._onInitialize = onInitialize;
    }

    /**
     * Called when the module is created.
     * This is usually right after the constructor is called.
     */
    /// may not be needed anymore
    onCreate(): void {
        if (this._onCreate) {
            this._onCreate(this.settings);
        }
    }

    /**
     * Called when the module is initialized.
     * At this point the Base configuration is available.
     */
    onInitialize(configuration: BaseConfiguration): void | Promise<void> {
        if (this._onInitialize) {
            Logger.info(LogCategory.Base, 'Initializing module: %s', this.name);
            return this._onInitialize(this.settings, configuration);
        }
    }
}

/**
 * Specification for creating a Base module.
 */
export interface BaseModuleCreate<ModuleSpecificSettings> {
    /**
     * The module's identity key — the same `BaseModuleKey` consumers use
     * with `uses`, `configuration.getModuleSettings(key)`, and declared
     * module membership (`@Injectable(key)`). Passing the key (not a
     * string) makes it the single source of the module's name AND binds the
     * key's phantom settings type to this module's settings, so a key
     * declared as `BaseModuleKey.create<StripeModuleSettings>('Stripe')`
     * only accepts settings of that shape.
     */
    readonly key: BaseModuleKey<ModuleSpecificSettings>;

    /**
     * Settings for this module.
     */
    readonly settings: ModuleSettings<ModuleSpecificSettings>;

    /**
     * A list of modules that this module uses. Entries may be feature-scoped
     * (`{ module, when }`).
     */
    readonly uses?: ReadonlyArray<ModuleUse>;

    /**
     * Called when the module is created.
     */
    onCreate?(settings: ModuleSettings<ModuleSpecificSettings>): void;

    /**
     * Called when the module is initialized.
     */
    onInitialize?(
        settings: ModuleSettings<ModuleSpecificSettings>,
        configuration: BaseConfiguration,
    ): Promise<void>;
}

/**
 * Registration modifiers a worker applies when adding a module — the single,
 * uniform way to change how a module participates in *this* worker. Apply them
 * with {@link BaseModule.with} (or pass to {@link BaseModule.create}); they are
 * applied once, when the app manifest is flattened.
 *
 * - Feature toggles (`orm`/`eventBus`/`graphql`/`queue`/`router`/`rpc`/
 *   `scheduled`/`middleware`/`webSocket`): set to `false` to strip that
 *   feature's wiring for this registration — e.g. `middleware: false` keeps a
 *   module's services but drops its global/handler middleware (which otherwise
 *   runs on every request, even where you only wanted the services). A
 *   `{ module, when }` entry in `uses` whose `when` names a stripped feature is
 *   dropped too. Toggles control *wiring*, not the bundle: the stripped code is
 *   still imported and shipped (only its registration is skipped). To drop the
 *   code itself, import a smaller module/layer instead.
 * - `externalSchema`: register the module's entities for queries but do NOT
 *   own/migrate their schema here — another worker (or an inheritSchema source)
 *   owns it. The entities still build into the runtime query schema; they're
 *   excluded from migration generation and the schema:sync table scope.
 * - `database`: route this module to a named database *in this worker*. It
 *   overrides the module's own `settings.orm.databaseName`, so a module reused
 *   across workers can live in different databases per deployment (e.g. the
 *   default database in the main worker, but an external `connected` database
 *   inside a Durable Object whose default database is local SQLite). It governs
 *   both where the module's entities are registered AND where the module's
 *   services' token-less `@InjectRepository`/`@InjectDatabase` resolve to — see
 *   module-aware resolution in {@link BaseModuleSettings.orm} / the orm doc.
 *   Typically paired with `externalSchema: true`.
 *
 * See {@link BaseModuleSettings} for the features these map to.
 */
export interface BaseModuleOptions {
    readonly orm?: boolean;
    readonly eventBus?: boolean;
    readonly graphql?: boolean;
    readonly queue?: boolean;
    readonly router?: boolean;
    readonly rpc?: boolean;
    readonly scheduled?: boolean;
    readonly middleware?: boolean;
    readonly webSocket?: boolean;
    readonly externalSchema?: boolean;
    readonly database?: string;
}

/**
 * The feature toggles a `{ module, when }` dependency can be scoped to. When
 * the named feature is stripped from the declaring module (via
 * {@link BaseModuleOptions}), the dependency is dropped.
 */
export type ModuleFeatureToggle =
    | 'orm'
    | 'eventBus'
    | 'graphql'
    | 'queue'
    | 'router'
    | 'rpc'
    | 'scheduled'
    | 'middleware'
    | 'webSocket';

/**
 * A module dependency entry. Either a bare module key (always required) or a
 * feature-scoped dependency that is only required when `when` is enabled on the
 * declaring module — `when` is optional and omitting it means "always".
 */
export type ModuleUse =
    | BaseModuleKey<unknown>
    | {
          readonly module: BaseModuleKey<unknown>;
          readonly when?: ModuleFeatureToggle;
      };

/**
 * Normalizes a {@link ModuleUse} into `{ module, when? }`.
 */
export function moduleUseInfo(use: ModuleUse): {
    module: BaseModuleKey<unknown>;
    when?: ModuleFeatureToggle;
} {
    return 'module' in use ? use : { module: use };
}
