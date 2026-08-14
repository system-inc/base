# internal/ — framework machinery (not public API)

The runtime/dispatch implementation behind the public subsystems. **Nothing here is exported** from the package, and consumer code (and code in other subsystems) must not import from `internal/` — the `nexus/no-internal-imports-rule` boundary (from `@system-inc/nexus`, enabled via `base-lint`) and the public-vs-`internal` convention exist precisely to keep this private. It's documented here as an orientation map, not as API.

Each `internal/` folder is the engine for the like-named public folder; read the public folder's doc for the concepts and use this table to find where the work happens.

| `internal/` folder      | What it implements                                                                                                                                                     | Public doc                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `dependency-injection/` | Container creation/scoping (`getGlobalContainer`, `createWorkerContainer`, `createWorkerChildContainer`, `setupBaseContainer`)                                         | [`dependency-injection/`](../dependency-injection/CLAUDE.md)           |
| `request/`              | `BaseRequest`/`InternalBaseRequest`, `BaseRequestContext`, `DeferredExecutor`, `RequestTimings`, `ResponseWriter` impl                                                 | [`router/`](../router/CLAUDE.md)                                       |
| `router/`               | `BaseRouter` (itty dispatch, arg binding, CORS), `DummyRouter`, route metadata                                                                                         | [`router/`](../router/CLAUDE.md)                                       |
| `middleware/`           | Global + handler middleware execution                                                                                                                                  | [`router/`](../router/CLAUDE.md)                                       |
| `access-control/`       | Session-access enforcement (metadata registry, middleware, boot-time provider validation)                                                                              | [`access-control/`](../access-control/CLAUDE.md)                       |
| `graphql/`              | `GqlDispatcher`, `GqlContext`, `GqlMiddleware`                                                                                                                         | [`graphql/`](../graphql/CLAUDE.md)                                     |
| `rpc/`                  | `RpcDispatcher`, RPC metadata                                                                                                                                          | [`rpc/`](../rpc/CLAUDE.md)                                             |
| `queue/`                | `WorkerQueueConsumer`, `WorkerQueueService` (producer batching), queue drivers                                                                                         | [`queue/`](../queue/CLAUDE.md)                                         |
| `scheduled/`            | `ScheduledRunner`                                                                                                                                                      | [`scheduled/`](../scheduled/CLAUDE.md)                                 |
| `web-socket/`           | `WebSocketService`                                                                                                                                                     | [`web-socket/`](../web-socket/CLAUDE.md)                               |
| `cloudflare/`           | `CloudflarePlatformDelegate`                                                                                                                                           | [`base/`](../base/CLAUDE.md)                                           |
| `node/`                 | `NodePlatformDelegate`                                                                                                                                                 | [`base/`](../base/CLAUDE.md)                                           |
| `execution-context/`    | `BaseExecutionContext` (`waitUntil`, stopwatch)                                                                                                                        | [`base/`](../base/CLAUDE.md)                                           |
| `metadata/`             | The metadata stores held by `BaseMetadata` (`GqlMetadata`, `WorkerQueueMetadata`, `ScheduledMetadata`, `MiddlewareMetadata`, `EventBusMetadata`, `ValidationMetadata`) | [`base/`](../base/CLAUDE.md), [`validation/`](../validation/CLAUDE.md) |

## See also

The [foundation package doc](../../CLAUDE.md#key-design-choices) explains the public-folder + `internal/` split that this folder is one half of.
