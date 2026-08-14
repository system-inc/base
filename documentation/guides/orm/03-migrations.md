---
title: Migrations
description: Generate SQL from your entities, apply it locally, and release it for deploys.
---

You never hand-write schema SQL: migrations are derived from your entities, reviewed as files in your repo, and gated before they reach production.

## The core workflow

**1. Generate.** After adding or changing entities, diff them against the last known schema:

```bash
npx base orm schema:generate -w app
```

This writes a numbered `.sql` migration into `workers/app/database/<database-name>/drizzle/migrations/` (one folder per named database: `@default` unless you've added more). Read the SQL; it's part of your PR.

**2. Apply locally.**

```bash
npx base orm migration:run -w app --local
```

`--local` targets wrangler's local D1 — the same simulated database `base develop` reads. (For non-D1 databases like PlanetScale, omit `--local`; the command applies to the configured remote.)

**3. Release before deploying.** Deploys are blocked until migrations are promoted to the released list:

```bash
npx base orm migration:release -w app
```

This updates a release file in your repo — commit it. The gate exists so a schema change is always a deliberate, reviewed act, never a side effect of a deploy.

**4. Apply to the target environment** when shipping:

```bash
npx base orm migration:run -w app -e Production
```

## Supporting commands

| Command                | What it does                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| `orm migration:check`  | Verify migration history is consistent                             |
| `orm schema:check`     | Verify entities and migrations agree                               |
| `orm migration:drop`   | Delete a migration **file** (local only — not a database rollback) |
| `orm db:reset --local` | Wipe local database state for a clean slate                        |
| `orm db:studio`        | Open Drizzle Studio — a browser GUI over your database             |

## Notes

- Migration state is tracked in the database in a per-worker `__drizzle_migrations_<worker>` table, so workers sharing a database keep independent migration histories. For D1, your wrangler `d1_databases` config must name the same table in `migrations_table` (along with the migrations folder in `migrations_dir`) — that is the ledger `migration:run --local` writes to, and `base check` fails when the two disagree.
- Each named database migrates independently: its own folder, its own history.
- Durable Object databases bundle migrations into settings (`migrations`/`released` imports) since there's no external database to reach — see the Durable Objects guide.
