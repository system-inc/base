---
title: Write Resolvers
description: Queries, mutations, typed arguments, and per-operation context in resolver classes.
---

A resolver is a class decorated with [`@GqlResolver`](reference:GqlResolver), pointing at the object type it serves. Queries and mutations are just methods — injection, validation, and error handling all work exactly as they do in HTTP and RPC services.

## Queries and mutations

```ts
import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';
import { HttpErrors } from '@system-inc/base-foundation/error/HttpErrors';
import { GqlArgument } from '@system-inc/base-foundation/graphql/decorators/GqlArgument';
import { GqlMutation } from '@system-inc/base-foundation/graphql/decorators/GqlMutation';
import { GqlQuery } from '@system-inc/base-foundation/graphql/decorators/GqlQuery';
import { GqlResolver } from '@system-inc/base-foundation/graphql/decorators/GqlResolver';
import { CreateNoteInput } from '../types/CreateNoteInput';
import { Note } from '../types/Note';

@Injectable()
@GqlResolver(() => Note)
export class NoteResolver {
    @GqlQuery(() => Note)
    async note(@GqlArgument('id', () => String) id: string): Promise<Note> {
        const note = await this.findNote(id);
        if (!note) {
            throw HttpErrors.notFound({ message: 'Note not found.' });
        }
        return note;
    }

    @GqlMutation(() => Note)
    async createNote(
        @GqlArgument('input', () => CreateNoteInput) input: CreateNoteInput,
    ): Promise<Note> { ... }
}
```

- [`@GqlQuery`](reference:GqlQuery) / [`@GqlMutation`](reference:GqlMutation) take the return type as a thunk, like every type reference.
- [`@GqlArgument`](reference:GqlArgument)`(name, () => Type)` declares a named schema argument. Class-typed arguments are deserialized and validated before your method runs — invalid input becomes a GraphQL error, not a resolver crash.
- Thrown `HttpErrors` surface as structured GraphQL errors.
- Register the resolver in `services` like everything else.

## Request context in resolvers

The same [RequestContext](../request-context/01-use-the-request-context.md) flows through GraphQL:

```ts
import { InjectRequestContext } from '@system-inc/base-foundation/request/decorators/RequestContextDecorator';
import { RequestContext } from '@system-inc/base-foundation/request/RequestContext';

    @GqlQuery(() => Viewer)
    async viewer(
        @InjectRequestContext() context: RequestContext,
    ): Promise<Viewer> {
        return { requestId: context.requestId };
    }
```

Middleware-set context keys, cookies, headers — all identical to HTTP. One request pipeline, three dispatchers.

## Per-operation context

For GraphQL-specific introspection — which operation is running, and which fields the client actually selected — inject the operation context:

```ts
import {
    GqlOperationContext,
} from '@system-inc/base-foundation/graphql/GqlOperationContext';
import { InjectGqlOperationContext } from '@system-inc/base-foundation/graphql/decorators/GqlOperationContext';

    @GqlQuery(() => NoteStats)
    async noteStats(
        @InjectGqlOperationContext()
        operation: GqlOperationContext<NoteStats>,
    ): Promise<NoteStats> {
        const selected = Object.keys(operation.selectionSet);
        // compute only what was asked for
        ...
    }
```

`operation.type`, `operation.name`, and the typed `selectionSet` let a resolver skip expensive work for fields nobody requested.
