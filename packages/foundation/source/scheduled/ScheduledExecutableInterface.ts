// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Executable } from '@system-inc/base-common/executable/Executable';
import { ScheduledExecutableContext } from './ScheduledExecutableContext';

/**
 * Represents an executable that can be scheduled to run at a specific time.
 */
export type ScheduledExecutableInterface = Executable<
    [ScheduledExecutableContext]
>;
