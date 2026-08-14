---
title: Installation
description: Scaffold a Base workspace, start the development server, and see your worker respond.
---

By the end of this tutorial you'll have a working Base project on your machine, a development server running, and a worker answering requests at `http://localhost:3000`.

Base is a modular framework for building Cloudflare Worker–based applications. You define services, resolvers, and entities with decorators; the framework wires them together through dependency injection and dispatches platform events (HTTP requests, queue messages, cron triggers) to your code.

## Prerequisites

- **Node.js 22.12 or newer.** Check with `node --version`. If you use nvm, `nvm install 22`.
- **git (optional, recommended).** With git initialized, the scaffold wires up a pre-commit formatting hook, and deploys ship exactly what's committed.
- **No Cloudflare account needed.** Local development runs entirely on your machine; you only need an account when you [deploy](./05-deploy-to-cloudflare.md).

## Create a workspace

One command scaffolds a complete workspace with a starter worker and installs its dependencies:

```bash
npx @system-inc/base-cli workspace create my-app
```

Then finish the setup it prints. If you're using git (recommended):

```bash
cd my-app
git init && npm run prepare   # wires up the pre-commit format hook
```

## What you got

A Base **workspace** holds one or more **workers**. A worker is simply a directory with a `settings.ts` — the single source of truth shared by the CLI and the runtime. The scaffold gives you one worker named `app`:

```
my-app/
├── package.json          # scripts + dependencies for the whole workspace
├── tsconfig.json
├── eslint.config.mjs     # Base's lint rules included
├── jest.config.js
├── .github/workflows/    # CI, integration, and deploy workflows
└── workers/
    └── app/              # ← your worker
        ├── index.ts      # the worker entry point
        ├── settings.ts   # what this worker is and what it contains
        ├── wrangler.toml # Cloudflare configuration
        ├── env.toml      # per-environment variables and secrets
        ├── source/
        │   └── services/
        │       ├── HelloWorldService.ts
        │       ├── GreetingService.ts
        │       └── GreetingService.test.ts
        └── test/
            └── HelloWorld.integration.test.ts
```

We'll walk through the interesting files in the [next tutorial](./02-your-first-worker.md). For now, let's run it.

## Start the development server

From the workspace root:

```bash
npx base develop -w app
```

This reads `workers/app/settings.ts`, resolves your configuration, and starts wrangler's local dev server on the port your settings declare: `3000` for the scaffolded worker.

The `base` CLI is the front door for everything — scaffolding, developing, testing, database migrations, and deploys. `npx base <command>` runs the copy installed in your workspace's `node_modules`; the scaffolded `npm run base -- <command>` script is equivalent, so use whichever you prefer.

## Say hello

Open [http://localhost:3000](http://localhost:3000) in your browser, or:

```bash
curl http://localhost:3000/
```

```
Hello, world!
```

The starter worker also has a parameterized route:

```bash
curl http://localhost:3000/Ada
```

```
Hello, Ada!
```

## What just happened

`wrangler dev` is running your worker in a local Cloudflare Workers runtime — the same engine your code will run on in production. Base booted from your `settings.ts`, discovered the `HelloWorldService` class by its `@HttpService` decorator, and bound its `@HttpRoute` methods as live routes. Edit a file and the server reloads automatically.

Next: [Your First Worker](./02-your-first-worker.md) — read the code you just ran, then build a JSON API of your own.
