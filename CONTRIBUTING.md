# Contributing to base

Thanks for your interest in contributing! `base` is a modular framework for building Cloudflare Worker–based applications. This guide covers how to get set up, the conventions we follow, and how to submit changes.

By contributing to this project, you agree that your contributions will be licensed under the [Apache License 2.0](./LICENSE), consistent with Section 5 of that license.

## Getting started

`base` is an npm **workspaces** monorepo. You'll need:

- **Node.js >= 22.12**
- npm (bundled with Node)

```bash
git clone https://github.com/system-inc/base.git
cd base
npm install
npm run build
```

## Development workflow

| Command          | What it does                                                                          |
| ---------------- | ------------------------------------------------------------------------------------- |
| `npm run build`  | Bundle the CLI with esbuild (the libraries ship source, so this is CLI-only)          |
| `npm run dev`    | Type-check in watch mode (no emit — the CLI runs from its bundled `dist/`)            |
| `npm run test`   | Run unit tests (jest)                                                                 |
| `npm run lint`   | Run ESLint                                                                            |
| `npm run format` | Format with prettier (includes import sorting)                                        |
| `npm run ci`     | Full pipeline: clean → typecheck → build → lint → format:check → test → check workers |

Before opening a pull request, make sure `npm run lint`, `npm run test`, and `npm run build` all pass. Running `npm run ci` locally mirrors what CI runs.

### Running the example workers

The [`examples/`](./examples/README.md) workspace holds runnable workers that double as integration-test fixtures:

```bash
npm run base -- develop -w test-worker   # run an example locally (wrangler dev)
npm run base -- check --all-workers      # validate settings / bindings
```

## Project layout

```
packages/
  lint/        @system-inc/base-lint        ESLint config + custom rules
  common/      @system-inc/base-common       Pure utility helpers
  client/      @system-inc/base-client       RPC + HTTP-error client
  foundation/  @system-inc/base-foundation   The core framework
  cli/         @system-inc/base-cli          The `base` CLI
examples/      Runnable example workers (also integration-test fixtures)
```

Architecture notes for each package and subsystem live in the per-folder `CLAUDE.md` files — start with the root [`CLAUDE.md`](./CLAUDE.md), then drill into the package you're touching.

## Conventions

These are enforced by lint and TypeScript, and matter for any PR:

- **No barrel files.** Every package ships per-file subpath exports — import the exact file (`import { Constructor } from '@system-inc/base-common/type/Constructor'`). Add new public code as a new file, not an entry in an `index.ts`.
- **Public / `internal/` split.** Consumer-facing types live in a feature's public folder; runtime machinery lives under `internal/`. Consumer code never imports from `internal/`.
- **Respect the dependency graph.** `common` and `lint` are leaves; `client → common`; `foundation → client + common`; `cli → foundation + client + common`. `eslint-plugin-boundaries` enforces this.
- **Naming.** Name types for the concept, not the construct — no `I` prefix, no `*Interface`/`*Type` suffix for its own sake.
- **Source in `source/`, builds to `dist/`.** Never edit `dist/`.
- **License headers on new files.** `base` is licensed under Apache-2.0. New source files should start with the SPDX header below — enforced by the `base/require-spdx-header` lint rule (`eslint --fix` inserts it); shell scripts use the `#` comment form and are stamped by hand.

    ```ts
    // Copyright 2026 System, Inc.
    // SPDX-License-Identifier: Apache-2.0
    ```

## Tests

- **Unit tests** live next to the code as `*.test.ts` and run under `npm test` (jest).
- **Integration tests** live in a worker's `test/` folder as `*.integration.test.ts` and run via `npm run base -- test -w <worker>` (or `npm run test:integration` for all workers).

Write tests that exercise real behavior and edge cases. Don't test what the type system already guarantees.

## Submitting changes

1. Fork the repo and create a branch off `main`.
2. Make your change, with tests where it makes sense.
3. Run `npm run lint`, `npm run test`, and `npm run build` (or `npm run ci`).
4. Open a pull request against `main` with a clear description of the change and its motivation.
5. CI must pass. A maintainer will review and merge.

If you're planning a large or architectural change, please open an issue to discuss it first so we can agree on the approach before you invest the time.

## Code of conduct

This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
