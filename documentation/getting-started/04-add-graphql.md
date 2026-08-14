---
title: Add GraphQL
description: Expose your notes over GraphQL with a typed resolver, then query them in GraphiQL.
---

By the end of this tutorial your worker will serve a GraphQL API at `/graphql` — with a typed schema generated from your classes, a query, a mutation, and GraphiQL to explore it — alongside the REST routes you already have.

You'll continue with the notes project from [Add a Database](./03-add-a-database.md).

## Enable GraphQL

GraphQL is off until you opt in. Enabling it takes two lines in `settings.ts`: pick a server provider, and Base does the rest.

```ts
import { GraphQLYoga } from '@system-inc/base-foundation/graphql/providers/GraphQLYoga';
```

```ts
    graphql: {
        type: GraphQLYoga,
    },
```

With this in place, Base registers a `POST /graphql` route at boot. In development it also enables GraphiQL (the in-browser query IDE) on `GET /graphql` and schema introspection — both default to off in production.

There is no separate list of resolvers to maintain. Any class in your `services` array decorated with `@GqlResolver` is discovered and wired into the schema automatically, the same way `@HttpService` classes become routes.

## Define an object type

GraphQL needs to know the shape of what you return. Describe it with a class — each `@GqlField` becomes a field in the schema:

```ts
// source/types/Note.ts
import { GqlField } from '@system-inc/base-foundation/graphql/decorators/GqlField';
import { GqlObjectType } from '@system-inc/base-foundation/graphql/decorators/GqlObjectType';

@GqlObjectType()
export class Note {
    @GqlField(() => String)
    id: string;

    @GqlField(() => String)
    title: string;

    @GqlField(() => String)
    content: string;
}
```

The thunk form (`() => String`) tells Base the GraphQL type for each field. A field's GraphQL nullability must match its TypeScript type: `@GqlField(() => String, { nullable: true })` pairs with `string | null`, and Base enforces this with a lint rule.

Inputs get their own type. A class can carry validation decorators too — they run automatically before your resolver sees the data:

```ts
// source/types/CreateNoteInput.ts
import { GqlField } from '@system-inc/base-foundation/graphql/decorators/GqlField';
import { GqlInputType } from '@system-inc/base-foundation/graphql/decorators/GqlInputType';
import { VerifyIsNotEmpty } from '@system-inc/base-foundation/validation/decorators/VerifyIsNotEmpty';

@GqlInputType('CreateNoteInput')
export class CreateNoteInput {
    @VerifyIsNotEmpty()
    @GqlField(() => String)
    title: string;

    @GqlField(() => String)
    content: string;
}
```

## Write a resolver

A resolver is a class decorated with `@GqlResolver`, pointing at the object type it serves. Queries and mutations are methods:

```ts
// source/services/NoteResolver.ts
import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';
import { HttpErrors } from '@system-inc/base-foundation/error/HttpErrors';
import { GqlArgument } from '@system-inc/base-foundation/graphql/decorators/GqlArgument';
import { GqlMutation } from '@system-inc/base-foundation/graphql/decorators/GqlMutation';
import { GqlQuery } from '@system-inc/base-foundation/graphql/decorators/GqlQuery';
import { GqlResolver } from '@system-inc/base-foundation/graphql/decorators/GqlResolver';
import { OrmRepository } from '@system-inc/base-foundation/orm/database/repository/OrmRepository';
import { InjectRepository } from '@system-inc/base-foundation/orm/decorators/InjectRepository';
import { NoteEntity } from '../entities/NoteEntity';
import { CreateNoteInput } from '../types/CreateNoteInput';
import { Note } from '../types/Note';

@Injectable()
@GqlResolver(() => Note)
export class NoteResolver {
    constructor(
        @InjectRepository(NoteEntity)
        private readonly notes: OrmRepository<NoteEntity>,
    ) {}

    @GqlQuery(() => Note)
    async note(@GqlArgument('id', () => String) id: string): Promise<Note> {
        const note = await this.notes.findOne({ where: { id } });
        if (!note) {
            throw HttpErrors.notFound({ message: 'Note not found.' });
        }
        return { id: note.id, title: note.title, content: note.content };
    }

    @GqlMutation(() => Note)
    async createNote(
        @GqlArgument('input', () => CreateNoteInput) input: CreateNoteInput,
    ): Promise<Note> {
        const note = NoteEntity.from({
            title: input.title,
            content: input.content,
        });
        await this.notes.insert(note);
        return { id: note.id, title: note.title, content: note.content };
    }
}
```

Everything here works exactly like it did in your HTTP service: `@Injectable()` enables constructor injection, `@InjectRepository(NoteEntity)` hands you the same typed repository, and thrown `HttpErrors` become proper GraphQL errors.

## Register the resolver

Add the resolver to the same `services` array as your HTTP service in `settings.ts`:

```ts
    services: [NoteService, NoteResolver, HelloWorldService],
```

One list, every kind of service. Each class's decorator declares what it is: `@HttpService` classes become routes, `@GqlResolver` classes join the schema, and Base sorts them at boot.

## Try it in GraphiQL

Start the worker again and open `http://localhost:3000/graphql` in your browser. GraphiQL loads with your schema ready to explore.

Create a note:

```graphql
mutation {
    createNote(
        input: { title: "GraphQL note", content: "Written in GraphiQL." }
    ) {
        id
        title
    }
}
```

Then fetch it by the returned `id`:

```graphql
query {
    note(id: "YOUR_ID_HERE") {
        id
        title
        content
    }
}
```

Try `createNote` with an empty `title` — the `@VerifyIsNotEmpty()` rule rejects it before your resolver runs. Validation is one pipeline shared by HTTP, RPC, and GraphQL: the same decorators guard every way into your code.

## What you built

Your worker now speaks REST and GraphQL from one codebase, one entity, and one `services` list. The schema is generated from your classes, so it can never drift from your types.

Next: [Deploy to Cloudflare](./05-deploy-to-cloudflare.md) — ship the whole thing to the edge.
