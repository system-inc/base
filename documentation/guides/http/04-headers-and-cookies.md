---
title: Headers and Cookies
description: Read request headers and cookies as handler arguments; set them on responses.
---

## Read a header

```ts
import { HttpHeader } from '@system-inc/base-foundation/router/decorators/HttpHeader';

    @HttpRoute('GET', '/whoami')
    whoami(@HttpHeader('user-agent') userAgent: string): Response {
        return new Response(userAgent);
    }
```

## Read a cookie

`@HttpCookie` mirrors the other parameter decorators — by name, with optional type coercion:

```ts
import { HttpCookie } from '@system-inc/base-foundation/router/decorators/HttpCookie';

    @HttpRoute('GET', '/preferences')
    preferences(@HttpCookie('theme', () => String) theme: string): Response {
        return Response.json({ theme });
    }
```

Or bind several cookies at once through a serializable class, exactly like the [query-object form](./02-read-request-parameters.md):

```ts
@SerializableObject()
export class SessionCookies {
    @SerializableField(() => String)
    sessionId: string;

    @SerializableField(() => String)
    deviceId: string;
}
```

```ts
@HttpRoute('GET', '/session')
session(@HttpCookie(() => SessionCookies) cookies: SessionCookies): Response {
    return Response.json({ session: cookies.sessionId });
}
```

## Set headers and cookies on the response

Responses are standard `Response` objects, so setting headers is the platform API you already know:

```ts
@HttpRoute('GET', '/download')
download(): Response {
    return new Response('report contents', {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="report.csv"',
        },
    });
}

@HttpRoute('POST', '/login')
login(): Response {
    const response = Response.json({ ok: true });
    response.headers.append(
        'Set-Cookie',
        'sessionId=abc123; HttpOnly; Secure; Path=/; SameSite=Lax',
    );
    return response;
}
```

Use `headers.append` (not `set`) for `Set-Cookie` so multiple cookies survive.
