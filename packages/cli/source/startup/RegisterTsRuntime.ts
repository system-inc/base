// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-require-imports */

// CLI runtime registration: raw-file extensions, ts-node, and tsconfig-paths.
//
// This MUST be imported before any command module (or anything that
// transitively imports `@system-inc/base-*`). ES `import` statements hoist
// above executable code, so if this lived inline in `base-cli.ts` *after* the
// command imports, those imports would resolve `@system-inc/base-*` via the
// package `exports` map (→ `dist/*.js`) BEFORE tsconfig-paths is registered —
// while the consumer worker, loaded later through ts-node, resolves the same
// specifiers to `source/*.ts`. The result is two physical copies of foundation
// and common (and therefore two `DecoratorRegistry` singletons), which makes
// settings validation report decorated classes as "missing @<Decorator>".
// Importing this module first guarantees tsconfig-paths is live when the
// commands load, so every `@system-inc/base-*` import resolves to one copy.
//
// Kept separate from `./preload` because preload is also imported by worker
// entry points; the CLI-side TS runner must not end up in worker bundles.

// Register .sql (and any other extensions in RAW_IMPORTS) as raw-text imports.
// Used by durable-object migration files that ship .sql alongside their .ts.
// Must happen before ts-node registers, since consumer code may transitively
// require .sql files during type-checking / module loading.
{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requireExtensions = (require as any).extensions;
    const fs = require('node:fs');
    const list = (value: string | undefined) =>
        value
            ? value
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter(Boolean)
            : [];
    const rawExtensions = list(process.env.RAW_IMPORTS ?? '.sql');
    const ignoreExtensions = list(process.env.IGNORE_IMPORTS);
    const asEsModule = (source: string) =>
        `exports.__esModule = true; exports.default = ${JSON.stringify(source)};`;
    for (const ext of rawExtensions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        requireExtensions[ext] = (mod: any, filename: string) => {
            const source = fs.readFileSync(filename, 'utf8');
            mod._compile(asEsModule(source), filename);
        };
    }
    for (const ext of ignoreExtensions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        requireExtensions[ext] = (mod: any, filename: string) => {
            mod._compile(asEsModule(''), filename);
        };
    }
}

// Register an ESM loader hook for `.sql` extensions. The CJS require.extensions
// hook above only handles the CJS case; once Node 22 sees a `.js` file with
// top-level `import` statements (like drizzle-kit's migrations.js shim), it
// treats it as ESM and the CJS hook never fires. Without this, settings.ts →
// migrations.js → bare `import m0000 from './0000_xxx.sql'` would fail with
// ERR_UNKNOWN_FILE_EXTENSION.
//
// Registered as a data URL so we don't have to ship a separate .mjs alongside
// the compiled CLI. Runs in Node's loader thread.
{
    const moduleModule = require('node:module');
    const loaderSource = `
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function load(url, context, nextLoad) {
    if (url.endsWith('.sql')) {
        const filePath = fileURLToPath(url);
        const source = readFileSync(filePath, 'utf8');
        return {
            format: 'module',
            source: 'export default ' + JSON.stringify(source) + ';',
            shortCircuit: true,
        };
    }
    return nextLoad(url, context);
}
`;
    moduleModule.register(
        'data:text/javascript,' + encodeURIComponent(loaderSource),
        require('node:url').pathToFileURL(__filename),
    );
}

