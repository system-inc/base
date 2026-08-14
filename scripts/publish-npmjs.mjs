// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// Rebuilds the tarballs (npm run dist) and publishes all 5 public packages
// to the public npm registry (registry.npmjs.org) — the registry consumers
// install from. Run this BEFORE mirroring to GitHub Packages
// (`npm run publish:github`) so both registries carry the IDENTICAL
// tarballs and consumers' package-lock integrity hashes stay valid
// against either.
//
// Auth: your normal npm login (`npm login`), or export NPM_TOKEN (an
// automation token with publish rights on the @system-inc scope) — the
// token is written to a temporary userconfig for the run and removed
// after.
//
// npmjs never allows overwriting an existing version: an
// already-published version is skipped with a warning. Bump the package
// version to ship new bits.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NPMJS_REGISTRY = 'https://registry.npmjs.org';
const root = dirname(dirname(fileURLToPath(import.meta.url))); // scripts/ -> repo root
const distDir = join(root, 'dist');
const PUBLISHABLE = ['common', 'client', 'foundation', 'cli', 'lint'];

// The scoped flag prevents any .npmrc scope routing (e.g. the verdaccio
// dev flow) from silently rerouting the publish.
const SCOPED_REGISTRY_FLAG = `--@system-inc:registry=${NPMJS_REGISTRY}`;

const token = process.env.NPM_TOKEN;
const npmrc = token ? join(root, '.npmrc.npmjs') : undefined;
if (npmrc) {
    writeFileSync(
        npmrc,
        `registry=${NPMJS_REGISTRY}\n//registry.npmjs.org/:_authToken=${token}\n`,
    );
}
const userconfigArgs = npmrc ? ['--userconfig', npmrc] : [];

const run = (args, opts = {}) =>
    execFileSync('npm', args, { cwd: root, stdio: 'inherit', ...opts });

/**
 * Published versions of `name` on npmjs, [] when the package has never
 * been published (npm view exits non-zero on 404).
 */
function npmjsVersions(name) {
    try {
        const out = execFileSync(
            'npm',
            [
                'view',
                name,
                'versions',
                '--json',
                SCOPED_REGISTRY_FLAG,
                ...userconfigArgs,
                '--registry',
                NPMJS_REGISTRY,
            ],
            { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] },
        ).toString();
        const parsed = JSON.parse(out);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        return [];
    }
}

try {
    run(['run', 'dist']);

    let published = 0;
    let skipped = 0;
    for (const p of PUBLISHABLE) {
        const pkg = JSON.parse(
            readFileSync(join(root, 'packages', p, 'package.json'), 'utf8'),
        );
        const tarballName =
            pkg.name.replace('@', '').replace('/', '-') + `-${pkg.version}.tgz`;
        const tarball = join(distDir, tarballName);

        if (npmjsVersions(pkg.name).includes(pkg.version)) {
            console.warn(
                `⚠ ${pkg.name}@${pkg.version} already exists on npmjs — skipped. ` +
                    `Bump the version to publish new bits.`,
            );
            skipped++;
            continue;
        }

        console.log(
            `\n▸ publishing ${pkg.name}@${pkg.version} -> ${NPMJS_REGISTRY}`,
        );
        run([
            'publish',
            tarball,
            // First publish of a scoped package defaults to private;
            // explicit --access public makes the intent unambiguous even
            // though each package.json also carries publishConfig.access.
            '--access',
            'public',
            SCOPED_REGISTRY_FLAG,
            ...userconfigArgs,
            '--registry',
            NPMJS_REGISTRY,
        ]);
        published++;
    }

    console.log(
        `\n✓ npmjs: ${published} published, ${skipped} skipped (already present).`,
    );
} finally {
    if (npmrc) {
        rmSync(npmrc, { force: true });
    }
}
