// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Type that defines the visibility of an RPC service.
 * - 'public': The RPC service is callable from a public route.
 * - 'internal': The RPC service is only callable from a bound worker.
 */
export type RpcVisibility = 'public' | 'internal';
