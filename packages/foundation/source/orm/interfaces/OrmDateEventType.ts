// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export type OrmDateEventType = 'create' | 'update';

export type OrmDateEventMap = {
    [K in OrmDateEventType]: string[];
};
