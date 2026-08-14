// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumnType } from './OrmColumnType';
import { OrmValueTransformer } from './OrmValueTransformer';

export type OrmColumnOptions<
    T extends OrmColumnType['kind'] = OrmColumnType['kind'],
> = {
    name?: string;
    comment?: string;

    nullable?: boolean;
    unique?: boolean;
    primaryKey?: boolean;

    default?: DefaultValueType<T> | (() => DefaultValueType<T>);

    transformer?: OrmValueTransformer;

    // This is used for foreign key references
    // Currently not implemented in the ORM
    // references?: { table: () => Constructor; column: string };
};

type DefaultValueType<T extends OrmColumnType['kind']> = T extends
    | 'integer'
    | 'bigint'
    | 'float'
    | 'double'
    ? number
    : T extends 'decimal'
      ? string | number
      : T extends 'boolean'
        ? boolean
        : T extends 'char' | 'varchar'
          ? string
          : T extends 'text'
            ? string
            : T extends 'bytes'
              ? Uint8Array
              : T extends 'datetime'
                ? Date | string
                : T extends 'uuid'
                  ? string
                  : never;
