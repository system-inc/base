# `@system-inc/base-cli`

The `base` command-line tool for the [Base](../../README.md) framework: scaffold, build, run, test, and deploy Cloudflare Workers, manage Drizzle migrations, and generate GraphQL schemas. Ships the `base` binary.

Requires Node.js >= 22.12.

## Create a workspace

```bash
npx @system-inc/base-cli workspace create my-app
cd my-app
npm run base -- develop -w app
```

This scaffolds an npm-workspaces monorepo with a starter worker under `workers/`, wired for local development with no Cloudflare account needed.

## Commands

Inside a workspace, run commands through the installed bin (`npm run base -- <command>` or `npx base <command>`):

| Command            | Purpose                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `develop [worker]` | Local dev server (`wrangler dev`)                                   |
| `deploy [worker]`  | Publish to Cloudflare (`--all-workers`, dependency-ordered; gated)  |
| `check [worker]`   | Validate `settings.ts`, `wrangler.toml`, ORM bindings, schema drift |
| `test [worker]`    | Run integration tests against a live worker                         |
| `bundle [worker]`  | Compile + bundle with esbuild                                       |
| `tail [worker]`    | Stream worker logs                                                  |
| `orm <cmd>`        | Schema generation, migrations, local DB reset, Drizzle Studio       |
| `graphql <cmd>`    | Generate/check SDL from decorators                                  |
| `workspace <cmd>`  | Scaffold workspaces/workers, manage shared secrets                  |

Full flags and the remaining commands (`info`, `keygen`, `container`): see the [CLI command reference](../../documentation/guides/cli/03-command-reference.md).

## Working on the CLI in this repo

`npx base` runs the **bundled** `dist/base-cli.js`, not the TypeScript source — after editing `packages/cli/source/...`, run `npm run build` (an esbuild bundle; the framework libraries ship source and need no build) before `npx base` picks up the change. `npm run dev` is type-checking only and emits nothing.
