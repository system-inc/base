// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { WebSocketContextMapping } from './WebSocketContextMapping';
import { WebSocketDelegate } from './WebSocketDelegate';

export interface WebSocketSettings {
    readonly delegates: WebSocketDelegateSettings[];

    /**
     * RC → WS key mappings aggregated across all modules. Applied to
     * `WebSocketInfo.context` at connect time.
     *
     * Populated from module settings via {@link BaseAppManifest}; app
     * code generally does not need to set this directly.
     */
    readonly mappings?: WebSocketContextMapping[];
}

export interface WebSocketDelegateSettings {
    readonly name: string;
    readonly path: string;
    readonly delegate: Constructor<WebSocketDelegate>;
    readonly rpcEndpoint?: string;
}
