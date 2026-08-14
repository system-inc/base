// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// Produces the publishable artifacts: emits library declarations, bundles the
// CLI, then packs every public package into ./dist as npm tarballs — the exact
// bytes a registry would serve.
//
// The libraries (common/client/foundation) ship SOURCE at runtime (the `default`
// export condition → source/*.ts, so bundlers and the CLI's ts-node runtime are
// unchanged). Each also emits .d.ts into its dist/ for the `types` condition, so
// consumers typecheck against our declarations instead of our source. They build
// in dependency order (common → client → foundation) because each resolves its
// already-built siblings' dist/*.d.ts through node_modules. lint is pure ESM (no
// build) and the CLI is an esbuild bundle. `npm pack` honors each package's
// `files`, so tests and in-source docs are excluded.
//
// NOTE: this does not run the typecheck/lint/test suite — run `npm run ci`
// first if you want a verified build. And the packed tarballs still carry the
// `*` inter-package versions; switch those to lockstep versions before a real
// publish (otherwise installing one tarball standalone hits the registry).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const distDir = join(root, 'dist');

const PUBLISHABLE = [
    '@system-inc/base-common',
    '@system-inc/base-client',
    '@system-inc/base-foundation',
    '@system-inc/base-cli',
    '@system-inc/base-lint',
];

const run = (args) =>
    execFileSync('npm', args, { cwd: root, stdio: 'inherit' });

// 1. fresh dist/
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

// 2. pack every publishable package into dist/. Each package's `prepack` hook
//    compiles it (libs: tsc → dist; CLI: esbuild bundle) right before packing,
//    so iterating in dependency order means every package builds against its
//    already-built upstream siblings. lint has no build step.
console.log('\n▸ Building + packing packages...');
for (const name of PUBLISHABLE) {
    run(['pack', '--workspace', name, '--pack-destination', distDir]);
}

// 4. report
const tarballs = readdirSync(distDir).filter((f) => f.endsWith('.tgz'));
console.log(`\n✓ ${tarballs.length} tarballs in dist/:`);
for (const t of tarballs.sort()) {
    const kb = Math.round(statSync(join(distDir, t)).size / 1024);
    console.log(`  - ${t}  (${kb} kb)`);
}
