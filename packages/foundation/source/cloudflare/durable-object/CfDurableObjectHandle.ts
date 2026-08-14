// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';

export type CfDurableObjectHandle<
    RpcInterface extends object = object,
    T extends Rpc.DurableObjectBranded = Rpc.DurableObjectBranded,
> = {
    binding: string;
    stub: DurableObjectStub<T>;
    rpc: RpcClient<RpcInterface>;
};
