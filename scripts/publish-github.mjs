// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// Rebuilds the tarballs (npm run dist) and publishes all 5 public packages
// to GitHub Packages (npm.pkg.github.com) so CI consumers — GitHub Actions
// deploys that can't reach the local verdaccio — can `npm ci` them.
//
// Publishing the IDENTICAL tarballs that publish-local.mjs pushes to
// verdaccio keeps consumers' package-lock integrity hashes valid against
// either registry.
//
// Auth: export GITHUB_PACKAGES_TOKEN (classic PAT with write:packages —
// plus repo scope for any private repos it touches), or GITHUB_TOKEN when
// running inside GitHub Actions with `permissions: packages: write`, or a
// `//npm.pkg.github.com/:_authToken=...` line in ~/.npmrc.
//
// Unlike verdaccio, GitHub Packages NEVER allows overwriting an existing
// version: an already-published version is skipped with a warning. Bump
// the package version to ship new bits.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    GITHUB_PACKAGES_REGISTRY,
    githubPackagesVersions,
    resolveGithubPackagesToken,
    SCOPED_REGISTRY_FLAG,
} from './github-packages.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url))); // scripts/ -> repo root
const distDir = join(root, 'dist');
const PUBLISHABLE = ['common', 'client', 'foundation', 'cli', 'lint'];

const token = resolveGithubPackagesToken();
if (!token) {
    console.error(
        'No GitHub Packages token found. Either set GITHUB_PACKAGES_TOKEN ' +
            '(classic PAT with write:packages), or add to ~/.npmrc:\n' +
            '  //npm.pkg.github.com/:_authToken=<token>',
    );
    process.exit(1);
}

const npmrc = join(root, '.npmrc.github');
writeFileSync(
    npmrc,
    `registry=${GITHUB_PACKAGES_REGISTRY}\n//npm.pkg.github.com/:_authToken=${token}\n`,
);

const run = (args, opts = {}) =>
    execFileSync('npm', args, { cwd: root, stdio: 'inherit', ...opts });

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

        if (githubPackagesVersions(pkg.name, npmrc).includes(pkg.version)) {
            console.warn(
                `⚠ ${pkg.name}@${pkg.version} already exists on GitHub Packages — skipped. ` +
                    `Bump the version to publish new bits.`,
            );
            skipped++;
            continue;
        }

        console.log(
            `\n▸ publishing ${pkg.name}@${pkg.version} -> ${GITHUB_PACKAGES_REGISTRY}`,
        );
        run([
            'publish',
            tarball,
            // The scoped flag prevents the project .npmrc (which routes
            // @system-inc to verdaccio) from silently rerouting the publish.
            SCOPED_REGISTRY_FLAG,
            '--userconfig',
            npmrc,
            '--registry',
            GITHUB_PACKAGES_REGISTRY,
        ]);
        published++;
    }

    console.log(
        `\n✓ GitHub Packages: ${published} published, ${skipped} skipped (already present).`,
    );
} finally {
    rmSync(npmrc, { force: true });
}
