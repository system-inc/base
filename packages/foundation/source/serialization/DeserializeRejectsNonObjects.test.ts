// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseError } from '../error/BaseError';
import { ERROR_CODE_SERIALIZATION_ERROR } from '../error/ErrorCode';
import { SerializableField } from './decorators/SerializableField';
import { SerializableObject } from './decorators/SerializableObject';
import { deserialize } from './Deserialize';

@SerializableObject()
class Address {
    @SerializableField(() => String)
    city!: string;
}

@SerializableObject()
class Customer {
    @SerializableField(() => String)
    name!: string;

    @SerializableField(() => Address, { optional: true })
    address?: Address;
}

function expectBadRequest(run: () => unknown, message: RegExp): void {
    let thrown: unknown;
    try {
        run();
    } catch (error) {
        thrown = error;
    }
    expect(thrown).toBeInstanceOf(BaseError);
    expect((thrown as BaseError).statusCode).toBe(400);
    expect((thrown as BaseError).errorCode).toBe(
        ERROR_CODE_SERIALIZATION_ERROR,
    );
    expect((thrown as BaseError).message).toMatch(message);
}

/**
 * A client-sent primitive where a class is expected reached the field
 * loop, where `fieldName in raw` threw a TypeError — a 500 (logged as an
 * unhandled exception) for what is a malformed request.
 */
describe('deserialize rejects a non-object for a class', () => {
    it.each([
        ['a string', 'abc'],
        ['a number', 5],
        ['a boolean', true],
    ])('400s on %s at the top level', (_label, raw) => {
        expectBadRequest(
            () => deserialize(raw, () => Customer),
            /Expected an object for Customer/,
        );
    });

    it('400s on a primitive in a nested class field', () => {
        expectBadRequest(
            () =>
                deserialize({ name: 'Ada', address: 'Paris' }, () => Customer),
            /Expected an object for Address/,
        );
    });

    it('400s on an array where the TypeFunc declares a single object', () => {
        expectBadRequest(
            () => deserialize([{ name: 'Ada' }], () => Customer),
            /Expected an object for Customer, got an array/,
        );
    });

    it('still deserializes an array where the TypeFunc declares one', () => {
        const result = deserialize([{ name: 'Ada' }], () => [Customer]);
        expect(result).toEqual([expect.any(Customer)]);
    });

    it('still deserializes a well-formed object', () => {
        const result = deserialize(
            { name: 'Ada', address: { city: 'Paris' } },
            () => Customer,
        );
        expect(result?.address).toBeInstanceOf(Address);
        expect(result?.address?.city).toBe('Paris');
    });
});
