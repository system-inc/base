// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// Shared helpers for scripts that talk to GitHub Packages
// (npm.pkg.github.com). Used by publish-github.mjs and
// mirror-npmjs-to-github.mjs.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const GITHUB_PACKAGES_REGISTRY = 'https://npm.pkg.github.com';

// The scoped flag is load-bearing on every npm invocation that must hit
// GitHub Packages: the project .npmrc routes @system-inc to the local
// verdaccio, and scoped registry config beats both --registry and
// --userconfig. Only CLI config outranks it.
export const SCOPED_REGISTRY_FLAG = `--@system-inc:registry=${GITHUB_PACKAGES_REGISTRY}`;

/**
 * Token sources, in order: env var (CI), then the user-level ~/.npmrc
 * (`//npm.pkg.github.com/:_authToken=...`) — parsed directly, because
 * these scripts publish through a throwaway --userconfig AND npm refuses
 * to echo protected auth keys back (`npm config get` errors on _authToken).
 */
export function resolveGithubPackagesToken() {
    const fromEnv =
        process.env.GITHUB_PACKAGES_TOKEN ?? process.env.GITHUB_TOKEN;
    if (fromEnv) {
        return fromEnv;
    }
    try {
        const content = readFileSync(join(homedir(), '.npmrc'), 'utf8');
        const match =
            /^\s*\/\/npm\.pkg\.github\.com\/:_authToken\s*=\s*(\S+)\s*$/m.exec(
                content,
            );
        if (!match) {
            return undefined;
        }
        // Support the `${VAR}` env-reference form npm allows in npmrc.
        const envRef = /^\$\{([^}]+)\}$/.exec(match[1]);
        return envRef ? process.env[envRef[1]] : match[1];
    } catch {
        return undefined; // no ~/.npmrc — fine
    }
}

/**
 * Versions of `name` already on GitHub Packages (empty if never
 * published). `npmrc` is the throwaway userconfig carrying the token.
 */
export function githubPackagesVersions(name, npmrc) {
    try {
        const out = execFileSync(
            'npm',
            [
                'view',
                name,
                'versions',
                '--json',
                SCOPED_REGISTRY_FLAG,
                '--registry',
                GITHUB_PACKAGES_REGISTRY,
                '--userconfig',
                npmrc,
            ],
            { stdio: ['ignore', 'pipe', 'ignore'] },
        ).toString();
        const parsed = JSON.parse(out);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        return []; // never published — fine
    }
}
