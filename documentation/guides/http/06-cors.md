---
title: CORS
description: Configure cross-origin access with an explicit allowlist, per environment.
---

CORS is configured once, in `settings.ts`, under `router.cors`. Base applies the policy itself for every HTTP response — including the GraphQL endpoint, where it deliberately replaces the GraphQL server's own permissive CORS handling with your allowlist.

## Configure an allowlist

```ts
    router: {
        cors: {
            preflight: true,
            allowedOrigins: {
                '@default': 'https://app.example.com',
            },
            allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            allowCredentials: true,
        },
    },
```

- **`preflight: true`** answers `OPTIONS` preflight requests automatically.
- **`allowedOrigins`** is environment-keyed, like `server` and `orm`: `'@default'` is the fallback, and any environment name (`Development`, `Production`, …) can override it. That lets you run wide-open locally and locked-down in production:

```ts
            allowedOrigins: {
                '@default': 'https://app.example.com',
                Development: '*',
            },
```

- **`allowCredentials: true`** is what makes cookie-carrying cross-origin requests work — pair it with explicit origins in production rather than `'*'`.

## Why Base owns CORS

Reflecting any `Origin` while allowing credentials is the classic CORS misconfiguration, and it's the default behavior of more than one off-the-shelf server. Base routes every response (REST and GraphQL) through the single allowlist above, so your policy lives in one reviewed place.
