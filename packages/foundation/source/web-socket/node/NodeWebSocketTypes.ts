// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type WebSocket as WsWebSocket } from 'ws';

/**
 * NodeWebSocket is the WebSocket implementation that is used on the Node
 * platform. It lives in the node subtree (not the shared WebSocketTypes)
 * because importing `ws` pulls in `@types/ws` → `@types/node`, which would
 * leak Node globals into worker-path code.
 */
export type NodeWebSocket = WsWebSocket;
