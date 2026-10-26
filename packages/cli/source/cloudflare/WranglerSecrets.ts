// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { EnvironmentVariables } from '@system-inc/base-foundation/configuration/EnvironmentVariables';
import { CliEnvironmentVariables } from '../environment/CliEnvironmentVariables';

/**
 * How a worker's variables reach wrangler: plain config as `--var`
 * arguments, secrets through a private temporary file — never on the
 * command line, where they'd show in `ps` and CI logs, and never as vars,
 * which Cloudflare stores and displays in plaintext.
 */
export namespace WranglerSecrets {
    export interface SplitVariables {
        /**
         * Plain variables, passed to wrangler as `--var NAME:VALUE`.
         */
        readonly vars: Record<string, string>;

        /**
         * Secrets, uploaded through `wrangler deploy --secrets-file`.
         */
        readonly secrets: Record<string, string>;
    }

    /**
     * Splits the worker's variables into plain vars and secrets.
     * `secretNames` are the names the env.toml files set (see
     * `BaseWorkerProject.loadVariableNames`). Non-string values (TOML
     * tables and arrays such as `DATABASES`) are JSON-encoded — both vars
     * and secrets are strings to the worker — and unset values are dropped.
     *
     * Throws when a secret name is also a wrangler.toml var: wrangler
     * deploys its config vars itself, and a worker can't hold a var and a
     * secret of the same name.
     */
    export function split(
        variables: EnvironmentVariables,
        secretNames: ReadonlySet<string>,
        wranglerVarNames: ReadonlySet<string>,
    ): SplitVariables {
        const conflicts = [...secretNames].filter((name) =>
            wranglerVarNames.has(name),
        );
        if (conflicts.length > 0) {
            throw new Error(
                `${conflicts.join(', ')} ${conflicts.length === 1 ? 'is' : 'are'} set in both ` +
                    'wrangler.toml [vars] and env.toml. env.toml values deploy as ' +
                    "secrets, and a worker can't have a var and a secret with the same " +
                    'name — keep plain config in wrangler.toml and secrets in env.toml.',
            );
        }

        const vars: Record<string, string> = {};
        const secrets: Record<string, string> = {};
        const stringified =
            CliEnvironmentVariables.stringifyComplexVariables(variables);
        for (const [name, value] of Object.entries(stringified)) {
            if (value === undefined) {
                continue;
            }
            const target = secretNames.has(name) ? secrets : vars;
            target[name] = String(value);
        }
        return { vars, secrets };
    }

    /**
     * The `--var` arguments for plain variables, in wrangler's
     * `NAME:VALUE` form.
     */
    export function toVarArguments(vars: Record<string, string>): string[] {
        return Object.entries(vars).map(([name, value]) => `${name}:${value}`);
    }

    /**
     * Writes `secrets` to a temporary JSON file only the current user can
     * read, runs `use` with its path (or `undefined` when there are no
     * secrets), and deletes the file however `use` ends.
     */
    export async function withSecretsFile<T>(
        secrets: Record<string, string>,
        use: (secretsFile: string | undefined) => Promise<T>,
    ): Promise<T> {
        if (Object.keys(secrets).length === 0) {
            return use(undefined);
        }
        // mkdtemp creates the directory 0700, so the file is private even
        // before its own mode applies
        const directory = fs.mkdtempSync(
            path.join(os.tmpdir(), 'base-secrets-'),
        );
        try {
            const secretsFile = path.join(directory, 'secrets.json');
            fs.writeFileSync(secretsFile, JSON.stringify(secrets), {
                mode: 0o600,
            });
            return await use(secretsFile);
        } finally {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    }
}
