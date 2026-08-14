---
title: The Schema Workflow
description: Enable GraphQL, keep a committed SDL snapshot, and gate breaking changes in CI.
---

The schema is an output of your code, but it's also an artifact worth tracking: Base generates it to a committed file and checks compatibility against it, so breaking a client is a failed check instead of a production incident.

## Enable GraphQL

Two lines in `settings.ts`:

```ts
import { GraphQLYoga } from '@system-inc/base-foundation/graphql/providers/GraphQLYoga';
```

```ts
    graphql: {
        type: GraphQLYoga,
    },
```

Optional settings:

- **`route`**: defaults to `/graphql` (`POST`; `GET` is added only when GraphiQL is on).
- **`graphiql`** / **`introspection`**: environment-keyed booleans; both default to **on in development, off in production**. Enable introspection deliberately if you have a schema-consuming toolchain in production.
- CORS comes from the worker's one [allowlist](../http/06-cors.md): Base deliberately overrides the GraphQL server's own permissive CORS handling.

## Generate the SDL snapshot

```bash
npx base graphql schema:generate -w app
```

This writes the generated SDL (e.g. `graphql/schemas/schema.graphql` in your worker) — commit it. The snapshot is the reviewable face of your schema: a PR that changes resolvers shows the schema diff right next to the code diff.

## Gate breaking changes

```bash
npx base graphql schema:check -w app
```

Verifies the current code's schema is backward-compatible with the committed baseline, failing on breaking changes — removed fields, changed types, newly-required arguments. Run it in CI and schema breakage becomes a deliberate decision (update the baseline in the same PR) rather than an accident.

## The rhythm

1. Change types or resolvers.
2. `npx base graphql schema:generate`: refresh the snapshot, read the diff.
3. `npx base graphql schema:check`: confirm compatibility (CI runs it too).
4. Commit code + snapshot together.

That's the whole loop: no separate schema file to maintain by hand, but a full audit trail of every schema change in git history.
