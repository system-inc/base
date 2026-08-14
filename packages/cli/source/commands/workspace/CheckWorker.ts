// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { DefaultConfigurationKey } from '@system-inc/base-common/configuration/NamedConfiguration';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { Base } from '@system-inc/base-foundation/base/Base';
import { EnvironmentVariables } from '@system-inc/base-foundation/configuration/EnvironmentVariables';
import {
    WorkerBindings,
    WorkerConfigValidationContext,
    WorkerConfigValidationError,
} from '@system-inc/base-foundation/module/WorkerConfigValidator';
import { ormGetTable } from '@system-inc/base-foundation/orm/metadata/OrmSchemaRegistry';
import {
    isOrmSettingsD1,
    isOrmSettingsDurableSQLite,
} from '@system-inc/base-foundation/orm/settings/OrmSettings';
import { RpcClientSettings } from '@system-inc/base-foundation/rpc/RpcSettings';
import { BaseProvider } from '../../common/BaseProvider';
import {
    drizzleMigrationsTableName,
    ormCheckDrizzleSchema,
} from '../../orm/drizzle/OrmGetDrizzleBoilerplate';
import {
    BaseSettingsModule,
    BaseWorkerProject,
    resetBaseGlobalState,
} from '../../project/BaseWorkerProject';
import { WranglerToml } from '../../project/WranglerToml';
import {
    performGqlSchemaCheck,
    printGqlSchemaCheckResult,
} from '../graphql/GqlSchemaCheck';
import { validateMigrations } from './DurableSqliteMigrationValidator';
import { displayValidationResults } from './DurableSqliteMigrationValidatorDisplay';
import {
    checkPaginationInputIndexes,
    printPaginationInputIndexWarnings,
} from './PaginationInputCheck';
import {
    resolveSharedDatabaseIdentity,
    SharedDatabaseOwnershipCollector,
} from './SharedDatabaseOwnership';

