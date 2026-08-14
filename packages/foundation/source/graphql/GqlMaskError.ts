// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { defaultMaskError } from '@envelop/core';
import { GraphQLError } from 'graphql';

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { BaseError } from '../error/BaseError';

export function gqlMaskError(
    error: unknown,
    defaultErrorMessage: string,
): Error {
    if (!(error instanceof GraphQLError)) {
        return defaultMaskError(error, defaultErrorMessage);
    }

    const original = error.originalError;
    if (!original || original instanceof GraphQLError) {
        return defaultMaskError(error, defaultErrorMessage);
    }

    const { safe, raw, masked } = BaseError.forClient(
        original,
        defaultErrorMessage,
    );
    if (masked) {
        Logger.error(LogCategory.Gql, '%o', raw);
    }
    return new GraphQLError(safe.message, {
        path: error.path,
        extensions: {
            baseError: safe,
        },
    });
}
