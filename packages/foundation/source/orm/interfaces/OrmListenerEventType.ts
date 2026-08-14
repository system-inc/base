// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export type OrmListenerEventType =
    | 'beforeInsert'
    | 'afterInsert'
    | 'beforeUpdate'
    | 'afterUpdate'
    | 'beforeDelete'
    | 'afterDelete'
    | 'afterLoad';

export type OrmListenerEventMap = {
    [K in OrmListenerEventType]: string[];
};
