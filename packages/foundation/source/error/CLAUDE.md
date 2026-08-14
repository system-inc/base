# error/ — error model

The framework's error type and helpers. Every framework error is a `BaseError`; dispatchers turn thrown errors into client-safe responses (masking internals in production) using this model. The wire format + redaction logic lives in [`base-common/error`](../../../common/CLAUDE.md) (`BaseErrorSerializer`); this folder is the foundation-side classes and HTTP/validation specializations.

## `BaseError`

The base for all errors (wraps itty-router's `StatusError`). Options: `name`, `statusCode`, `errorCode` (application-specific, programmatic), `cause`, `extensions`. Key statics:

- `fromMessage(message, options?)` — a 500 by default.
- `fromHttpStatus(code, options?)` / `fromErrorData(data)`.
- `normalize(unknown)` — coerce any thrown value into a `BaseError`.
- **`forClient(error, defaultMessage)`** → `{ safe, raw, masked }` — the masking gate the dispatchers use: an authored 4xx passes through (`masked: false`); an unexpected error becomes a safe generic `BaseError` (`masked: true`) while `raw` is retained for paths that need the unmasked error (task retry, alerting).
- `wrap(...)`.
- `toJSON()` → `BaseErrorDataType` — client-safe serialized form (nests the cause's serialized form).

## Specializations & helpers

- **`HttpErrors`** — a factory of common HTTP status errors (`badRequest` 400, `unauthorized` 401, `notFound`, …), each returning a `BaseError` with the right status. Use these to throw from handlers.
- **`ArgumentValidationError`** — extends `BaseError`, carries `validationErrors` (the [validation](../validation/CLAUDE.md) `ValidationError[]` / wire-form `ValidationErrorData[]`) with `errorCode = VALIDATION_ERROR`. This is what the shared `validate()` path throws across HTTP / RPC / GraphQL.
- **`AbortedError`** — request/operation aborted.
- **`ErrorCode.ts`** — the application error-code constants (`VALIDATION_ERROR`, `SERIALIZATION_ERROR`, `INVALID_TYPE`, `QUOTA_EXCEEDED`, `NOT_FOUND`, `ALREADY_EXISTS`, and the [access-control](../access-control/CLAUDE.md) codes `AUTHENTICATION_REQUIRED`, `PERMISSION_DENIED`, `INSUFFICIENT_ENTITLEMENTS`).

## Persisting errors

`BaseErrorSerializerOrmTransformer` (a Drizzle `OrmValueTransformer`) maps a `BaseError` ↔ its serialized `BaseErrorDataType` for storage in a database column, with a `'client' | 'debug'` mode controlling how much detail is persisted.

## See also

[`base-common/error`](../../../common/CLAUDE.md) (`BaseErrorSerializer`, redaction) · [`validation/`](../validation/CLAUDE.md) · the dispatchers in [`router/`](../router/CLAUDE.md) / [`rpc/`](../rpc/CLAUDE.md) / [`graphql/`](../graphql/CLAUDE.md) that call `forClient`.
