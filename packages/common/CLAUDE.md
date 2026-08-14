# @system-inc/base-common

Pure, environment-agnostic utility helpers shared by every other package. This is the **leaf** of the dependency graph: it imports nothing else in the repo, and `client`, `foundation`, and `cli` all build on top of it.

## Purpose

A grab-bag of small, focused, dependency-light utilities — type helpers, concurrency primitives, crypto, time/date handling, HTTP and RPC protocol types, currency math, parsing — written to run in **both Node and Cloudflare Workers**. Code here must not assume a particular runtime: crypto uses `crypto.subtle`, fetch helpers strip Worker-incompatible options, etc.

## How it's consumed

Per-file subpath imports — **no barrel** (`"exports": { "./*": ... }`):

```ts
import { Backoff } from '@system-inc/base-common/concurrent/Backoff';
import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';
import { Constructor } from '@system-inc/base-common/type/Constructor';
```

`type/Constructor`, `type/Dictionary`, `configuration/NamedConfiguration`, `json/Json`, and the `rpc/protocol/*` types are the most heavily imported across the repo.

## Design choices

- **Truly low-dependency.** Only three runtime deps, each backing one folder: `cron-parser` (`cron/`), `decimal.js` (`currency/`, `database/MonetaryDecimal`), `iso8601-duration` (`time/Duration`). `graphql` is an _optional peer_ dep — only needed if you import the `graphql/*` helpers.
- **Tree-shakeable by construction.** No barrel means downstream bundles only pull the files they touch.
- **Shared protocol home.** `rpc/protocol/` defines the wire types (`RpcCall`, `RpcResponse`, `RpcEnvelope`, `RpcErrorCode`, `DefaultRpcEndpoint`) that both `base-client` (transport) and `base-foundation` (dispatch) implement against — neither side redefines the protocol.
- **`Secret<T>` for sensitive values** (`secret/`) so plaintext never leaks through logs/serialization; revealed only at the crypto boundary.

## Folder map

**Meatier subsystems (likely to get their own CLAUDE.md if we go deeper):**

| Folder                                             | What it provides                                                                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`concurrent/`](./source/concurrent/CLAUDE.md)     | Async primitives: `Backoff`/`BackoffTask`, `BatchingQueue`, `CountDownLatch`, `CountingSemaphore`, `PromiseBarrier`, `PromiseGroup`, `TrackedPromise`, `Sleep` |
| `type/`                                            | Core type utilities: `Constructor`, `Dictionary`, `EnumLike`, `PrimitiveType`, `TypedKey`, `UtilityTypes`, `BaseHandler`, `AssertNever`                        |
| `cryptography/`                                    | `CryptoKeyFactory`, `CryptoOperations` (sign/verify/hash via `crypto.subtle`), `NonceGeneration`                                                               |
| `time/`                                            | `Duration` (ISO-8601), `FormatDate`, `StopWatch`, `TimeInterval`                                                                                               |
| `database/`                                        | Dialect-agnostic DB utilities: `MonetaryDecimal` (cent-based money), `DecimalTransformer`, `TypedJson`, pagination constants (`DatabaseConstants`)             |
| `http/`                                            | `Cookies`, `Fetchable` (injectable fetch interface), `HttpHeaders`, `HttpStatus`, `MediaType`                                                                  |
| [`rpc/protocol/`](./source/rpc/protocol/CLAUDE.md) | The shared RPC wire protocol (see Design choices)                                                                                                              |
| `graphql/`                                         | Schema-builder input types: pagination, ordering, column-filter, `Decimal` scalar                                                                              |
| `oauth/oauth1a/`                                   | OAuth 1.0a header generation with HMAC-SHA1 signing                                                                                                            |
| `user-agent/`                                      | User-agent parsing (`ClientCategory`, `DeviceCategory`)                                                                                                        |

**Small utility clusters (summarized here, not individually documented):**

`array/` (Compact) · `buffer/` (DynamicBuffer) · `string/` (case conversion, sanitize) · `number/` (Clamp, parsing) · `object/` · `json/` (Json, StrictJson, value-transformer) · `parse/` (SafeParse w/ defaults) · `currency/` (FormatCurrency) · `locale/` (country/language codes) · `media/` (MediaObject) · `cron/` (expression parse/validate) · `scheduled/` · `secret/` · `assert/` · `decorator/` (`DecoratorRegistry`) · `error/` (`BaseErrorSerializer`) · `event-emitter/` (typed `EventEmitter`) · `lazy/` (`Lazy`, `LazyAsync`) · `logging/` (`Logger`, `LogLevel`, `LogCategory` — level-gated logging over `console.*`; static singleton in the `DecoratorRegistry` style, no DI; statics take the category per call (`Logger.info(LogCategory.Rpc, …)` — framework code's convention, with `LogCategory` as the typo-proof list), `Logger.create` bakes it in for hot paths; thresholds pushed in by `foundation` at boot) · `random/` · `global/` · `configuration/` (`NamedConfiguration`) · `file/` · `stream/` · `executable/` · `worker-queue/` (persisted-message types) · `cloudflare/` (`CloudflareRequest`).

## Relationship to other packages

Everything depends on `common`; `common` depends on nothing in the repo. When adding a utility, ask whether it's truly runtime-agnostic and dependency-free — if it needs framework context, DI, or Cloudflare bindings, it belongs in `foundation`, not here.
