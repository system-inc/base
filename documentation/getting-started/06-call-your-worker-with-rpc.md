---
title: Call Your Worker with RPC
description: Expose the notes service as typed procedures and call them like local methods, the way Base apps talk to their workers.
identifier: call-with-rpc
---

By the end of this tutorial your notes API will be callable as **typed methods** — `client.call().getNote(id)` — with TypeScript checking both ends against one shared interface. This is the calling path Base intends for worker to worker calls, and it can also be used by your frontend: no REST plumbing, no schema layer, just an interface file.

You'll continue with the notes project from the [previous tutorials](./05-deploy-to-cloudflare.md).

## Write the contract

The whole trick is one interface file, free of framework imports, that both sides share:

```ts
// workers/app/source/services/NoteServiceInterface.ts

export interface NoteJson {
    id: string;
    title: string;
    content: string;
}

export interface CreateNoteJson {
    title: string;
    content: string;
}

export interface NoteServiceInterface {
    getNote(id: string): Promise<NoteJson>;
    createNote(input: CreateNoteJson): Promise<NoteJson>;
}
```

## Implement it as an RPC service

An RPC service looks exactly like the services you've written — different decorators, same everything else:

```ts
// workers/app/source/services/NoteRpcService.ts
import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';
import { HttpErrors } from '@system-inc/base-foundation/error/HttpErrors';
import { OrmRepository } from '@system-inc/base-foundation/orm/database/repository/OrmRepository';
import { InjectRepository } from '@system-inc/base-foundation/orm/decorators/InjectRepository';
import { Rpc } from '@system-inc/base-foundation/rpc/decorators/Rpc';
import { RpcArgument } from '@system-inc/base-foundation/rpc/decorators/RpcArgument';
import { RpcService } from '@system-inc/base-foundation/rpc/decorators/RpcService';
import { NoteEntity } from '../entities/NoteEntity';
import { CreateNoteInput } from './NoteService';
import { NoteJson, NoteServiceInterface } from './NoteServiceInterface';

@Injectable()
@RpcService()
export class NoteRpcService implements NoteServiceInterface {
    constructor(
        @InjectRepository(NoteEntity)
        private readonly notes: OrmRepository<NoteEntity>,
    ) {}

    @Rpc()
    async getNote(@RpcArgument(() => String) id: string): Promise<NoteJson> {
        const note = await this.notes.findOne({ where: { id } });
        if (!note) {
            throw HttpErrors.notFound({ message: 'Note not found.' });
        }
        return { id: note.id, title: note.title, content: note.content };
    }

    @Rpc()
    async createNote(
        @RpcArgument(() => CreateNoteInput) input: CreateNoteInput,
    ): Promise<NoteJson> {
        const note = NoteEntity.from({
            title: input.title,
            content: input.content,
        });
        await this.notes.insert(note);
        return { id: note.id, title: note.title, content: note.content };
    }
}
```

Notice what's reused: the same repository, the same `CreateNoteInput` class you built in [Your First Worker](./02-your-first-worker.md), so `createNote` gets the same validation your REST route has. `implements NoteServiceInterface` is the compiler holding both sides to the contract.

## Register and expose

In `settings.ts`, add the service and open RPC to public callers:

```ts
    services: [NoteService, NoteRpcService, HelloWorldService],
    rpc: {
        service: {
            visibility: 'public',
        },
    },
```

Every procedure is served on one `POST /__rpc` route. (`visibility` defaults to `'internal'` — worker-to-worker only; `'public'` is what lets browsers in. Local dev is always open.)

## Call it: Typed end to end

The client comes from `@system-inc/base-client`. Add a typed call to your integration tests (`workers/app/test/NoteRpc.integration.test.ts`) and you can watch the contract work:

```ts
import { IntegrationTestEnvironment } from '@system-inc/base-foundation/test/IntegrationTestEnvironment';
import { NoteServiceInterface } from '../source/services/NoteServiceInterface';

const client =
    IntegrationTestEnvironment.get().client.getRemoteProcedureClient<NoteServiceInterface>();

describe('Notes over RPC', () => {
    test('creates and fetches a note', async () => {
        const created = await client.call().createNote({
            title: 'Via RPC',
            content: 'Typed end to end.',
        });

        const fetched = await client.call().getNote(created.id);
        expect(fetched.title).toBe('Via RPC');
    });
});
```

With the dev server running, `npx base test -w app`. Try misspelling a method or dropping an argument — it won't compile. That's the point.

In your actual frontend, the client is the same three lines, built from the same interface import:

```ts
import { NoteServiceInterface } from '@my-app/app/source/services/NoteServiceInterface';

import { FetchRpcClientDriver } from '@system-inc/base-client/rpc/client/driver/FetchRpcClientDriver';
import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';

const client = new RpcClient<NoteServiceInterface>(
    new FetchRpcClientDriver('api.example.com', { secure: true }),
);

const note = await client
    .call()
    .createNote({ title: 'From the web', content: '...' });
```

In a monorepo, that interface import is just a path — your web app and your worker share one source of truth, and renaming a field refactors both sides at once.

## What you built

The notes service now speaks three protocols (REST, GraphQL, and RPC) from one repository and one validation pipeline. For your own frontend, RPC is the one to reach for first: typed like a local call, validated like a request. The [RPC guides](../guides/rpc/01-use-rpc.md) cover errors, retries, and worker-to-worker calls from here.
