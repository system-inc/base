// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Decimal } from 'decimal.js';

/**
 * The monetary decimal is a decimal that is always in cent. (e.g. 1.23 dollar will be stored as 123)
 */
export namespace MonetaryDecimal {
    export type Type = number | Decimal | MonetaryDecimal;
}

export class MonetaryDecimal {
    private readonly decimal: Decimal;

    constructor(cents: number | string | Decimal | MonetaryDecimal) {
        if (cents instanceof MonetaryDecimal) {
            this.decimal = new Decimal(cents.decimal);
        } else {
            this.decimal = new Decimal(cents);
        }
        if (!this.decimal.isInteger()) {
            throw new Error(
                'MonetaryDecimal can only accept integer[cent] values',
            );
        }
    }

    toNumber() {
        return this.decimal.toNumber();
    }

    toString(): string {
        return this.decimal.toString();
    }

    equals(value: MonetaryDecimal.Type) {
        return this.decimal.equals(
            value instanceof MonetaryDecimal ? value.decimal : value,
        );
    }

    notEquals(value: MonetaryDecimal.Type) {
        return !this.equals(value);
    }

    /**
     * minus and plus would expect integer value
     * @param value
     * @returns
     */
    minus(value: MonetaryDecimal) {
        return new MonetaryDecimal(
            this.decimal.minus(
                value instanceof MonetaryDecimal ? value.decimal : value,
            ),
        );
    }

    plus(value: MonetaryDecimal) {
        return new MonetaryDecimal(
            this.decimal.plus(
                value instanceof MonetaryDecimal ? value.decimal : value,
            ),
        );
    }
    /**
     * times will floor the floating point value (as our accuracy is at most 2 decimal places)
     * @param value
     * @returns
     */
    times(value: MonetaryDecimal.Type) {
        return new MonetaryDecimal(
            this.decimal
                .times(value instanceof MonetaryDecimal ? value.decimal : value)
                .floor(),
        );
    }
    /**
     * div will floor the floating point value (as our accuracy is at most 2 decimal places
     * NOTE: this is not meant to be used to convert to dollar value, use toCurrencyValue instead
     * @param value
     * @returns
     */
    div(value: MonetaryDecimal.Type) {
        return new MonetaryDecimal(
            this.decimal
                .div(value instanceof MonetaryDecimal ? value.decimal : value)
                .floor(),
        );
    }

    /**
     * Converts the monetary decimal to a currency value (e.g. 123 cents -> 1.23 dollar)
     */
    toDollarAmount(): number {
        return new Decimal(this.decimal.div(100).toFixed(2)).toNumber();
    }

    static max(...values: MonetaryDecimal[]) {
        const vals = values.map((value) => value.decimal);
        return new MonetaryDecimal(Decimal.max(...vals));
    }

    static min(...values: MonetaryDecimal[]) {
        const vals = values.map((value) => value.decimal);
        return new MonetaryDecimal(Decimal.min(...vals));
    }

    static clamp(
        value: MonetaryDecimal,
        min: MonetaryDecimal,
        max: MonetaryDecimal,
    ) {
        return new MonetaryDecimal(
            Decimal.clamp(value.decimal, min.decimal, max.decimal),
        );
    }
}

export class MonetaryDecimalTransformer {
    /**
     * Used to marshal MonetaryDecimal when writing to the database. This will guarantee the write in cent
     */
    to(decimal?: MonetaryDecimal): string | null {
        return decimal?.toString() ?? null;
    }
    /**
     * Used to unmarshal MonetaryDecimal when reading from the database.
     */
    from(decimal?: string | null): MonetaryDecimal | null {
        return decimal === undefined || decimal === null
            ? null
            : new MonetaryDecimal(decimal);
    }
}
