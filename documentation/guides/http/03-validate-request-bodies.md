---
title: Validate Request Bodies
description: Deserialize JSON bodies into typed, validated classes, or take the raw body when you need it.
---

`@HttpBody` controls how the request body reaches your handler: as a typed, validated class instance, as parsed-but-unvalidated JSON, or as a raw stream.

## Typed and validated (the default choice)

Define the shape as a serializable class, add validation rules, and bind it:

```ts
import { HttpBody } from '@system-inc/base-foundation/router/decorators/HttpBody';
import { SerializableField } from '@system-inc/base-foundation/serialization/decorators/SerializableField';
import { SerializableObject } from '@system-inc/base-foundation/serialization/decorators/SerializableObject';
import { VerifyIsEmail } from '@system-inc/base-foundation/validation/decorators/VerifyIsEmail';
import { VerifyMax } from '@system-inc/base-foundation/validation/decorators/VerifyMax';

@SerializableObject()
export class RegisterInput {
    @VerifyIsEmail()
    @SerializableField(() => String)
    email: string;

    @VerifyMax(120)
    @SerializableField(() => Number)
    age: number;
}
```

```ts
@HttpRoute('POST', '/register')
register(@HttpBody(() => RegisterInput) input: RegisterInput): Response {
    // input is a real RegisterInput instance, already validated
    return Response.json(input);
}
```

The body is deserialized into an actual class instance and every validation decorator runs **before your handler is invoked** — invalid input is rejected with a structured error response and your code never sees it. The `@VerifyIs*` family covers the common rules (see the Validation reference for the full set), and the same decorators validate GraphQL inputs and RPC arguments unchanged.

## Raw JSON, no class

When you want parsed JSON without declaring a shape:

```ts
@HttpRoute('POST', '/ingest')
ingest(@HttpBody({ mode: 'json' }) body: unknown): Response {
    return Response.json({ received: body });
}
```

No validation runs — the handler owns the checking.

## Other body modes

- `@HttpBody()` with no arguments hands you the body as a `ReadableStream` — nothing is buffered.
- `@HttpBody({ mode: 'text' })`, `'formData'`, `'arrayBuffer'`, `'blob'`: the standard body readings, done for you.

Pick the typed form unless you have a concrete reason not to: it's the difference between validating at the boundary and validating everywhere.
