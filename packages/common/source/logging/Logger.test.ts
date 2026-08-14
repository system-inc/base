// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Logger } from './Logger';
import { LogLevel, parseLogLevel } from './LogLevel';

describe('LogLevel', () => {
    it('parses level names case-insensitively', () => {
        expect(parseLogLevel('debug')).toBe(LogLevel.Debug);
        expect(parseLogLevel('Info')).toBe(LogLevel.Info);
        expect(parseLogLevel('WARN')).toBe(LogLevel.Warn);
        expect(parseLogLevel(' error ')).toBe(LogLevel.Error);
        expect(parseLogLevel('off')).toBe(LogLevel.Off);
    });

    it('returns undefined for unrecognized names', () => {
        expect(parseLogLevel('verbose')).toBeUndefined();
        expect(parseLogLevel('')).toBeUndefined();
    });
});

// Logger state is process-global by design (one worker per process).
// Tests restore the default level they change and use per-test category
// names, since a category override sticks for the life of the module.
describe('Logger', () => {
    let debugSpy: jest.SpyInstance;
    let infoSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        debugSpy = jest.spyOn(console, 'debug').mockImplementation();
        infoSpy = jest.spyOn(console, 'info').mockImplementation();
        warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        errorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        Logger.setLevel(LogLevel.Info);
    });

    it('defaults to Info: debug is gated, info and above emit', () => {
        Logger.debug('t-default', 'hidden');
        Logger.info('t-default', 'shown');
        Logger.warn('t-default', 'shown');
        Logger.error('t-default', 'shown');
        expect(debugSpy).not.toHaveBeenCalled();
        expect(infoSpy).toHaveBeenCalledWith('[t-default] shown');
        expect(warnSpy).toHaveBeenCalledWith('[t-default] shown');
        expect(errorSpy).toHaveBeenCalledWith('[t-default] shown');
    });

    it('does not pass gated arguments to console at all', () => {
        const expensive = jest.fn(() => 'never built');
        // printf-style args are references — console never sees them when
        // the call is gated, so nothing downstream can format them
        Logger.debug('t-gated', 'value: %s', { toString: expensive });
        expect(debugSpy).not.toHaveBeenCalled();
        expect(expensive).not.toHaveBeenCalled();
    });

    it('statics and created instances share the same settings', () => {
        const logger = Logger.create('t-shared');
        Logger.setLevel(LogLevel.Debug, 't-shared');
        Logger.debug('t-shared', 'via static');
        logger.debug('via instance');
        expect(debugSpy).toHaveBeenCalledWith('[t-shared] via static');
        expect(debugSpy).toHaveBeenCalledWith('[t-shared] via instance');
    });

    it('setLevel changes the threshold for existing instances', () => {
        const logger = Logger.create('t-setlevel');
        Logger.setLevel(LogLevel.Warn);
        logger.info('hidden');
        expect(infoSpy).not.toHaveBeenCalled();
        Logger.setLevel(LogLevel.Debug);
        logger.debug('shown');
        expect(debugSpy).toHaveBeenCalledWith('[t-setlevel] shown');
    });

    it('Off silences everything including error', () => {
        Logger.setLevel(LogLevel.Off);
        Logger.error('t-off', 'hidden');
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('create returns the same instance per category', () => {
        expect(Logger.create('t-idempotent')).toBe(
            Logger.create('t-idempotent'),
        );
    });

    it('prefixes the category and passes format args through', () => {
        const logger = Logger.create('t-rpc');
        logger.info('RPC: %s', 'getNote');
        expect(infoSpy).toHaveBeenCalledWith('[t-rpc] RPC: %s', 'getNote');
    });

    it('category overrides win over the default level, in both directions', () => {
        const rpc = Logger.create('t-override-rpc');
        const orm = Logger.create('t-override-orm');
        Logger.setLevel(LogLevel.Warn);
        Logger.setLevel(LogLevel.Debug, 't-override-rpc');
        rpc.debug('shown');
        orm.info('hidden');
        expect(debugSpy).toHaveBeenCalledWith('[t-override-rpc] shown');
        expect(infoSpy).not.toHaveBeenCalled();
    });

    it('applies overrides set before the category logger is created', () => {
        Logger.setLevel(LogLevel.Debug, 't-created-later');
        const logger = Logger.create('t-created-later');
        logger.debug('shown');
        expect(debugSpy).toHaveBeenCalledWith('[t-created-later] shown');
    });

    it('isEnabled and isDebugEnabled reflect the effective level', () => {
        const logger = Logger.create('t-enabled');
        expect(logger.isDebugEnabled).toBe(false);
        expect(logger.isEnabled(LogLevel.Info)).toBe(true);
        Logger.setLevel(LogLevel.Debug, 't-enabled');
        expect(logger.isDebugEnabled).toBe(true);
    });

    describe('configure', () => {
        it('parses a bare level as the default threshold', () => {
            Logger.configure('warn');
            expect(Logger.getLevel()).toBe(LogLevel.Warn);
        });

        it('parses category overrides alongside the default', () => {
            Logger.configure('warn, t-conf-rpc=debug');
            expect(Logger.getLevel()).toBe(LogLevel.Warn);
            expect(Logger.getLevel('t-conf-rpc')).toBe(LogLevel.Debug);
            expect(Logger.getLevel('t-conf-orm')).toBe(LogLevel.Warn);
        });

        it('throws on an unknown level name', () => {
            expect(() => Logger.configure('verbose')).toThrow(
                /Unknown log level 'verbose'/,
            );
            expect(() => Logger.configure('t-conf-bad=loud')).toThrow(
                /Unknown log level 'loud'/,
            );
        });

        it('throws on a malformed entry', () => {
            expect(() => Logger.configure('a=b=c')).toThrow(
                /Invalid log level entry/,
            );
        });
    });
});
