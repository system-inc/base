---
title: Validate Input
description: Attach rules to input classes and let the boundary reject bad data, identically for HTTP, GraphQL, and RPC.
---

Validation in Base is one pipeline with three doors. Whether input arrives as an HTTP body, a GraphQL argument, or an RPC parameter, the same sequence runs: deserialize the raw JSON into your class, run its validation rules, and only then invoke your code. Invalid input never reaches a handler.

## Attach rules

Rules are `@VerifyIs*` decorators stacked on the input class's fields, above the serialization or GraphQL field decorator:

```ts
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

The same class shape works everywhere the input can enter:

- **HTTP**: `@HttpBody(() => RegisterInput)` ([guide](../http/03-validate-request-bodies.md))
- **GraphQL**: `@GqlArgument('input', () => RegisterInput)` on a `@GqlInputType` class
- **RPC**: `@RpcArgument(() => RegisterInput)`

Write the rule once, and every door enforces it.

## What failure looks like

A failed validation is rejected with **HTTP 422** and a structured `ArgumentValidationError` — message `"Argument Validation Error"`, error code `VALIDATION_ERROR`, and a `validationErrors` array under `extensions`:

```json
{
    "message": "Argument Validation Error",
    "statusCode": 422,
    "errorCode": "VALIDATION_ERROR",
    "extensions": {
        "validationErrors": [
            {
                "path": "email",
                "constraints": { "IsEmail": "email must be a valid email" }
            }
        ]
    }
}
```

- **`path`** locates the failing field, including nesting: `"address.postalCode"`, `"items[2].sku"`.
- **`constraints`** maps each failed rule name to its message: a field can fail several rules at once.
- Submitted values are deliberately **not** echoed back in the error.

The same structure arrives through every door: GraphQL nests it under the error's `extensions.baseError`; RPC callers catch an `RpcError` with code `VALIDATION_ERROR` ([guide](../rpc/02-call-from-the-web.md#handle-errors)).

## Where this sits in the pipeline

Deserialization runs first and answers "is this valid JSON of the right shape?" — failures there are HTTP 400. Validation runs second on the typed object and answers "is this acceptable?" — failures are 422. Your handler runs third, and by then the input is a real class instance that passed every rule. See [Serializable Objects](../serialization/01-serializable-objects.md) for the first stage.

Next: [the rule catalog](./02-validation-rules.md), and [writing your own rules](./03-custom-rules.md).
