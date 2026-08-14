---
title: Share Types
description: One interface file imported by both sides, the contract that makes RPC typed end to end.
---

The recommended setup is a monorepo where your frontend and workers share TypeScript directly. The RPC contract is then just an interface file: no schema language, no codegen, no drift.

## The contract file

Write the service's interface in its own module, together with the JSON shapes it speaks. Keep it free of framework imports so any bundle can consume it:

```ts
// shared/NoteServiceInterface.ts

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

## The server implements it

```ts
@Injectable()
@RpcService()
export class NoteRpcService implements NoteServiceInterface { ... }
```

`implements` is what keeps the contract honest: change a signature on either side and the compiler objects.

Where a procedure takes a structured argument, the server pairs the JSON interface with a `@SerializableObject` class that implements it. The class is the runtime shape (deserialization + validation), the interface is the contract:

```ts
@SerializableObject()
export class CreateNoteInput implements CreateNoteJson {
    @VerifyIsNotEmpty()
    @SerializableField(() => String)
    title: string;

    @SerializableField(() => String)
    content: string;
}
```

## The client consumes it

```ts
const client = new RpcClient<NoteServiceInterface>(driver);

const note = await client.call().createNote({
    title: 'Typed',
    content: 'Checked against the same interface the server implements.',
});
```

Callers send **plain object literals** matching the JSON interfaces, and the server's `@RpcArgument(() => CreateNoteInput)` turns them into validated class instances on arrival. The client never needs the class.

## Bundle hygiene

- **Frontends import only the contract module.** The service module pulls in framework decorators, the ORM, and the rest of the worker, none of which belongs in a browser bundle. This is why the interface lives in its own file.
- **Interfaces are erased at build time; enums are not.** If your contract includes TypeScript enums, they're runtime values; importing them into the frontend is fine and intended, just know the file isn't purely type-only.
- In a monorepo, "sharing" is an import path (`@your-app/shared/NoteServiceInterface`). Publishing a types package achieves the same across repos, at the cost of a versioning step, one more reason the monorepo is the recommended shape.

## A sharp edge

`@InjectRequestContext()` parameters that sit **between** regular arguments must appear in the shared interface as an explicit placeholder slot the caller passes `undefined` for; the server overwrites it at dispatch. Trailing context parameters can simply be omitted from the interface. Prefer putting context parameters last.
