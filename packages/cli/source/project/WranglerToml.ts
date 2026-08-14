// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as smolToml from 'smol-toml';

import { EnvironmentVariables } from '@system-inc/base-foundation/configuration/EnvironmentVariables';
import { BaseWorkerProject } from './BaseWorkerProject';

/**
 * Namespace for parsing wrangler.toml files.
 */
export namespace WranglerToml {
    export interface WranglerSettings {
        main: string;
        compatibility_date: string;
        env: Record<string, EnvironmentSpecific>;
    }

    export interface EnvironmentSpecific {
        name: string;
        vars: EnvironmentVariables;
        r2_buckets?: R2Bucket[];
        d1_databases?: D1Database[];
        queues?: {
            producers?: QueueProducer[];
            consumers?: QueueConsumer[];
        };
        kv_namespaces?: KVNamespace[];
        services?: ServiceBinding[];
        durable_objects?: {
            bindings: DurableObjectBinding[];
        };
        containers?: Container[];
    }

    export interface R2Bucket {
        bucket_name: string;
        preview_bucket_name: string;
        binding: string;
    }

    export interface D1Database {
        database_name: string;
        binding: string;
        database_id: string;
        // wrangler's migration tracking for `d1 migrations apply` — must
        // agree with the drizzle-kit config's per-worker migrations table
        // (enforced by `base check`), or local and remote applies track
        // the same history in differently named ledgers.
        migrations_table?: string;
        migrations_dir?: string;
    }

    export interface QueueProducer {
        queue: string;
        binding: string;
    }

    export interface QueueConsumer {
        // the queue this worker consumes; matches a @WorkerQueueProcessor type
        queue: string;
    }

    export interface KVNamespace {
        id: string;
        binding: string;
    }

    export interface ServiceBinding {
        service: string;
        binding: string;
    }

    export interface DurableObjectBinding {
        name: string;
        class_name: string;
        script_name?: string;
    }

    export interface Container {
        image: string;
        class_name: string;
        max_instances?: number;
        instance_type?: string;
        image_vars?: Record<string, string>;
    }

    /**
     * Resolves the D1 database entry bound under `binding` in the given
     * environment of the worker's wrangler.toml. Throws when the
     * environment declares no D1 databases or the binding is absent —
     * shared by every command that needs a binding's `database_id` /
     * `database_name` (credentials resolution, local migrations, studio).
     */
    export function findD1Database(
        project: BaseWorkerProject,
        environment: string,
        binding: string,
    ): D1Database {
        const wranglerEnv = parse(project).env[environment];
        if (!wranglerEnv || !wranglerEnv.d1_databases) {
            throw new Error(
                `No D1 databases found in wrangler.toml for environment ${environment}`,
            );
        }
        const d1Database = wranglerEnv.d1_databases.find(
            (db) => db.binding === binding,
        );
        if (!d1Database) {
            throw new Error(
                `D1 database with binding ${binding} not found in wrangler.toml for environment ${environment}`,
            );
        }
        return d1Database;
    }

    export function parse(project: BaseWorkerProject): WranglerSettings {
        try {
            const wranglerContent = fs.readFileSync(
                project.wranglerConfigFile,
                'utf8',
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return smolToml.parse(wranglerContent) as any;
        } catch (error) {
            console.error(
                'Unable to parse wrangler.toml at:',
                project.wranglerConfigFile,
                'Error:',
                error,
            );
            process.exit(1);
        }
    }
}
