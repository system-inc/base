---
title: Deploy to Cloudflare
description: Create your production D1 database, release your migrations, and ship your worker to the edge.
---

By the end of this tutorial your notes API (HTTP routes, D1 database, and GraphQL endpoint) will be live on Cloudflare's edge network.

This is the first step that needs a Cloudflare account (the free tier is fine).

## Get credentials

The `base` CLI drives Cloudflare through two environment variables:

- **`CLOUDFLARE_ACCOUNT_ID`**: on your Cloudflare dashboard's overview page.
- **`CLOUDFLARE_API_TOKEN`**: create one at _My Profile → API Tokens_ with the _Edit Cloudflare Workers_ template (add D1 edit permissions for the database steps).

Put them in your worker's `env.toml` — it's gitignored precisely so secrets like these never reach your repo:

```toml
[Production]
CLOUDFLARE_ACCOUNT_ID = "your-account-id"
CLOUDFLARE_API_TOKEN = "your-api-token"
```

The CLI loads the section matching the environment you target.

## Create the production database

Locally, wrangler simulated D1 with a placeholder id. Production needs the real thing:

```bash
npx wrangler d1 create app-db
```

Copy the `database_id` it prints into the production environment of `wrangler.toml`:

```toml
[env.Production]
name = "app"
d1_databases = [
    { binding = 'DATABASE', database_name = 'app-db', database_id = 'your-real-database-id', migrations_table = '__drizzle_migrations_app', migrations_dir = './database/@default/drizzle/migrations' },
]
```

Each environment block is a complete description of that environment — same binding name, different database.

## Release your migrations

Base gates deploys on deliberate schema changes: a migration must be **released** before a worker that depends on it can ship.

```bash
npx base orm migration:release -w app
```

This promotes your current migrations to the released list (a file in your repo — commit it). Then apply them to the production database:

```bash
npx base orm migration:run -w app -e Production
```

## Check, then deploy

Commit your work first — production deploys require a clean git tree, so what ships is exactly what's in history. Then let the CLI validate everything (settings, wrangler config, ORM bindings) before it flies:

```bash
npx base check app
npx base deploy -w app --environment Production
```

`deploy` bundles your worker with esbuild and publishes it via wrangler. The environment flag is required on deploys — there is no accidental default target.

When it finishes, your worker is live on your `workers.dev` subdomain:

```bash
curl https://app.<your-subdomain>.workers.dev/notes
```

Create a note against production, query it back over `/graphql` — everything you built in the last four tutorials is now running at the edge.

## Watch it run

Stream live logs from the deployed worker whenever you need to see what's happening:

```bash
npx base tail -w app -e Production
```

And note what the scaffold already gave you: the `.github/workflows/` directory contains CI and deploy workflows, so wiring this same deploy into GitHub Actions is configuration, not new work.

## Where to go next

You've gone from empty directory to a typed, validated, database-backed API with REST and GraphQL, deployed globally. One tutorial remains, and it's the payoff: [Call Your Worker with RPC](./06-call-your-worker-with-rpc.md) turns your API into typed method calls. Beyond that:

- **How-to guides**: focused recipes for routing, ORM relations and filters, GraphQL patterns, dependency injection, validation, access control, queues, and scheduled tasks.
- **Reference**: every class, decorator, and type, generated from the source code itself.
