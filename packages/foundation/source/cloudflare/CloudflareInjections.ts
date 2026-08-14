// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TypedInjectionKey } from '../dependency-injection/TypedInjectionKey';

/**
 * Injections specific to Cloudflare Workers / Cloudflare environments such as Durable Objects.
 */
export namespace CloudflareInjections {
    /**
     * When running in the CloudflareDurableObject PlatformType,
     * provides the DurableObjectState of the DurableObject.
     */
    export const DurableObjectState = new TypedInjectionKey<DurableObjectState>(
        'CloudflareInjections.DurableObjectState',
    );
}
