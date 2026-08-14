// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmIntegerSizeType } from '../interfaces/OrmIntegerLengthType';

export type OrmPrimaryAutoColumnMetadata =
    | OrmPrimaryAutoSerialColumnMetadata
    | OrmPrimaryAutoUuidColumnMetadata;

export interface OrmPrimaryAutoSerialColumnMetadata {
    propertyKey: string;
    strategy: 'serial';
    size?: OrmIntegerSizeType;
}

export interface OrmPrimaryAutoUuidColumnMetadata {
    propertyKey: string;
    strategy: 'uuid';
}
