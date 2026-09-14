// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { gqlYogaLogger } from './GqlYogaLogger';

describe('gqlYogaLogger', () => {
    const debug = jest.spyOn(Logger, 'debug').mockImplementation(() => {});
    const info = jest.spyOn(Logger, 'info').mockImplementation(() => {});
    const warn = jest.spyOn(Logger, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(Logger, 'error').mockImplementation(() => {});

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it('routes debug, info and warn to the gql category at the same level', () => {
        gqlYogaLogger.debug('starting', 1);
        gqlYogaLogger.info('ready');
        gqlYogaLogger.warn('slow', { ms: 20 });

        expect(debug).toHaveBeenCalledWith(LogCategory.Gql, 'starting', 1);
        expect(info).toHaveBeenCalledWith(LogCategory.Gql, 'ready');
        expect(warn).toHaveBeenCalledWith(LogCategory.Gql, 'slow', { ms: 20 });
    });

    it('demotes Yoga errors to debug, since gqlMaskError logs the real ones', () => {
        const thrown = new Error('Post port15060 not found');

        gqlYogaLogger.error(thrown);

        expect(error).not.toHaveBeenCalled();
        expect(debug).toHaveBeenCalledWith(LogCategory.Gql, '%o', thrown);
    });

    it('formats a non-string first argument instead of passing it as the message', () => {
        const value = { operation: 'post' };

        gqlYogaLogger.info(value, 'extra');

        expect(info).toHaveBeenCalledWith(
            LogCategory.Gql,
            '%o',
            value,
            'extra',
        );
    });
});
