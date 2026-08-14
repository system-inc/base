// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { nexusJavaScriptAndTypeScriptPlugins } from '@system-inc/nexus/code-quality/eslint/NexusEsLintConfiguration.mjs';
import unusedImports from 'eslint-plugin-unused-imports';

import ContextRequiresAccessRule from './rules/ContextRequiresAccessRule.mjs';
import GqlNullableParityRule from './rules/GqlNullableParityRule.mjs';
import GqlOperationContextMatchesReturnRule from './rules/GqlOperationContextMatchesReturnRule.mjs';
import InjectTypeMatchesParameterRule from './rules/InjectTypeMatchesParameterRule.mjs';
import NoBaseProjectImportsRule from './rules/NoBaseProjectImportsRule.mjs';
import NoGlobalContainerRule from './rules/NoGlobalContainerRule.mjs';
import OrmColumnNullableParityRule from './rules/OrmColumnNullableParityRule.mjs';
import OrmColumnRequiresDeclareRule from './rules/OrmColumnRequiresDeclareRule.mjs';
import PaginationDecoratorRule from './rules/PaginationDecoratorRule.mjs';
import ProviderReturnMatchesTokenRule from './rules/ProviderReturnMatchesTokenRule.mjs';
import RelationMustBeOptionalRule from './rules/RelationMustBeOptionalRule.mjs';
import RequireSpdxHeaderRule from './rules/RequireSpdxHeaderRule.mjs';
import SerializableNullableParityRule from './rules/SerializableNullableParityRule.mjs';
import VerifyArrayParityRule from './rules/VerifyArrayParityRule.mjs';
import VerifyOptionalParityRule from './rules/VerifyOptionalParityRule.mjs';

/**
 * Default ignore patterns for any project using base. Spread into the
 * eslint flat config's `ignores` array; project-specific paths can be
 * appended in the consumer's eslint.config.mjs.
 */
export const baseIgnores = [
    'base.js',
    'jest.config.js',
    'jest.setup.ts',
    'node_modules',
    'package.json',
    'package-lock.json',
    '**/.wrangler/*',
    '**/build/*',
    '**/dist/*',
    '**/hooks/*',
    // The per-database drizzle/ tree is base-generated/managed (drizzle.config.ts,
    // schema.generated.ts, migrations + the plain-JS migrations.js, release.ts,
    // and schema:introspect output). None of it is hand-authored, and
    // schema.generated.ts must keep the raw generator formatting (schema:check
    // compares it byte-for-byte), so never lint it.
    '**/database/**/drizzle/**',
    // Generated GraphQL output (`base graphql generate`): the SDL (schema.graphql)
    // and optional --metadata JSON. Generator-owned and byte-compared by the gql
    // schema check, so don't lint/reformat it.
    '**/graphql/schemas/**',
];

/**
 * Plugins exposed by base-lint. Spread into the eslint flat config's
 * top-level `plugins` object alongside `tseslint.configs.recommended`.
 */
export const baseJavaScriptAndTypeScriptPlugins = {
    ...nexusJavaScriptAndTypeScriptPlugins,
    'unused-imports': unusedImports,
    base: {
        rules: {
            'context-requires-access': ContextRequiresAccessRule,
            'gql-nullable-parity': GqlNullableParityRule,
            'gql-operation-context-matches-return':
                GqlOperationContextMatchesReturnRule,
            'inject-type-matches-parameter': InjectTypeMatchesParameterRule,
            'no-base-project-imports': NoBaseProjectImportsRule,
            'no-global-container': NoGlobalContainerRule,
            'orm-column-nullable-parity': OrmColumnNullableParityRule,
            'orm-column-requires-declare': OrmColumnRequiresDeclareRule,
            'pagination-decorator': PaginationDecoratorRule,
            'provider-return-matches-token': ProviderReturnMatchesTokenRule,
            'relation-must-be-optional': RelationMustBeOptionalRule,
            // Registered but deliberately absent from
            // baseJavaScriptAndTypeScriptRules: the SPDX header is a policy
            // of the base repo itself, enabled in its root eslint.config.mjs.
            // Consumers opting in can enable it with their own holder/license.
            'require-spdx-header': RequireSpdxHeaderRule,
            'serializable-nullable-parity': SerializableNullableParityRule,
            'verify-array-parity': VerifyArrayParityRule,
            'verify-optional-parity': VerifyOptionalParityRule,
        },
    },
};

/**
 * Default rule set for any project using base. Toggle individual rules by
 * editing the severity here ('error' | 'warn' | 'off'); per-project
 * overrides go in the consumer's eslint.config.mjs.
 */
export const baseJavaScriptAndTypeScriptRules = {
    // ────────────────────────────────────────────────────────────────────
    // Nexus rules re-exported from @system-inc/nexus. Only the rules
    // universally useful to base consumers are enabled here; other nexus
    // rules (e.g., localization) can be enabled in a consumer's overrides.
    // ────────────────────────────────────────────────────────────────────
    'nexus/no-internal-imports-rule': 'error',

    // ────────────────────────────────────────────────────────────────────
    // Custom base rules — type/schema parity, DI safety, ORM patterns.
    // ────────────────────────────────────────────────────────────────────
    // context-requires-access is enabled here at 'error' but ships with no
    // default `requirements`, so it's a no-op until the consumer supplies
    // their context-key-to-decorator mapping in eslint.config.mjs.
    'base/context-requires-access': 'error',
    'base/gql-nullable-parity': 'error',
    'base/gql-operation-context-matches-return': 'error',
    'base/inject-type-matches-parameter': 'error',
    'base/no-base-project-imports': 'error',
    'base/no-global-container': 'error',
    'base/orm-column-nullable-parity': 'error',
    'base/orm-column-requires-declare': 'error',
    'base/pagination-decorator': 'error',
    'base/provider-return-matches-token': 'error',
    'base/relation-must-be-optional': 'error',
    'base/serializable-nullable-parity': 'error',
    'base/verify-array-parity': 'error',
    'base/verify-optional-parity': 'error',

    // ────────────────────────────────────────────────────────────────────
    // Async/await safety — silent-fail bug class. Type-aware, all from
    // the @typescript-eslint/eslint-plugin (registered by
    // tseslint.configs.recommended).
    // ────────────────────────────────────────────────────────────────────
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',

    // ────────────────────────────────────────────────────────────────────
    // Tuned defaults — overrides of off-the-shelf rules to match base
    // conventions. Edit severity or options here as needed.
    // ────────────────────────────────────────────────────────────────────
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-explicit-any': [
        'error',
        {
            ignoreRestArgs: true,
        },
    ],
    // Unused imports are stripped by `unused-imports/no-unused-imports`
    // (autofixable). The ts-eslint version is disabled so the two don't
    // double-report; `unused-imports/no-unused-vars` covers the rest.
    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
        'error',
        {
            vars: 'all',
            varsIgnorePattern: '^_.*',
            args: 'after-used',
            argsIgnorePattern: '^_.*',
            destructuredArrayIgnorePattern: '^_.*',
            caughtErrors: 'none',
        },
    ],
    'no-empty': ['error', { allowEmptyCatch: true }],
};
