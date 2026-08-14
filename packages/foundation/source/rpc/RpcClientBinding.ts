// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TypedBinding } from '../dependency-injection/TypedBinding';

/**
 * Binding for a Cloudflare service binding (RPC). The name matches the
 * binding declared in `wrangler.toml`. Used with `@InjectRpcClient(...)`.
 *
 * The `RpcInterface` parameter is the RPC type exposed by the target
 * service; the decorator return type threads it through as
 * `RpcClient<RpcInterface>`.
 */
export class RpcClientBinding<
    RpcInterface extends object = object,
> extends TypedBinding {
    declare private readonly __rpcClient: RpcInterface;
}
