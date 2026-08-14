// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { Container } from '@cloudflare/containers';

import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';

export type CfContainerHandle<
    RpcInterface extends object = object,
    ContainerEnv extends object = object,
> = {
    binding: string;
    container: DurableObjectStub<Container<ContainerEnv>>;
    rpc: RpcClient<RpcInterface>;
};
