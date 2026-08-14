// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import '@system-inc/base-foundation/startup/preload';

import { BaseWorker } from '@system-inc/base-foundation/worker/BaseWorker';
import { TestWorkerSettings } from './settings';

export default BaseWorker.create(TestWorkerSettings);
