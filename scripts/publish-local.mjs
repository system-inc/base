// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// Rebuilds the tarballs (npm run dist) and (re)publishes all 5 public packages
// to the local verdaccio registry at http://localhost:4873.
//
// Start verdaccio first:  npx verdaccio --config verdaccio.config.yaml
//
// Each package is unpublished-then-published so you can republish the SAME
// version every iteration (verdaccio rejects overwriting an existing version).
// A throwaway userconfig carries a placeholder auth token — verdaccio accepts
// it because publish access is $all; npm just refuses to publish with no token.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url))); // scripts/ -> repo root
const REGISTRY = 'http://localhost:4873';
const distDir = join(root, 'dist');
const PUBLISHABLE = ['common', 'client', 'foundation', 'cli', 'lint'];

const npmrc = join(root, '.npmrc.verdaccio');
writeFileSync(
    npmrc,
    `registry=${REGISTRY}\n//localhost:4873/:_authToken=local-test-token\n`,
);

const run = (args, opts = {}) =>
    execFileSync('npm', args, { cwd: root, stdio: 'inherit', ...opts });

try {
    run(['run', 'dist']);

    for (const p of PUBLISHABLE) {
        const pkg = JSON.parse(
            readFileSync(join(root, 'packages', p, 'package.json'), 'utf8'),
        );
        const tarballName =
            pkg.name.replace('@', '').replace('/', '-') + `-${pkg.version}.tgz`;
        const tarball = join(distDir, tarballName);

        // Clear any prior copy so the same version can be re-published.
        try {
            execFileSync(
                'npm',
                [
                    'unpublish',
                    pkg.name,
                    '--force',
                    '--registry',
                    REGISTRY,
                    '--userconfig',
                    npmrc,
                ],
                { cwd: root, stdio: 'ignore' },
            );
        } catch {
            // not present yet — fine
        }

        console.log(`\n▸ publishing ${pkg.name}@${pkg.version} -> ${REGISTRY}`);
        run([
            'publish',
            tarball,
            '--userconfig',
            npmrc,
            '--registry',
            REGISTRY,
        ]);
    }

    console.log(`\n✓ Published ${PUBLISHABLE.length} packages to ${REGISTRY}`);
} finally {
    rmSync(npmrc, { force: true });
}
