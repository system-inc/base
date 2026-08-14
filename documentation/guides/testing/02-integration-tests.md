---
title: Integration Tests
description: Exercise a live worker end to end across REST, GraphQL, and RPC, with one shared cookie jar.
---

Integration tests hit a **running worker** over real HTTP. `base test` provides the harness: it resolves where the worker lives, wires the environment into jest, and runs everything matching `*.integration.test.ts`.

## One thing to know first

**`base test` does not start your worker.** It targets one that's already running:

- **Locally**: run `npx base develop -w app` in another shell; the test host resolves from `settings.server['@default']`.
- **In CI / against an environment**: point settings at a deployed worker, e.g. `server: { Integration: { host: 'https://app-test.example.workers.dev' } }`, and run `npx base test -w app -e Integration`.

Host resolution precedence: `--test-host` flag → `TEST_HOST` env var → `settings.server[<environment>]` → `settings.server['@default']`. (`base test` refuses to run against Production.)

## Write a test

Everything starts at `IntegrationTestEnvironment.get().client`:

```ts
// test/Notes.integration.test.ts
import { IntegrationTestEnvironment } from '@system-inc/base-foundation/test/IntegrationTestEnvironment';

const client = IntegrationTestEnvironment.get().client;
const baseUrl = client.getServerBaseUrl();

describe('Notes API', () => {
    test('creates and fetches a note', async () => {
        const created = await client.sendRequest(`${baseUrl}/notes`, {
            method: 'POST',
            body: JSON.stringify({ title: 'First', content: 'Hello.' }),
            headers: { 'Content-Type': 'application/json' },
        });
        expect(created.status).toBe(200);
        const note = await created.json<{ id: string }>();

        const fetched = await client.sendRequest(`${baseUrl}/notes/${note.id}`);
        expect(fetched.status).toBe(200);
    });

    test('rejects an empty title with 422', async () => {
        const result = await client.sendRequest(`${baseUrl}/notes`, {
            method: 'POST',
            body: JSON.stringify({ title: '', content: 'no title' }),
            headers: { 'Content-Type': 'application/json' },
        });
        expect(result.status).toBe(422);
    });
});
```

## Every surface, one client

The client speaks all three dispatch surfaces, and they share one cookie jar — sign in over REST, then call GraphQL or RPC as that session:

```ts
// REST
await client.sendRequest(url, requestInit);

// GraphQL (a graphql-request client against /graphql)
const gql = client.getGqlClient();

// RPC — fully typed against your shared interface
const rpc = client.getRemoteProcedureClient<NoteServiceInterface>();
const note = await rpc.call().getNote(id);
```

Cookies are managed through accessors (`getCookies()`, `setCookie(name, value)`, `clearAllCookies()`) and captured automatically from `Set-Cookie` responses. `getWebSocket()` and `getOrmDatabase(entities)` exist for socket and direct-database assertions.

## Useful flags

```bash
npx base test -w app                       # the worker's integration suite
npx base test -w app -t "creates a note"   # filter by test name
npx base test --all-workers                # every worker in the workspace
```

Tests run in-band with a 60s default timeout (override with `--test-timeout`). The scaffold's `npm run test:integration` wraps the `--all-workers` form.
