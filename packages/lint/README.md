# `@system-inc/base-lint`

Shared ESLint configuration and custom rules for [Base](../../README.md) and projects built on it. Bundles the community plugins the stack standardizes on and adds **type-aware** rules that enforce contracts TypeScript can't catch alone — keeping decorator metadata in sync with TypeScript types (GraphQL/ORM nullability, DI inject types, validation optionality) and guarding architectural boundaries.

Pure ESM — the `.mjs` files are the published artifact (no build step).

```bash
npm install -D @system-inc/base-lint
```

Peers: `eslint`, `typescript`, `typescript-eslint`, `@typescript-eslint/utils`, `@system-inc/nexus`.

## Usage

In your flat config (`eslint.config.mjs`), spread the three exports:

```js
import tseslint from 'typescript-eslint';

import {
    baseIgnores,
    baseJavaScriptAndTypeScriptPlugins,
    baseJavaScriptAndTypeScriptRules,
} from '@system-inc/base-lint/BaseRules.mjs';

export default tseslint.config({
    ignores: baseIgnores,
    plugins: baseJavaScriptAndTypeScriptPlugins,
    rules: baseJavaScriptAndTypeScriptRules,
    // ...your languageOptions / project service config
});
```

Consumers may override rule severities or pass rule options (e.g. the protected context keys for `context-requires-access`).

See [`CLAUDE.md`](./CLAUDE.md) for the full list of custom rules and what each enforces.

---

Part of the [Base](../../README.md) monorepo.
