// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import eslint from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import {
    baseIgnores,
    baseJavaScriptAndTypeScriptPlugins,
    baseJavaScriptAndTypeScriptRules,
} from '@system-inc/base-lint/BaseRules.mjs';

/**
 * Root ESLint config for the base monorepo. Each workspace package is
 * linted with the same ruleset; per-package overrides can be added below.
 *
 * Rule definitions and severities live in @system-inc/base-lint (which
 * also re-exports @system-inc/nexus rules). Tweaks go in the override
 * block — last spread wins.
 */
export default tseslint.config([
    {
        ignores: [
            // baseIgnores minus the repo's own jest config files: consumers
            // rightly skip theirs, but ours are first-party source that must
            // carry the SPDX header, so they stay lintable (untyped, below).
            ...baseIgnores.filter(
                (pattern) =>
                    pattern !== 'jest.config.js' && pattern !== 'jest.setup.ts',
            ),
            // Monorepo-specific ignores.
            '**/packages/*/package.json',
            // Harness-managed git worktrees — full checkout copies whose
            // files would otherwise be linted with paths that match none of
            // the scoped blocks below (e.g. their scripts/ escapes the
            // untyped-tooling block and reports no-undef on `console`).
            '.claude/**',
            // (The generated per-database drizzle/ tree is ignored via
            // baseIgnores in @system-inc/base-lint.)
            // CLI scaffolding templates are copied as-is into consumer
            // projects; they aren't TypeScript that this repo compiles.
            'packages/cli/templates/**',
            // Composite-project emit dir for examples — tsc -b writes
            // .d.ts files here so examples can participate in
            // project references. Not authored, not part of any
            // lint-eligible tsconfig.
            'examples/.tsbuild/**',
        ],
    },
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        plugins: {
            ...baseJavaScriptAndTypeScriptPlugins,
        },
    },
    {
        // The typed ruleset runs only where the project service can parse —
        // the workspace packages and examples, which belong to tsconfigs.
        // build.mjs is repo tooling outside every tsconfig (handled by the
        // untyped block below); the type-aware rules call getParserServices
        // eagerly and would crash on it.
        files: ['packages/**', 'examples/**'],
        ignores: ['packages/cli/build.mjs'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            ...baseJavaScriptAndTypeScriptRules,
            // base-lint includes base/no-base-project-imports, which targets
            // files inside libraries/base/ in consumer projects. Inside the
            // base monorepo itself this rule has nothing to enforce, so
            // disable it to avoid noise.
            'base/no-base-project-imports': 'off',
        },
    },
    {
        // The DI subsystem itself owns the @global container: this is where
        // the container hierarchy is built and where @Injectable/@Provider
        // register their classes and tokens into @global (and where the DI
        // internals are tested). The no-global-container rule exists to stop
        // consumer (and other framework) code from reaching past proper
        // injection, so exempt only the dependency-injection folders.
        files: [
            'packages/foundation/source/dependency-injection/**',
            'packages/foundation/source/internal/dependency-injection/**',
        ],
        rules: {
            'base/no-global-container': 'off',
        },
    },
    {
        // The SPDX header is a repo licensing policy for ALL first-party
        // source, enabled here rather than in base-lint's shared severities
        // so consumer projects never inherit a System, Inc. header
        // requirement. `eslint --fix` inserts the header.
        files: [
            '**/*.ts',
            '**/*.mts',
            '**/*.tsx',
            '**/*.js',
            '**/*.mjs',
            '**/*.cjs',
        ],
        rules: {
            'base/require-spdx-header': 'error',
        },
    },
    {
        // Logging policy: framework code logs through the level-gated Logger
        // (common/logging/Logger), never raw console.* — an ungated console
        // call on the hot path is a measured perf hit and can't be silenced
        // by LOG_LEVEL. Logger.ts itself is the sink (its console calls ARE
        // the output channel). Tests may use console freely, and the CLI is
        // exempt entirely: its console output is the product's terminal UX,
        // not diagnostics.
        files: [
            'packages/common/source/**/*.{ts,mts,tsx}',
            'packages/client/source/**/*.{ts,mts,tsx}',
            'packages/foundation/source/**/*.{ts,mts,tsx}',
        ],
        ignores: ['**/*.test.ts', 'packages/common/source/logging/Logger.ts'],
        rules: {
            'no-console': 'error',
        },
    },
    {
        // Repo tooling (publish/build scripts, jest config, this file) sits
        // outside every tsconfig, so the typed project service can't parse
        // it. It used to be ignored entirely — which is exactly how SPDX
        // headers silently drifted there. Lint it untyped instead: core
        // recommended rules + the header policy above still apply.
        files: [
            'scripts/**/*.{js,mjs,cjs,ts}',
            'dist.mjs',
            'packages/cli/build.mjs',
            'eslint.config.mjs',
            'jest.config.js',
            'jest.globalSetup.js',
            'jest.setup.ts',
        ],
        extends: [tseslint.configs.disableTypeChecked],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            // These are Node scripts: CommonJS require() is legitimate in
            // the .cjs ones.
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
    {
        files: ['packages/**/*.{ts,mts,tsx}'],
        plugins: { boundaries },
        settings: {
            'boundaries/elements': [
                { type: 'common', pattern: 'packages/common/**' },
                { type: 'lint', pattern: 'packages/lint/**' },
                { type: 'client', pattern: 'packages/client/**' },
                { type: 'foundation', pattern: 'packages/foundation/**' },
                { type: 'cli', pattern: 'packages/cli/**' },
            ],
            'import/resolver': {
                typescript: {
                    project: './tsconfig.json',
                },
            },
        },
        rules: {
            'boundaries/dependencies': [
                'error',
                {
                    default: 'disallow',
                    rules: [
                        {
                            from: { type: 'cli' },
                            allow: [
                                { to: { type: 'client' } },
                                { to: { type: 'common' } },
                                { to: { type: 'foundation' } },
                            ],
                        },
                        {
                            from: { type: 'foundation' },
                            allow: [
                                { to: { type: 'common' } },
                                { to: { type: 'client' } },
                            ],
                        },
                        {
                            from: { type: 'client' },
                            allow: [{ to: { type: 'common' } }],
                        },
                        { from: { type: 'common' }, allow: [] },
                        { from: { type: 'lint' }, allow: [] },
                    ],
                },
            ],
        },
    },
    {
        // CLI membership boundary: whether a worker HAS resolvers, queue
        // processors, scheduled executables, etc. is answered by the manifest
        // (base.configuration.<feature>), never by the decoration-time
        // BaseMetadata registries. A class lands in BaseMetadata the moment
        // its file is imported — before module registration and before
        // per-registration opt-outs (`queue: false`, `graphql: false`, …)
        // apply — so metadata answers "what was imported", not "what will
        // dispatch". Only the framework's dispatchers may read it, and only
        // for attribution (type → class), intersected with the manifest list.
        files: ['packages/cli/source/**'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: '@system-inc/base-foundation/base/BaseMetadata',
                            message:
                                'Decoration-time metadata includes classes that were imported but never registered (or opted out via BaseModuleOptions). Read the manifest-backed view instead: base.configuration.<feature>.',
                        },
                    ],
                },
            ],
        },
    },
    {
        // CLI test boundary: the base CLI is tested by spawning the built bin as
        // a subprocess (packages/cli/integration/*.cli-integration.test.ts), never
        // by running its runtime in Jest's VM — the VM doesn't replicate ts-node,
        // cwd-sensitive resolution, or the bundled layout, so in-VM CLI runs give
        // false results. Unit tests (source/**/*.test.ts) cover pure logic only;
        // they must not import the ts-node bootstrap, which can't run in the VM.
        // (This block replaces the membership-boundary restriction above for
        // test files — flat-config rule entries override, not merge.)
        files: ['packages/cli/source/**/*.test.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['**/startup/*', '**/startup/**'],
                            message:
                                'CLI unit tests must not import the ts-node bootstrap (startup/*). Exercise CLI runtime behavior via a subprocess in packages/cli/integration/*.cli-integration.test.ts instead.',
                        },
                    ],
                },
            ],
        },
    },
]);
