// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseError } from '../../error/BaseError';
import { resolveExplicitObjectId } from './CfDurableObjectId';
import { CfDurableObjectInput } from './CfDurableObjectInput';

describe('resolveExplicitObjectId', () => {
    function makeNamespace() {
        return {
            idFromString: jest.fn((id: string) => ({ kind: 'string', id })),
            idFromName: jest.fn((name: string) => ({ kind: 'name', name })),
        };
    }

    it('resolves an id via idFromString', () => {
        const namespace = makeNamespace();
        const result = resolveExplicitObjectId(
            namespace as never,
            { id: 'abc123' } as CfDurableObjectInput,
        );
        expect(namespace.idFromString).toHaveBeenCalledWith('abc123');
        expect(namespace.idFromName).not.toHaveBeenCalled();
        expect(result).toEqual({ kind: 'string', id: 'abc123' });
    });

    it('resolves a name via idFromName', () => {
        const namespace = makeNamespace();
        const result = resolveExplicitObjectId(
            namespace as never,
            { name: 'room-42' } as CfDurableObjectInput,
        );
        expect(namespace.idFromName).toHaveBeenCalledWith('room-42');
        expect(namespace.idFromString).not.toHaveBeenCalled();
        expect(result).toEqual({ kind: 'name', name: 'room-42' });
    });

    it('returns undefined when no input is supplied (caller picks a default)', () => {
        const namespace = makeNamespace();
        expect(resolveExplicitObjectId(namespace as never, undefined)).toBe(
            undefined,
        );
        expect(namespace.idFromString).not.toHaveBeenCalled();
        expect(namespace.idFromName).not.toHaveBeenCalled();
    });

    it('rejects an empty-string id rather than falling through to a default', () => {
        const namespace = makeNamespace();
        expect(() =>
            resolveExplicitObjectId(
                namespace as never,
                {
                    id: '',
                } as CfDurableObjectInput,
            ),
        ).toThrow(BaseError);
        expect(namespace.idFromString).not.toHaveBeenCalled();
    });

    it('rejects an empty-string name', () => {
        const namespace = makeNamespace();
        expect(() =>
            resolveExplicitObjectId(
                namespace as never,
                {
                    name: '',
                } as CfDurableObjectInput,
            ),
        ).toThrow(BaseError);
        expect(namespace.idFromName).not.toHaveBeenCalled();
    });
});