export async function checkWorker(
    args: yargs.Arguments,
    environment: string,
    _interactive: boolean = false,
    sharedDatabaseOwnership?: SharedDatabaseOwnershipCollector,
): Promise<boolean> {
    const workerName = args.worker as string;
    console.log(`[${workerName}]: Checking worker...`);
    resetBaseGlobalState();
    // create the base project and parse the settings module
    const project = BaseWorkerProject.create(args);
    const settingsModule = await project.loadSettingsModule(environment);

    // Skip the worker entirely if it declares a deployEnvironment that
    // doesn't include the active environment — no checks, no deployment.
    // Evaluated before Base init so a gated-out worker does no extra work.
    if (
        !matchesDeployEnvironment(
            settingsModule.settings.deployEnvironment,
            environment,
            workerName,
        )
    ) {
        return false;
    }

    // create an instance of the base provider and initialize base
    console.log('/*********** Initializing Base ***********/');
    const baseProvider = new BaseProvider(args);
    const base = await baseProvider.getBase();
    await base.initialize();
    console.log('/*********** Base Initialized ***********/');

    const wranglerToml = WranglerToml.parse(project);
    const [environmentVariables, _wranglerEnvironmentVariables] =
        project.loadEnvironmentVariables(environment);

    console.log(`[${workerName}]: Checking wrangler.toml configuration...`);
    checkWranglerConfiguration(
        environment,
        project,
        base,
        settingsModule,
        wranglerToml,
    );
    console.log(`[${workerName}]: wrangler.toml configuration check passed!`);

    console.log(`[${workerName}]: Running module config validators...`);
    await runModuleConfigValidators(
        environment,
        workerName,
        base,
        settingsModule,
        wranglerToml,
        environmentVariables,
    );
    console.log(`[${workerName}]: Module config validators passed!`);

    console.log(`[${workerName}]: Checking ORM configuration...`);
    await checkOrmConfiguration(project, environment, settingsModule);
    console.log(`[${workerName}]: ORM configuration check passed!`);

    // Pagination inputs: every @PaginationInputFor filter/order column
    // should be index-backed on its entity. Warning-only — an unindexed
    // exposure is a performance foot-gun, not a broken worker. Scoped to
    // this worker's entities so a multi-worker run reports each
    // declaration once, under the worker that registers its entity.
    const workerEntities = new Set<Constructor<object>>();
    if (settingsModule.settings.orm) {
        for (const databaseName of Object.keys(settingsModule.settings.orm)) {
            const ormConfiguration =
                base.configuration.getOrmConfiguration(databaseName);
            for (const entity of [
                ...ormConfiguration.entities,
                ...ormConfiguration.externalEntities,
            ]) {
                workerEntities.add(entity);
            }

            // Multi-worker runs compare ownership across workers after
            // the loop: record which tables this worker OWNS (migrates)
            // on each physically-identifiable shared database.
            if (sharedDatabaseOwnership) {
                const databaseIdentity = resolveSharedDatabaseIdentity(
                    project,
                    environment,
                    settingsModule.settings,
                    ormConfiguration,
                );
                if (databaseIdentity !== undefined) {
                    const tableNames = [
                        ...new Set(
                            ormConfiguration.entities
                                .map((entity) => ormGetTable(entity)?.name)
                                .filter(
                                    (name): name is string =>
                                        typeof name === 'string',
                                ),
                        ),
                    ];
                    sharedDatabaseOwnership.record({
                        workerName,
                        databaseName,
                        databaseIdentity,
                        tableNames,
                    });
                }
            }
        }
    }
    const paginationWarnings = checkPaginationInputIndexes(workerEntities);
    if (paginationWarnings.length > 0) {
        printPaginationInputIndexWarnings(
            paginationWarnings,
            `[${workerName}]: `,
        );
    }

    // GraphQL schema drift — only meaningful when the worker uses
    // GraphQL. Aggregate check: workers without graphql skip silently.
    if (base.configuration.graphql) {
        console.log(
            `[${workerName}]: Checking GraphQL schema is up-to-date with the committed baseline...`,
        );
        const gqlResult = await performGqlSchemaCheck(base, project);
        printGqlSchemaCheckResult(gqlResult, {
            logPrefix: `[${workerName}]: `,
        });
        if (
            gqlResult.state === 'missing-baseline' ||
            gqlResult.state === 'breaking'
        ) {
            process.exit(1);
        }
    }

    console.log(`[${workerName}]: Check worker passed!`);
    return true;
}

/**
 * Evaluates a worker's `deployEnvironment` gate. A worker may declare a
 * single environment or a list of environments it is allowed to deploy
 * to; when the active `environment` isn't among them the worker is
 * skipped — no checks, no deployment. Returns `true` when the worker
 * should proceed, `false` (with a skip log) when it is gated out.
 *
 * A worker with no `deployEnvironment` always proceeds; an empty-array
 * declaration matches nothing, so the worker is never deployed anywhere.
 */
export function matchesDeployEnvironment(
    deployEnvironment: string | string[] | undefined,
    environment: string,
    workerName: string,
): boolean {
    if (deployEnvironment === undefined) {
        return true;
    }
    const allowed = Array.isArray(deployEnvironment)
        ? deployEnvironment
        : [deployEnvironment];
    if (allowed.includes(environment)) {
        return true;
    }
    console.log(
        `[${workerName}]: Skipping worker, environment '${environment}' is not in the deployEnvironment list.`,
    );
    return false;
}

/**
 * Framework-generic wrangler.toml checks. Module-specific checks are
 * contributed through {@link WorkerConfigValidator}s in
 * {@link BaseModuleSettings.cli.configValidators}.
 */
