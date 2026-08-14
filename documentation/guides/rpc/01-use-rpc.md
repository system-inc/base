---
title: Use RPC
description: Expose typed procedures from a worker, the default calling path for your own frontends and workers.
---

RPC is the intended default for calling a Base worker: your frontend and your other workers invoke typed methods, TypeScript checks both ends, and there is no schema or codegen layer in between. Reach for REST when the caller is a third party; reach for GraphQL when clients need flexible queries over a graph. For your own calls, RPC.

## Define an RPC service

`@RpcService()` marks the class; `@Rpc()` marks each procedure:

```ts
import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';
import { HttpErrors } from '@system-inc/base-foundation/error/HttpErrors';
import { OrmRepository } from '@system-inc/base-foundation/orm/database/repository/OrmRepository';
import { InjectRepository } from '@system-inc/base-foundation/orm/decorators/InjectRepository';
import { Rpc } from '@system-inc/base-foundation/rpc/decorators/Rpc';
import { RpcArgument } from '@system-inc/base-foundation/rpc/decorators/RpcArgument';
import { RpcService } from '@system-inc/base-foundation/rpc/decorators/RpcService';
import { NoteEntity } from '../entities/NoteEntity';
import { NoteJson, NoteServiceInterface } from './NoteServiceInterface';
import { CreateNoteInput } from './NoteTypes';

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

Everything you know from HTTP services carries over: `@Injectable()` constructor injection, `@InjectRequestContext()` parameters, `@WithMiddleware` at class or method scope, and thrown `HttpErrors`.

The `implements NoteServiceInterface` is the type-sharing contract your callers will consume — see [Share Types](./03-share-types.md).

## Arguments: typed and validated

`@RpcArgument(() => Type)` deserializes the incoming JSON into a real class instance and runs validation — the same pipeline as `@HttpBody` and GraphQL inputs:

```ts
import { SerializableField } from '@system-inc/base-foundation/serialization/decorators/SerializableField';
import { SerializableObject } from '@system-inc/base-foundation/serialization/decorators/SerializableObject';
import { VerifyIsNotEmpty } from '@system-inc/base-foundation/validation/decorators/VerifyIsNotEmpty';

@SerializableObject()
export class CreateNoteInput {
    @VerifyIsNotEmpty()
    @SerializableField(() => String)
    title: string;

    @SerializableField(() => String)
    content: string;
}
```

A failed validation never reaches your handler — the caller gets a structured validation error (see [Call a Worker from the Web](./02-call-from-the-web.md#handle-errors)).

Notes on the decorator forms:

- `@RpcArgument(() => [Number])` handles arrays; primitives (`() => String`, `() => Number`) coerce without a class.
- A parameter **without** `@RpcArgument` receives the raw JSON as-is: no class instance, no validation. Fine for pass-through payloads; prefer the decorated form at trust boundaries.
- `@Rpc(() => ReturnType)` additionally runs your return value through serialization — use it when returning `@SerializableObject` class instances; plain JSON return values need only bare `@Rpc()`.

## Register and expose

The service class goes in the same `services` list as everything else. Exposure is configured in the `rpc` settings slot:

```ts
    services: [NoteRpcService],
    rpc: {
        service: {
            visibility: 'public',
        },
    },
```

- All procedures are served on a single `POST /__rpc` route (override with `rpc.service.route`).
- **`visibility`** defaults to `'internal'`: only workers you allow can call in (see [Worker-to-Worker Calls](./04-worker-to-worker.md)). Set `'public'` when browsers call the worker directly.
- Visibility can be overridden per service (`@RpcService({ visibility: ... })`) or per procedure (`@Rpc({ visibility: ... })`) — most specific wins. Handy for one public procedure on an otherwise internal service.
- In local development, visibility is always effectively public so you can iterate freely.
- Like every service class, a decorated-but-unlisted service is not callable — registration is explicit.
