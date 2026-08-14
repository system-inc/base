---
title: Test Modules
description: Run a module's integration suite inside a host worker with moduleTest.
---

Modules don't run standalone, so they aren't tested standalone either: you point a **host worker** at them. The worker registers the modules, opts into their test suites with `moduleTest`, and `base test` folds the modules' own integration tests into the run.

## The host worker

```ts
// workers/module-test/settings.ts
export const Settings: BaseSettings = {
    name: 'module-test',
    version: '1.0.0',
    title: 'Module Test',
    moduleTest: true,
    server: {
        '@default': { port: 3001 },
        Integration: { host: 'https://module-test.example.workers.dev' },
    },
    modules: [
        Account({ cookieDomain: { '@default': 'example.com' } }),
        EmailSending({ ... }),
        RateLimiter({ ... }),
    ],
    ...
};
```

- **`moduleTest: true`**: run the integration tests of **every** registered module.
- **`moduleTest: ['Account', 'RateLimiter']`**: only the listed modules.
- Omitted (the default): module tests don't run; only the worker's own `test/` suite does.

Then, with the host worker running (`base develop`) or deployed:

```bash
npx base test -w module-test
```

## Where module tests live

A module's integration tests live in the **module's own source tree**, anywhere under its directory, named `*.integration.test.ts` (a `test/` subfolder is the convention, not a requirement). They're ordinary integration tests — written against `IntegrationTestEnvironment` exactly like [worker tests](./02-integration-tests.md), so they exercise the module through the host worker's real HTTP surface.

Discovery works from the host worker's `settings.ts`: `base test` finds each module's import, resolves it through your tsconfig paths, and scans the module's directory for test files.

## Two gotchas

- **The module key name must match the imported identifier.** Discovery maps the module's name (from its `BaseModuleKey`) to an `import { Name } from ...` statement in `settings.ts`. If the factory is imported under a different name, discovery warns (`Could not find import for module '<name>'`) and skips it — watch the output the first time you wire this up.
- **Modules installed from a published package won't contribute tests**: published packages exclude test files by design. Module testing is for modules whose source lives in your workspace (or monorepo).

The dedicated host-worker pattern scales well: one `module-test` worker per repo that registers every module with realistic settings, gets deployed to a test environment, and runs the full module suite in CI.