function checkWranglerConfiguration(
    environment: string,
    project: BaseWorkerProject,
    base: Base,
    settingsModule: BaseSettingsModule,
    wranglerToml: WranglerToml.WranglerSettings,
) {
    // The runtime name is a routing key, not a label: WebSocketService
    // stamps `configuration.name` as `origin` on forwarded events and
    // matches on `target === configuration.name`. A worker deployed
    // under a different script name than it calls itself silently
    // misroutes cross-worker WebSocket forwarding — the event goes
    // nowhere and nothing logs. Checked per environment against the
    // active env block's deployed name.
    const deployedName = wranglerToml.env[environment]?.name;
    if (
        deployedName !== undefined &&
        deployedName !== settingsModule.settings.name
    ) {
        console.error(
            `[${project.worker}]: settings.name is '${settingsModule.settings.name}' but wrangler.toml deploys to ${environment} as '${deployedName}'. ` +
                'The name a worker calls itself must be the name it deploys under.',
        );
        process.exit(1);
    }

    // check for all queue producer bindings
    if (settingsModule.settings.queue?.bindings) {
        const queueProducers: WranglerToml.QueueProducer[] | undefined =
            wranglerToml.env[environment]?.queues?.producers;
        if (!queueProducers || !Array.isArray(queueProducers)) {
            console.error(
                `No producers found in wrangler.toml for worker ${project.worker}, but worker contains queue bindings: ${settingsModule.settings.queue.bindings}`,
            );
            process.exit(1);
        }
        settingsModule.settings.queue.bindings.forEach((binding) => {
            const boundQueue = queueProducers.find(
                (queueProducer) => queueProducer.binding === binding,
            );
            if (!boundQueue) {
                console.error(
                    `No queue producers found in wrangler.toml for producer ${binding}`,
                );
                process.exit(1);
            }
        });
    }

    // A worker with active @WorkerQueueProcessor classes must declare at least
    // one [[queues.consumers]] in wrangler.toml, or the processors deploy but
    // never receive messages — a silently dead consumer. The manifest-filtered
    // list (configuration.queue.processors) is the source of truth, never the
    // decoration-time metadata: a processor lands in BaseMetadata the moment
    // its file is imported, before registration and `queue: false` opt-outs
    // apply, so the metadata answers "what was imported", not "what will
    // dispatch". Note the processor `type` is a per-message routing
    // discriminator, NOT the queue name (one consumed queue can carry many
    // message types), so this is a presence check, not a per-name match like
    // producers.
    const queueProcessors = base.configuration.queue?.processors ?? [];
    if (queueProcessors.length > 0) {
        const queueConsumers: WranglerToml.QueueConsumer[] | undefined =
            wranglerToml.env[environment]?.queues?.consumers;
        if (
            !queueConsumers ||
            !Array.isArray(queueConsumers) ||
            queueConsumers.length === 0
        ) {
            const processorNames = queueProcessors
                .map((processor) => processor.name)
                .join(', ');
            console.error(
                `Worker ${project.worker} has registered queue processors (${processorNames}) but no [[queues.consumers]] in wrangler.toml for environment '${environment}' — the processors would deploy but never receive messages.`,
            );
            process.exit(1);
        }
    }

    // check for all kv bindings
    if (settingsModule.settings.keyValueStorage) {
        const kvBindings: WranglerToml.KVNamespace[] | undefined =
            wranglerToml.env[environment]?.kv_namespaces;
        if (!kvBindings || !Array.isArray(kvBindings)) {
            console.error(
                `No kv bindings found in wrangler.toml for worker ${project.worker}, but worker contains kv bindings: ${settingsModule.settings.keyValueStorage}`,
            );
            process.exit(1);
        }
        settingsModule.settings.keyValueStorage.stores.forEach((kv) => {
            const boundKV = kvBindings.find(
                (kvBinding) => kvBinding.binding === kv.name,
            );
            if (!boundKV) {
                console.error(
                    `No kv bindings found in wrangler.toml for kv binding ${kv.name}`,
                );
                process.exit(1);
            }
        });
    }

    // check for all object store (R2) bucket bindings
    if (settingsModule.settings.objectStore) {
        const r2Bindings: WranglerToml.R2Bucket[] | undefined =
            wranglerToml.env[environment]?.r2_buckets;
        if (!r2Bindings || !Array.isArray(r2Bindings)) {
            console.error(
                `No r2 bucket bindings found in wrangler.toml for worker ${project.worker}, but worker contains objectStore buckets: ${settingsModule.settings.objectStore.buckets.map((b) => b.name).join(', ')}`,
            );
            process.exit(1);
        }
        settingsModule.settings.objectStore.buckets.forEach((bucket) => {
            const bound = r2Bindings.find(
                (r2) => r2.binding === bucket.binding,
            );
            if (!bound) {
                console.error(
                    `No r2 bucket binding '${bucket.binding}' found in wrangler.toml for bucket '${bucket.name}'`,
                );
                process.exit(1);
            }
        });
    }

    // check for all rpc client service bindings declared at the top level
    const rpcBindings: WranglerToml.ServiceBinding[] | undefined =
        wranglerToml.env[environment]?.services;
    const rpcClientSettings: RpcClientSettings[] = [];
    if (settingsModule.settings.rpc?.client) {
        rpcClientSettings.push(...settingsModule.settings.rpc.client);
    }
    if (rpcClientSettings.length > 0) {
        if (!rpcBindings || !Array.isArray(rpcBindings)) {
            console.error(
                `No rpc bindings found in wrangler.toml for worker ${project.worker}, but worker contains rpc clients: ${rpcClientSettings}`,
            );
            process.exit(1);
        }
        rpcClientSettings.forEach((rpcClient) => {
            const boundService = rpcBindings.find(
                (rpcBinding) =>
                    rpcBinding.binding ===
                    (rpcClient.environments[environment]?.binding ||
                        rpcClient.environments[DefaultConfigurationKey]
                            ?.binding),
            );
            if (!boundService) {
                console.error(
                    `No rpc service found in wrangler.toml for service ${rpcClient.name}`,
                );
                process.exit(1);
            }
        });
    }

    // check for all durable object + container bindings — containers are
    // exposed through `durable_objects.bindings` in wrangler.toml too.
    const doDeclared = [
        ...(settingsModule.settings.durableObjects ?? []),
        ...(settingsModule.settings.containers ?? []),
    ];
    if (doDeclared.length > 0) {
        const doBindings: WranglerToml.DurableObjectBinding[] | undefined =
            wranglerToml.env[environment]?.durable_objects?.bindings;
        if (!doBindings || !Array.isArray(doBindings)) {
            console.error(
                `No durable_objects.bindings found in wrangler.toml for worker ${project.worker}, but worker contains durable object/container namespaces: ${doDeclared.map((d) => d.namespace).join(', ')}`,
            );
            process.exit(1);
        }
        doDeclared.forEach((entry) => {
            const bound = doBindings.find((b) => b.name === entry.namespace);
            if (!bound) {
                console.error(
                    `No durable_objects.bindings entry found in wrangler.toml for namespace '${entry.namespace}'`,
                );
                process.exit(1);
            }
        });
    }

    // check for all containers also declared in the [[containers]] section
    if (settingsModule.settings.containers?.length) {
        const containerEntries: WranglerToml.Container[] | undefined =
            wranglerToml.env[environment]?.containers;
        if (!containerEntries || !Array.isArray(containerEntries)) {
            console.error(
                `No containers section found in wrangler.toml for worker ${project.worker}, but worker declares containers: ${settingsModule.settings.containers.map((c) => c.namespace).join(', ')}`,
            );
            process.exit(1);
        }
        // Wrangler links a container to its DO binding through `class_name`,
        // which matches `durable_objects.bindings[*].class_name` for the
        // namespace. We assert that each declared namespace has a
        // corresponding container entry sharing the same class_name.
        const doBindings =
            wranglerToml.env[environment]?.durable_objects?.bindings ?? [];
        settingsModule.settings.containers.forEach((container) => {
            const doBinding = doBindings.find(
                (b) => b.name === container.namespace,
            );
            if (!doBinding) {
                // already reported above
                return;
            }
            const containerEntry = containerEntries.find(
                (c) => c.class_name === doBinding.class_name,
            );
            if (!containerEntry) {
                console.error(
                    `No [[containers]] entry found in wrangler.toml for class_name '${doBinding.class_name}' (namespace '${container.namespace}')`,
                );
                process.exit(1);
            }
        });
    }

    // check for all D1 ORM bindings
    if (settingsModule.settings.orm) {
        const d1Bindings: WranglerToml.D1Database[] | undefined =
            wranglerToml.env[environment]?.d1_databases;
        for (const [databaseName, ormConfig] of Object.entries(
            settingsModule.settings.orm,
        )) {
            if (!ormConfig || !isOrmSettingsD1(ormConfig)) {
                continue;
            }
            if (!d1Bindings || !Array.isArray(d1Bindings)) {
                console.error(
                    `No d1_databases found in wrangler.toml for worker ${project.worker}, but orm '${databaseName}' uses D1 with binding '${ormConfig.binding}'`,
                );
                process.exit(1);
            }
            const bound = d1Bindings.find(
                (d1) => d1.binding === ormConfig.binding,
            );
            if (!bound) {
                console.error(
                    `No d1_databases binding '${ormConfig.binding}' found in wrangler.toml for orm '${databaseName}'`,
                );
                process.exit(1);
            }

            // Ledger parity. Remote `migration:run` tracks applied
            // migrations where the generated drizzle config says —
            // `__drizzle_migrations_<worker>` — while `migration:run
            // --local` delegates to `wrangler d1 migrations apply`, which
            // tracks them in this binding's `migrations_table` and reads
            // files from its `migrations_dir`. Nothing else ties the two
            // configs together, so drift here splits one migration history
            // across differently named ledgers (and wrangler's default
            // table would be shared by every worker on a `persistTo`
            // local database). Scoped to workers that own tables in the
            // database — external-only workers never apply migrations, so
            // they may omit the fields.
            if (
                ormConfig.adapterType === 'drizzle' &&
                base.configuration.getOrmConfiguration(databaseName).entities
                    .length > 0
            ) {
                const expectedTable = drizzleMigrationsTableName(
                    project.worker,
                );
                if (bound.migrations_table !== expectedTable) {
                    const found =
                        bound.migrations_table === undefined
                            ? 'declares no migrations_table, so wrangler would track local applies in its default table'
                            : `sets migrations_table = '${bound.migrations_table}', but remote migrations are tracked in '${expectedTable}'`;
                    console.error(
                        `[${project.worker}]: d1_databases binding '${ormConfig.binding}' (${environment}) ${found}. ` +
                            `Set migrations_table = '${expectedTable}' so local and remote applies share one ledger.`,
                    );
                    process.exit(1);
                }
                const expectedDir = `./database/${databaseName}/drizzle/migrations`;
                const normalizePath = (dir: string) => dir.replace(/^\.\//, '');
                if (
                    bound.migrations_dir === undefined ||
                    normalizePath(bound.migrations_dir) !==
                        normalizePath(expectedDir)
                ) {
                    console.error(
                        `[${project.worker}]: d1_databases binding '${ormConfig.binding}' (${environment}) ` +
                            (bound.migrations_dir === undefined
                                ? 'declares no migrations_dir, so wrangler would read migrations from its default folder'
                                : `sets migrations_dir = '${bound.migrations_dir}', but drizzle writes migrations to '${expectedDir}'`) +
                            `. Set migrations_dir = '${expectedDir}'.`,
                    );
                    process.exit(1);
                }
            }
        }
    }
}

/**
 * Adapts a parsed wrangler.toml environment into the platform-agnostic
 * {@link WorkerBindings} shape consumed by module-contributed
 * validators.
 */
function toWorkerBindings(
    environment: string,
    wranglerToml: WranglerToml.WranglerSettings,
): WorkerBindings {
    const env = wranglerToml.env[environment];
    return {
        r2Buckets: env?.r2_buckets?.map((b) => ({ binding: b.binding })) ?? [],
        queues:
            env?.queues?.producers?.map((p) => ({ binding: p.binding })) ?? [],
        kv: env?.kv_namespaces?.map((k) => ({ binding: k.binding })) ?? [],
        services: env?.services?.map((s) => ({ binding: s.binding })) ?? [],
        d1Databases:
            env?.d1_databases?.map((d) => ({ binding: d.binding })) ?? [],
    };
}

/**
 * Runs module-contributed {@link WorkerConfigValidator}s. Each
 * validator can throw to signal a failed check; the command exits
 * non-zero on any failure.
 */
async function runModuleConfigValidators(
    environment: string,
    workerName: string,
    base: Base,
    settingsModule: BaseSettingsModule,
    wranglerToml: WranglerToml.WranglerSettings,
    environmentVariables: EnvironmentVariables,
): Promise<void> {
    const validators = base.configuration.cli.configValidators;
    if (validators.length === 0) {
        return;
    }

    const context: WorkerConfigValidationContext = {
        environment,
        workerName,
        settings: settingsModule.settings,
        environmentVariables,
        bindings: toWorkerBindings(environment, wranglerToml),
    };

    let failed = false;
    for (const validator of validators) {
        try {
            await validator(context);
        } catch (error) {
            failed = true;
            if (error instanceof WorkerConfigValidationError) {
                console.error(error.message);
            } else {
                console.error(error);
            }
        }
    }
    if (failed) {
        process.exit(1);
    }
}

async function checkOrmConfiguration(
    project: BaseWorkerProject,
    environment: string,
    settingsModule: BaseSettingsModule,
) {
    const ormSettings = settingsModule.settings.orm;
    if (!ormSettings) {
        return;
    }

    for (const [databaseName, ormConfig] of Object.entries(ormSettings)) {
        if (!ormConfig) {
            throw new Error(
                `ORM configuration for database ${databaseName} is undefined`,
            );
        }

        // Entity-vs-generated-schema drift check. Runs for every drizzle
        // database (d1, planetscale, durable, …) — catches "edited an
        // @OrmTable but forgot to run `base orm schema:generate`". Shares
        // its comparison logic with `base orm schema:check`.
        if (ormConfig.adapterType === 'drizzle') {
            console.log(
                `[${project.worker}]: Checking schema.generated.ts is up-to-date for '${databaseName}'...`,
            );
            const result = ormCheckDrizzleSchema(
                project,
                databaseName,
                settingsModule.settings,
            );
            if (!result.upToDate) {
                if (result.reason === 'missing-file') {
                    console.error(
                        `[${project.worker}]: ❌ schema.generated.ts is missing at ${result.schemaPath}.`,
                    );
                } else {
                    console.error(
                        `[${project.worker}]: ❌ schema.generated.ts is out of sync with entities for database '${databaseName}'.`,
                    );
                    console.error(`   File: ${result.schemaPath}`);
                }
                console.error(
                    `   Run \`base orm schema:generate --worker ${project.worker} --database ${databaseName}\` to regenerate it.`,
                );
                process.exit(1);
            }
        }

        if (isOrmSettingsDurableSQLite(ormConfig)) {
            const migrations = ormConfig.migrations;
            if (migrations) {
                console.log(
                    `[${project.worker}]: Validating durable-sqlite migrations for database '${databaseName}' (${environment})...`,
                );

                // Validate migrations
                const validationResult = validateMigrations(
                    migrations.migrations,
                    environment,
                );

                // Display validation results
                displayValidationResults(
                    validationResult,
                    environment,
                    databaseName,
                );

                // Exit if validation failed
                if (!validationResult.valid) {
                    process.exit(1);
                }

                // Note: the old per-env "Development → <target>" snapshot
                // comparison lived here. After the single-dir migrations
                // refactor, both environments share one migrations tree,
                // so there's no Dev-vs-target drift to detect. Promotion
                // safety is now enforced by `release.ts` + the deploy
                // release gate (see OrmReleaseFile.ts). The
                // validateSchemaCompatibility/loadLatestSnapshot helpers
                // are kept in case we ever want to compare local
                // snapshots against actually-deployed schemas.
            }
        }
    }
}
