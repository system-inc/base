// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';

export type RpcClientIdGenerator = (rpc: Omit<RpcCall, 'id'>) => string;
