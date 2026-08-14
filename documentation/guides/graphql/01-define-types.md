---
title: Define Types
description: Object and input types as decorated classes, with the schema generated from your code.
---

GraphQL types in Base are classes. Each [`@GqlField`](reference:GqlField) becomes a schema field; the SDL is generated from what you write, so schema and code cannot drift.

## Object types

```ts
import { GqlField } from '@system-inc/base-foundation/graphql/decorators/GqlField';
import { GqlObjectType } from '@system-inc/base-foundation/graphql/decorators/GqlObjectType';

@GqlObjectType()
export class Note {
    @GqlField(() => String)
    id: string;

    @GqlField(() => String)
    title: string;

    @GqlField(() => String, { nullable: true })
    summary: string | null;

    @GqlField(() => [String])
    tags: string[];
}
```

- The thunk (`() => String`) declares the GraphQL type; arrays use `() => [Type]`.
- **Nullability must match the TypeScript type** — `{ nullable: true }` pairs with `| null`, and Base's `gql-nullable-parity` lint rule enforces the agreement. The schema never promises more than the types do.
- Unlike ORM entities, GraphQL type classes are plain: no `declare`, no base class.

## Input types

Inputs get their own decorator, and can carry validation, which runs before your resolver sees the data:

```ts
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

The argument to [`@GqlInputType`](reference:GqlInputType) is the schema name. A single class can even serve as both shapes — stack `@GqlObjectType()` and `@GqlInputType('TesterInput')` on one class when the output and input shapes genuinely coincide.

## Nesting

Fields reference other type classes through the same thunk form:

```ts
@GqlObjectType()
export class NoteWithAuthor {
    @GqlField(() => Note)
    note: Note;

    @GqlField(() => Author)
    author: Author;
}
```

The generated schema mirrors the class graph. When you're ready to serve these types, head to [Write Resolvers](./02-write-resolvers.md).
