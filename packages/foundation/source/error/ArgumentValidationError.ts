// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HttpStatusCode } from '@system-inc/base-common/http/HttpStatus';
import { ValidationError } from '../validation/ValidationError';
import { BaseError, BaseErrorOptions } from './BaseError';
import { ERROR_CODE_VALIDATION_ERROR } from './ErrorCode';
import { ValidationErrorData } from './interfaces/ArgumentValidationErrorData';

/**
 * An error type that represents an error during validation.
 *
 * Accepts either the framework's runtime {@link ValidationError}
 * (from `foundation/validation`) or its wire-form
 * {@link ValidationErrorData} counterpart — both shape-compatible
 * for simple pass-through.
 */
export class ArgumentValidationError extends BaseError {
    readonly extensions: {
        validationErrors: ReadonlyArray<Readonly<ValidationErrorData>>;
    };

    get validationErrors(): ReadonlyArray<Readonly<ValidationErrorData>> {
        return this.extensions.validationErrors;
    }

    constructor(
        validationData: ValidationErrorData | ValidationErrorData[],
        options?: BaseErrorOptions,
    );
    constructor(
        validationErrors: ValidationError | ValidationError[],
        options?: BaseErrorOptions,
    );
    constructor(
        validationErrorsOrData:
            | ValidationErrorData
            | ValidationErrorData[]
            | ValidationError
            | ValidationError[],
        options?: BaseErrorOptions,
    ) {
        super(`Argument Validation Error`, {
            ...options,
            name: 'ArgumentValidationError',
            errorCode: ERROR_CODE_VALIDATION_ERROR,
            statusCode: HttpStatusCode.UnprocessableEntity,
            extensions: {
                validationErrors: toValidationErrorData(validationErrorsOrData),
            },
        });
    }
}

function toValidationErrorData(
    input:
        | ValidationErrorData
        | ValidationErrorData[]
        | ValidationError
        | ValidationError[],
): ValidationErrorData[] {
    const items = Array.isArray(input) ? input : [input];
    return items.map((item) => ({
        path: item.path,
        constraints: item.constraints ?? {},
    }));
}
