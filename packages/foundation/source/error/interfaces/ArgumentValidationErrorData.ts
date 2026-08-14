// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    BaseErrorData,
    isBaseErrorData,
} from '@system-inc/base-common/error/interfaces/BaseErrorData';
import { StrictJsonInterface } from '@system-inc/base-common/json/StrictJson';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { ERROR_CODE_VALIDATION_ERROR } from '../ErrorCode';

/**
 * A JSON-serializable representation of a single validation failure.
 *
 * Mirrors the framework's runtime
 * {@link @base/foundation/validation/ValidationError | ValidationError}
 * in wire-friendly form: flat, path-addressed, with a map of failed
 * rule names to messages.
 */
export type ValidationErrorData = StrictJsonInterface<{
    /**
     * Dotted / bracketed path to the failing value from the root
     * (`"email"`, `"address.postalCode"`, `"items[2].sku"`).
     */
    path: string;

    /**
     * Map of failed rule name to human-readable message.
     */
    constraints: {
        [rule: string]: string;
    };
}>;

/**
 * A JSON-serializable representation of an argument validation error.
 */
export interface ArgumentValidationErrorData extends BaseErrorData {
    readonly name: 'ArgumentValidationError';
    readonly errorCode: typeof ERROR_CODE_VALIDATION_ERROR;
    readonly extensions: Readonly<Dictionary<string>> & {
        readonly validationErrors: ReadonlyArray<Readonly<ValidationErrorData>>;
    };
}

/**
 * Determines if the given error data is an ArgumentValidationErrorData.
 *
 * @param error The error to check.
 * @returns
 */
export function isArgumentValidationErrorData(
    error: unknown,
): error is ArgumentValidationErrorData {
    if (!isBaseErrorData(error)) {
        return false;
    }
    const argError = error as ArgumentValidationErrorData;
    return (
        argError.name === 'ArgumentValidationError' &&
        argError.errorCode === ERROR_CODE_VALIDATION_ERROR &&
        typeof argError.extensions === 'object' &&
        argError.extensions !== null &&
        'validationErrors' in argError.extensions &&
        Array.isArray(argError.extensions.validationErrors)
    );
}
