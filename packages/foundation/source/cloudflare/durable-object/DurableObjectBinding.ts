// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TypedBinding } from '../../dependency-injection/TypedBinding';

/**
 * Binding for a Cloudflare Durable Object namespace. The name matches
 * the binding declared in `wrangler.toml`. Used with
 * `@InjectDurableObjectProvider(...)`.
 *
 * The `RpcInterface` parameter is the RPC type exposed by the durable
 * object class; the lint rule and decorator return type thread it
 * through as `CfDurableObjectProvider<RpcInterface, StubRpcInterface>`.
 */
export class DurableObjectBinding<
    RpcInterface extends object = object,
    StubRpcInterface extends Rpc.DurableObjectBranded =
        Rpc.DurableObjectBranded,
> extends TypedBinding {
    declare private readonly __durableObject: [RpcInterface, StubRpcInterface];
}
