// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// Bundles the CLI into a single self-contained executable at dist/base-cli.js.
//
// Only the CLI's own source is bundled; every bare-specifier dependency
// (`packages: 'external'`) — including `@system-inc/base-*` — is left as a
// runtime require. The framework packages ship source, so the CLI loads them
// through the ts-node runtime registered at startup (see startup/RegisterTsRuntime.ts),
// never as a prebuilt dist. Output is CJS because the CLI relies on
// require.extensions, Module._resolveFilename, and ts-node's require hook.
import { chmodSync } from 'node:fs';
import esbuild from 'esbuild';

await esbuild.build({
    // Two self-contained entries, both into dist/:
    //   base-cli.js      — the `base` bin
    //   node-launcher.js — spawned as its own `node` process by `develop`/run
    //                      for Node-platform workers (DevelopCommand.runNode).
    // The launcher must be a real runnable .js shipped in the package (its
    // source is .ts and `files` only includes dist/), so it's bundled here
    // rather than copied. Both inline RegisterTsRuntime so the spawned process
    // transpiles the consumer worker + framework source through ts-node.
    entryPoints: [
        { in: 'source/base-cli.ts', out: 'base-cli' },
        { in: 'source/startup/node-launcher.ts', out: 'node-launcher' },
    ],
    outdir: 'dist',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    packages: 'external',
    // `packages: 'external'` alone isn't enough for the framework packages: the
    // CLI's tsconfig maps `@system-inc/base-*` → `../<pkg>/source/*`, and esbuild
    // applies those tsconfig paths *before* the package-external check, which
    // would inline all of foundation/common/client (and produce a SECOND copy of
    // singletons like DecoratorRegistry, distinct from the one ts-node loads for
    // the worker). Marking them external by their original specifier keeps them
    // as runtime requires, resolved from source through ts-node — one instance.
    external: [
        '@system-inc/base-common/*',
        '@system-inc/base-foundation/*',
        '@system-inc/base-client/*',
    ],
    // Lower dynamic `import()` to a require()-based form. The CLI loads consumer
    // `.ts` (settings, worker entry) through ts-node's CommonJS require hook;
    // native `import()` would hit Node's ESM loader and fail on `.ts`. tsc's
    // `module: commonjs` emit did this lowering implicitly — we reproduce it.
    supported: { 'dynamic-import': false },
    // No shebang banner: esbuild preserves the `#!/usr/bin/env node` already at
    // the top of source/base-cli.ts; adding one here would duplicate it.
    sourcemap: 'inline',
    logLevel: 'info',
});

// Only base-cli.js is an executable bin; node-launcher.js is invoked via `node`.
chmodSync('dist/base-cli.js', 0o755);
