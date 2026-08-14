// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { GraphQLScalarType } from 'graphql';

import { LogCategory } from '../logging/LogCategory';
import { Logger } from '../logging/Logger';

export class TypedJson {
    type: string;
    value: any;
}

export class TypedJsonTransformer {
    /**
     * Used to marshal TypedJson when writing to the database.
     */
    to(value?: TypedJson): string | null {
        if (value === undefined || value === null) {
            return null;
        }
        return JSON.stringify(value);
    }

    /**
     * Used to unmarshal Decimal when reading from the database.
     */
    from(rawValue?: string | null): TypedJson | null {
        if (rawValue === undefined || rawValue === null) {
            return null;
        }
        try {
            return JSON.parse(rawValue) as TypedJson;
        } catch (error) {
            Logger.error(
                LogCategory.Common,
                'Error parsing TypedJson from database',
                error,
            );
            return null;
        }
    }
}

export const TypedJsonScalar = new GraphQLScalarType({
    name: 'TypedJson',
    description:
        'Typed JSON custom scalar type, we stored the json as string (with type) in datebase, but we will return the json value object when read.',
    serialize(value: unknown): any {
        // Match on structural shape, not `instanceof`: values read from the
        // database come through TypedJsonTransformer.from -> JSON.parse, which
        // yields a plain { type, value } object that is never an instance of
        // the TypedJson class.
        if (
            value === null ||
            typeof value !== 'object' ||
            !('type' in value) ||
            !('value' in value)
        ) {
            throw new Error(
                'TypedJsonScalar can only serialize TypedJson values',
            );
        }
        return (value as TypedJson).value;
    },
    parseValue(value: unknown): TypedJson {
        return {
            type: typeof value,
            value: value,
        };
    },
    parseLiteral(_ast): TypedJson {
        throw new Error('TypedJsonScalar not support parseLiteral');
    },
});
