# concurrent/ — async & concurrency primitives

Promise-based building blocks for coordinating async work — backoff/retry, batching, rate-limiting, and synchronization. All runtime-agnostic (Node + Workers). Each is its own file (no barrel); import the one you need.

## Which to use

| Need                                                            | Use                       |
| --------------------------------------------------------------- | ------------------------- |
| Compute the next exponential-backoff delay                      | `Backoff` (`backoffNext`) |
| Retry an operation with backoff until it succeeds/gives up      | `BackoffTask`             |
| Accumulate items and flush them in batches (by size or timeout) | `BatchingQueue<T>`        |
| Cap how many operations run at once                             | `CountingSemaphore`       |
| Wait until N operations have completed                          | `CountdownLatch`          |
| Wait for a set of promises to all settle                        | `PromiseBarrier`          |
| Race a group of promises — resolve on the first                 | `PromiseGroup<T>`         |
| A promise you resolve/reject from the outside and can inspect   | `TrackedPromise`          |
| Sleep for a fixed / random duration                             | `Sleep` / `RandomSleep`   |

## Notes

- **`CountingSemaphore`** backs the scheduled-executable concurrency limit in foundation (`ScheduledRunner`).
- **`BatchingQueue`** is the batching pattern the worker-queue producer uses conceptually (collect, then flush once).
- **`Backoff`/`BackoffTask`** underpin retry behavior, including the RPC client's retry loop in [`base-client`](../../../client/CLAUDE.md).
- **`TrackedPromise`** exposes its state (pending/resolved/rejected) and can be settled externally — useful for bridging callback/event APIs into promises.

These are plain utilities: no DI, no framework context. If a primitive needs request scope or config, that belongs in `foundation`, not here.
