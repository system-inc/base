// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseErrorSerializer } from '@system-inc/base-common/error/BaseErrorSerializer';
import { BaseErrorDataType } from '@system-inc/base-common/error/interfaces/BaseErrorDataType';
import { OrmValueTransformer } from '../orm/interfaces/OrmValueTransformer';

/**
 * Transforms between BaseError and IBaseError for ORM storage.
 */
export class BaseErrorSerializerOrmTransformer implements OrmValueTransformer<
    BaseErrorSerializer | null,
    BaseErrorDataType | null
> {
    constructor(readonly mode: 'client' | 'debug' = 'client') {}

    from(value: BaseErrorDataType | null): BaseErrorSerializer | null {
        if (value) {
            return new BaseErrorSerializer(value);
        }
        return null;
    }

    to(value: BaseErrorSerializer | null): BaseErrorDataType | null {
        if (value) {
            if (this.mode === 'client') {
                return value.toClientErrorData();
            }
            return value.error;
        }
        return null;
    }
}
