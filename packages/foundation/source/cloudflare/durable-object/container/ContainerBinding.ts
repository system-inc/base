// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TypedBinding } from '../../../dependency-injection/TypedBinding';

/**
 * Binding for a Cloudflare Container namespace. The name matches the
 * binding declared in `wrangler.toml`. Used with
 * `@InjectContainerProvider(...)`.
 */
export class ContainerBinding extends TypedBinding {
    declare private readonly __container: 'Container';
}
