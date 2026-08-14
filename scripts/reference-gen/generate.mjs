// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// reference-gen · generates the API reference model for the Base documentation site.
//
// Pipeline: EXTRACT (TypeDoc over foundation source) -> TRANSFORM (our schema) ->
// writes `artifacts/reference-model.json` + `artifacts/coverage-report.md`.
//
// base has no barrel/index (per-file subpath exports: `"./*": "./source/*.ts"`),
// so we use TypeDoc's `expand` entry-point strategy over the whole `source/` tree and
// let `exclude` drop `internal/` + tests from what gets documented (they stay in the
// TS program for type resolution).
//
// This is the auto-generation half of the docs system. It is pure — no CMS, no auth.
// The generated model is consumed by the documentation site's sync tooling. Run on
// release; the reference is version-locked to the tag it is generated from.
//
// Usage:  npm run reference:generate
//         npm run reference:generate -- --transform-only   (skip the slow
//         TypeDoc extract and re-run transform on the existing artifact)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Application } from 'typedoc';

import { transform } from './transform.mjs';

const here = dirname(fileURLToPath(import.meta.url)); // scripts/reference-gen
const repoRoot = resolve(here, '../..'); // repo root
const foundationSource = resolve(repoRoot, 'packages/foundation/source');

const tsconfig = resolve(here, 'tsconfig.typedoc.json');
const artifactsDir = resolve(here, 'artifacts');
const rawJsonFile = resolve(artifactsDir, 'typedoc.foundation.json');
const modelFile = resolve(artifactsDir, 'reference-model.json');
const coverageFile = resolve(artifactsDir, 'coverage-report.md');

// TypeDoc options shared by extract. base won't typecheck cleanly out of its
// worker/build context (peer deps, worker types); we only need declarations +
// comments, so skip the error gate.
const typeDocOptions = {
    entryPoints: [foundationSource],
    entryPointStrategy: 'expand',
    tsconfig,
    // Keep internal/ + tests in the TS program (for resolution) but out of the docs.
    exclude: ['**/*.test.ts', '**/internal/**', '**/*.d.ts', '**/CLAUDE.md'],
    excludeExternals: true, // don't document node_modules symbols
    excludePrivate: false,
    excludeInternal: false, // don't drop @internal yet — measure coverage first
    skipErrorChecking: true,
    readme: 'none',
    disableSources: false, // keep source positions for GitHub permalinks
    logLevel: 'Info',
};

/** Eyeball capture quality without opening the JSON. */
function summarize(serialized) {
    /** @type {Record<string, number>} */
    const counts = {};
    let withComment = 0;
    let withExample = 0;

    /** @param {any} node */
    const walk = (node) => {
        if (!node || typeof node !== 'object') return;
        if (typeof node.kind === 'number' && node.name) {
            const kind = node.kindString ?? String(node.kind);
            counts[kind] = (counts[kind] ?? 0) + 1;
            if (node.comment?.summary?.length) withComment++;
            if (node.comment?.blockTags?.some((t) => t.tag === '@example'))
                withExample++;
        }
        for (const child of node.children ?? []) walk(child);
    };
    walk(serialized);

    console.log('  reflections by kind:', counts);
    console.log(
        '  with summary comment:',
        withComment,
        '· with @example:',
        withExample,
    );
}

async function main() {
    if (!process.argv.includes('--transform-only')) {
        const app = await Application.bootstrapWithPlugins(typeDocOptions);

        const project = await app.convert();
        if (!project) {
            console.error(
                '✗ TypeDoc conversion produced no project. See diagnostics above.',
            );
            process.exitCode = 1;
            return;
        }

        await app.generateJson(project, rawJsonFile);
        console.log('\n✓ Extract complete →', rawJsonFile);
    }

    const serialized = JSON.parse(readFileSync(rawJsonFile, 'utf8'));
    summarize(serialized);

    const { model, report } = transform(serialized, {
        packageName: serialized.packageName ?? '@system-inc/base-foundation',
    });
    writeFileSync(modelFile, JSON.stringify(model, null, 4) + '\n');
    writeFileSync(coverageFile, report.trimEnd() + '\n');

    console.log('\n✓ Transform complete →', modelFile);
    console.log('  symbols:', model.symbols.length, '· by kind:', model.counts);
    console.log('✓ Coverage report →', coverageFile);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
