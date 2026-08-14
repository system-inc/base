// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import '@system-inc/base-foundation/startup/preload';

import { CfDurableObject } from '@system-inc/base-foundation/cloudflare/durable-object/core/CfDurableObject';
import { CfDurableObjectWorker } from '@system-inc/base-foundation/cloudflare/durable-object/core/CfDurableObjectWorker';
import { BaseDurableSettings } from './settings';

export class BaseDurableObject extends CfDurableObject {
    settings = BaseDurableSettings;
}

export default new CfDurableObjectWorker(BaseDurableObject);
