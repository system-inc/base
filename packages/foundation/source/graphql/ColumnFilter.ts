// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ColumnFilterConditionOperator } from '@system-inc/base-common/graphql/ColumnFilterConditionOperator';
import { ColumnFilterInput as ColumnFilterInputInterface } from '@system-inc/base-common/graphql/ColumnFilterInput';
import { Json } from '@system-inc/base-common/json/Json';
import { GqlField } from './decorators/GqlField';
import { GqlInputType } from './decorators/GqlInputType';
import { GqlJson } from './types/GqlJson';
import { gqlRegisterEnumType } from './types/GqlRegisterEnumType';

export enum ColumnFilterGroupOperator {
    And = 'And',
    Or = 'Or',
    // TODO: figure out NOT
}

gqlRegisterEnumType(ColumnFilterGroupOperator, {
    name: 'ColumnFilterGroupOperator',
});

gqlRegisterEnumType(ColumnFilterConditionOperator, {
    name: 'ColumnFilterConditionOperator',
    description: 'The operator of a field filter',
});

@GqlInputType()
export class ColumnFilterGroupInput {
    // condition in group is OR / AND relations.
    @GqlField(() => ColumnFilterGroupOperator, { nullable: true })
    operator: ColumnFilterGroupOperator | null;

    @GqlField(() => [ColumnFilterInput], { nullable: true })
    conditions?: ColumnFilterInput[];

    @GqlField(() => [ColumnFilterGroupInput], { nullable: true })
    filters?: ColumnFilterGroupInput[];
}

@GqlInputType()
export class ColumnFilterInput implements ColumnFilterInputInterface {
    @GqlField(() => ColumnFilterConditionOperator)
    operator: ColumnFilterConditionOperator;

    // There is deliberately no `caseSensitive` field: nothing in the
    // filter pipeline reads one (matching follows the column collation),
    // and advertising an unread knob silently over-returned rows for
    // clients that set it. Reintroduce only together with per-dialect
    // BINARY/COLLATE compilation.

    @GqlField(() => String)
    column: string;

    @GqlField(() => GqlJson, { nullable: true })
    value: Json;
}
