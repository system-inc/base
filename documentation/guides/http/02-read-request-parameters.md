---
title: Read Request Parameters
description: Pull path segments and query parameters into typed handler arguments.
---

Parameter decorators extract request data and hand it to your handler as typed arguments — no manual parsing.

## Path parameters

Declare `:name` segments in the route, extract them with `@HttpPath`:

```ts
import { HttpPath } from '@system-inc/base-foundation/router/decorators/HttpPath';

@HttpRoute('GET', '/notes/:id')
get(@HttpPath('id') id: string): Response { ... }

@HttpRoute('GET', '/books/:author/:year/:title')
find(
    @HttpPath('author') author: string,
    @HttpPath('year', () => Number) year: number,
    @HttpPath('title') title: string,
): Response { ... }
```

Path values are strings by default; pass a type thunk (`() => Number`) to coerce.

## Query parameters

`@HttpQuery` works the same way for `?key=value` pairs:

```ts
import { HttpQuery } from '@system-inc/base-foundation/router/decorators/HttpQuery';

@HttpRoute('GET', '/search')
search(
    @HttpQuery('term') term: string,
    @HttpQuery('limit', () => Number) limit: number,
): Response { ... }
```

## Bind the whole query string to a class

For endpoints with several parameters, define a serializable class and bind the entire query string in one argument:

```ts
import { SerializableField } from '@system-inc/base-foundation/serialization/decorators/SerializableField';
import { SerializableObject } from '@system-inc/base-foundation/serialization/decorators/SerializableObject';

@SerializableObject()
export class SearchQuery {
    @SerializableField(() => String)
    term: string;

    @SerializableField(() => Number)
    limit: number;
}
```

```ts
@HttpRoute('GET', '/search')
search(@HttpQuery(() => SearchQuery) query: SearchQuery): Response {
    return Response.json({ term: query.term, limit: query.limit });
}
```

Fields are deserialized and coerced per their `@SerializableField` types, and any validation decorators on the class run before your handler — the same machinery as [request bodies](./03-validate-request-bodies.md).