// Register ts-node + tsconfig-paths so the CLI can require consumers' .ts files
// at runtime (worker settings, services, etc.) and have @base/* / @system-inc/*
// path aliases resolve. ts-node is used (rather than tsx) because it uses
// TypeScript's compiler directly, which handles legacy parameter decorators
// (esbuild has limitations with them).
//
// `compilerOptions` is passed explicitly so the CLI's TS runner does not depend
// on finding a `tsconfig.json` walking up from CWD. Without this, running
// `base` from a repo that has no root `tsconfig.json` (e.g. a monorepo where
// each package owns its own) makes ts-node fall back to built-in defaults —
// currently `module: NodeNext` — which then trips TS5109 against the default
// `moduleResolution: node`. We are in `transpileOnly` mode so consumer-side
// strictness/type settings are not in play here; the CLI only needs reasonable
// *emit* settings.
//
// `moduleTypes` forces every `.ts` ts-node loads to be treated as CommonJS,
// overriding the nearest `package.json` `"type"` field. The framework packages
// (`@system-inc/base-*`) declare `"type": "module"`, and they ship source — the
// CLI resolves `@system-inc/*` to those `source/*.ts` files and loads them, plus
// the consumer's worker `settings.ts`, through this CJS `require()` path. Without
// the override, ts-node sees `"type": "module"`, classifies those `.ts` files as
// ESM, and `require()` throws ERR_REQUIRE_ESM. Forcing CJS is consistent: we
// already emit `module: commonjs` above, so the classification matches the emit.
// The glob anchors to CWD, covering the worker project and the framework source.
//
// `ignore` overrides ts-node's default (`node_modules` is never transpiled). A
// real consumer installs `@system-inc/base-*` into `node_modules` as SOURCE, so
// the CLI must transpile those `.ts` files there — without this, ts-node hands
// Node the raw `export …` and `require()` throws "Unexpected token 'export'".
// Everything else in `node_modules` (third-party packages) stays ignored. A
// workspace that vendors the framework by path alias (outside `node_modules`)
// never hits this.
//
// `tsMajor` gates the `ignoreDeprecations` option below: a consumer's
// auto-installed TypeScript can be any major (5.x, 6.x, …), and the valid
// `ignoreDeprecations` value differs between them.
const tsMajor = parseInt(
    require('typescript/package.json').version.split('.')[0],
    10,
);

// `moduleTypes` globs are resolved relative to CWD, so a bare `'**'` only
// classifies files UNDER CWD as CommonJS. The CLI loads framework source
// (`@system-inc/base-*`, which ships `"type": "module"`) that can live OUTSIDE
// CWD — e.g. the monorepo's `packages/*/source` while the CLI runs from a worker
// dir, or a consumer's `node_modules` when invoked from a subdirectory. Anchor
// the override at the filesystem root so EVERY `.ts` ts-node loads is treated as
// CJS regardless of location; otherwise `require()` of an out-of-CWD framework
// `.ts` throws ERR_REQUIRE_ESM (its package's `type: module` wins).
const nodePath = require('path');
const allTsFilesCjsGlob = nodePath.join(
    nodePath.parse(process.cwd()).root,
    '**',
    '*',
);

require('ts-node').register({
    transpileOnly: true,
    ignore: ['(?:^|/)node_modules/(?!@system-inc/base-)'],
    moduleTypes: {
        [allTsFilesCjsGlob]: 'cjs',
    },
    compilerOptions: {
        module: 'commonjs',
        moduleResolution: 'node',
        // node10 resolution is what the extensionless CommonJS `require` path
        // needs, but TS 6.x flags it as a hard deprecation error (removed in
        // 7.0). Silence it only where it applies: TS 6+ accepts this value; TS
        // 5.x rejects it and doesn't error on node10 anyway.
        ...(tsMajor >= 6 ? { ignoreDeprecations: '6.0' } : {}),
        target: 'es2021',
        esModuleInterop: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        resolveJsonModule: true,
    },
});

// tsconfig-paths' bare `register()` walks up from CWD looking for a
// tsconfig.json and warns to stderr when it can't find one. That's useful for
// projects that rely on path aliases, but noisy for every other CLI
// invocation. Probe with `loadConfig()` first and only register when we
// actually have something to wire up.
{
    const tsconfigPaths = require('tsconfig-paths');
    const config = tsconfigPaths.loadConfig(process.cwd());
    if (config.resultType === 'success') {
        tsconfigPaths.register({
            baseUrl: config.absoluteBaseUrl,
            paths: config.paths,
        });
    }
}
