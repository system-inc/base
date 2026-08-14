// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TimeInterval } from '@system-inc/base-common/time/TimeInterval';
import { VerifyIsDate } from '../validation/decorators/VerifyIsDate';
import { VerifyIsEnum } from '../validation/decorators/VerifyIsEnum';
import { VerifyIsNotEmpty } from '../validation/decorators/VerifyIsNotEmpty';
import { VerifyIsNumber } from '../validation/decorators/VerifyIsNumber';
import { VerifyIsOptional } from '../validation/decorators/VerifyIsOptional';
import { VerifyIsString } from '../validation/decorators/VerifyIsString';
import { VerifyMin } from '../validation/decorators/VerifyMin';
import { GqlField } from './decorators/GqlField';
import { GqlInputType } from './decorators/GqlInputType';
import { GqlObjectType } from './decorators/GqlObjectType';
import { gqlRegisterEnumType } from './types/GqlRegisterEnumType';

gqlRegisterEnumType(TimeInterval, { name: 'TimeInterval' });

@GqlInputType()
export abstract class TimeSeriesInput {
    @VerifyIsDate()
    @GqlField(() => Date)
    startAtUtc: Date;

    @VerifyIsDate()
    @GqlField(() => Date)
    endAtUtc: Date;

    @VerifyIsEnum(TimeInterval)
    @GqlField(() => TimeInterval)
    interval: TimeInterval;

    @VerifyIsOptional()
    @VerifyIsString()
    @VerifyIsNotEmpty()
    @GqlField(() => String, {
        nullable: true,
        description:
            'IANA timezone (e.g., "America/New_York"). If provided, buckets will be aligned to this timezone.',
    })
    timeZone?: string;

    @VerifyIsOptional()
    @VerifyIsNumber()
    @VerifyMin(1)
    @GqlField(() => Number, { nullable: true })
    limit?: number;

    @VerifyIsOptional()
    @VerifyIsNumber()
    @GqlField(() => Number, { nullable: true })
    offset?: number;
}

@GqlObjectType()
export class TimeSeriesFilterKey {
    @GqlField(() => String)
    key: string;

    @GqlField(() => Number)
    count: number;
}

@GqlObjectType()
export class TimeSeriesDataPoint {
    @GqlField(() => String)
    bucket: string;

    @GqlField(() => [TimeSeriesFilterKey])
    filterKeys: TimeSeriesFilterKey[];

    @GqlField(() => Number)
    total: number;
}
