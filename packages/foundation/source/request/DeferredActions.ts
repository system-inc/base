// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export interface DeferredActions {
    append(action: () => Promise<unknown>): void;
}
