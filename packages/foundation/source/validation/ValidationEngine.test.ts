// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyArrayMinSize } from './decorators/VerifyArrayMinSize';
import { VerifyIsArray } from './decorators/VerifyIsArray';
import { VerifyIsNotEmpty } from './decorators/VerifyIsNotEmpty';
import { VerifyIsOptional } from './decorators/VerifyIsOptional';
import { VerifyIsString } from './decorators/VerifyIsString';
import { VerifyMaxLength } from './decorators/VerifyMaxLength';
import { validate } from './ValidationEngine';

describe('ValidationEngine', () => {
    describe('single-property rules', () => {
        class StringOnly {
            @VerifyIsString()
            name!: string;
        }

        test('passes when the rule holds', async () => {
            const value = new StringOnly();
            value.name = 'ok';
            const errors = await validate(value);
            expect(errors).toEqual([]);
        });

        test('fails with path, value, and constraint name', async () => {
            const value = new StringOnly();
            (value as unknown as { name: number }).name = 42;
            const errors = await validate(value);
            expect(errors).toHaveLength(1);
            expect(errors[0]).toEqual({
                path: 'name',
                value: 42,
                constraints: { IsString: 'name must be a string' },
            });
        });

        test('merges multiple rule failures under a single path', async () => {
            class TwoRules {
                @VerifyIsString()
                @VerifyMaxLength(3)
                // eslint-disable-next-line base/verify-optional-parity -- `unknown` is intentional: the test assigns a number to verify both rules fire
                code!: unknown;
            }
            const value = new TwoRules();
            value.code = 123456;
            const errors = await validate(value);
            expect(errors).toHaveLength(1);
            expect(errors[0].path).toBe('code');
            expect(Object.keys(errors[0].constraints).sort()).toEqual([
                'IsString',
                'MaxLength',
            ]);
        });
    });

    describe('IsOptional short-circuit', () => {
        class OptionalField {
            @VerifyIsOptional()
            @VerifyIsString()
            nickname?: string;
        }

        test('skips other rules when value is undefined', async () => {
            const value = new OptionalField();
            const errors = await validate(value);
            expect(errors).toEqual([]);
        });

        test('skips other rules when value is null', async () => {
            const value = new OptionalField();
            (value as unknown as { nickname: null }).nickname = null;
            const errors = await validate(value);
            expect(errors).toEqual([]);
        });

        test('runs other rules when value is present', async () => {
            const value = new OptionalField();
            (value as unknown as { nickname: number }).nickname = 42;
            const errors = await validate(value);
            expect(errors).toHaveLength(1);
            expect(errors[0].constraints.IsString).toBeDefined();
        });
    });

    describe('nested by default', () => {
        class Address {
            @VerifyIsString()
            city!: string;
        }

        class Order {
            @VerifyIsString()
            orderId!: string;

            // Deliberately NO @VerifyNested — it shouldn't exist.
            shipTo!: Address;
        }

        test('walks into a nested class instance without opt-in', async () => {
            const order = new Order();
            order.orderId = 'abc';
            order.shipTo = Object.assign(new Address(), {
                city: 42 as unknown as string,
            });
            const errors = await validate(order);
            expect(errors).toHaveLength(1);
            expect(errors[0].path).toBe('shipTo.city');
            expect(errors[0].constraints.IsString).toBeDefined();
        });

        test('walks into nested arrays of class instances', async () => {
            class Shipment {
                @VerifyIsString()
                carrier!: string;
            }
            class MultiShip {
                shipments!: Shipment[];
            }
            const value = new MultiShip();
            value.shipments = [
                Object.assign(new Shipment(), { carrier: 'ok' }),
                Object.assign(new Shipment(), {
                    carrier: 42 as unknown as string,
                }),
            ];
            const errors = await validate(value);
            expect(errors).toHaveLength(1);
            expect(errors[0].path).toBe('shipments[1].carrier');
        });

        test('walks through intermediate rule-less objects', async () => {
            class Leaf {
                @VerifyIsString()
                value!: string;
            }
            class Middle {
                leaf!: Leaf;
            }
            class Outer {
                middle!: Middle;
            }
            const outer = new Outer();
            outer.middle = new Middle();
            outer.middle.leaf = Object.assign(new Leaf(), {
                value: 42 as unknown as string,
            });
            const errors = await validate(outer);
            expect(errors).toHaveLength(1);
            expect(errors[0].path).toBe('middle.leaf.value');
        });
    });

    describe('array auto-iteration', () => {
        class StringList {
            // an array-level rule declares the property IS an array, so the
            // value-level @VerifyIsString applies to each element
            @VerifyIsArray()
            @VerifyIsString()
            tags!: string[];
        }

        test('applies value-level rules per element', async () => {
            const value = new StringList();
            value.tags = ['a', 42 as unknown as string, 'c'];
            const errors = await validate(value);
            expect(errors).toHaveLength(1);
            expect(errors[0].path).toBe('tags[1]');
        });

        test('rejects an array on a scalar property instead of iterating it', async () => {
            class ScalarField {
                // no array-level rule: an array value must fail, not iterate
                @VerifyIsString()
                name!: string;
            }
            const value = new ScalarField();
            (value as { name: unknown }).name = ['a', 'b'];
            const errors = await validate(value);
            expect(errors).toHaveLength(1);
            expect(errors[0].path).toBe('name');
        });

        test('an empty array does not bypass the rules on a scalar property', async () => {
            class ScalarField {
                @VerifyIsString()
                name!: string;
            }
            const value = new ScalarField();
            // the total-bypass attack: an empty array iterated zero times
            (value as { name: unknown }).name = [];
            const errors = await validate(value);
            expect(errors).toHaveLength(1);
            expect(errors[0].path).toBe('name');
        });

        test('array-level rules see the whole array', async () => {
            class AtLeastOne {
                @VerifyArrayMinSize(1)
                items!: string[];
            }
            const value = new AtLeastOne();
            value.items = [];
            const errors = await validate(value);
            expect(errors).toHaveLength(1);
            expect(errors[0].path).toBe('items');
            expect(errors[0].constraints.ArrayMinSize).toBeDefined();
        });

        test('array-level rule passes on a valid array', async () => {
            class ShapeCheck {
                @VerifyIsArray()
                // eslint-disable-next-line base/verify-optional-parity -- `unknown` is intentional: the test assigns runtime values to verify @VerifyIsArray
                items!: unknown;
            }
            const value = new ShapeCheck();
            value.items = [1, 2, 3];
            const errors = await validate(value);
            expect(errors).toEqual([]);
        });

        test('array-level rule fails on a non-array', async () => {
            class ShapeCheck {
                @VerifyIsArray()
                // eslint-disable-next-line base/verify-optional-parity -- `unknown` is intentional: the test assigns a non-array to verify @VerifyIsArray rejects it
                items!: unknown;
            }
            const value = new ShapeCheck();
            value.items = 'not an array';
            const errors = await validate(value);
            expect(errors).toHaveLength(1);
            expect(errors[0].constraints.IsArray).toBeDefined();
        });
    });

    describe('IsNotEmpty is container-level', () => {
        test('rejects an empty array (evaluates the array, not its elements)', async () => {
            class RequiredList {
                @VerifyIsNotEmpty()
                items!: string[];
            }
            const value = new RequiredList();
            value.items = [];
            const errors = await validate(value);
            expect(errors).toHaveLength(1);
            expect(errors[0].path).toBe('items');
            expect(errors[0].constraints.IsNotEmpty).toBeDefined();
        });

        test('passes a non-empty array', async () => {
            class RequiredList {
                @VerifyIsNotEmpty()
                items!: string[];
            }
            const value = new RequiredList();
            value.items = ['a'];
            expect(await validate(value)).toEqual([]);
        });

        test('still checks the container when combined with an array-level rule and per-element rules', async () => {
            class Emails {
                @VerifyIsArray()
                @VerifyIsNotEmpty()
                @VerifyIsString()
                addresses!: string[];
            }
            const empty = new Emails();
            empty.addresses = [];
            const emptyErrors = await validate(empty);
            // empty array is rejected by IsNotEmpty even though the property is
            // array-declared (previously it iterated zero elements and passed)
            expect(emptyErrors.some((e) => e.constraints.IsNotEmpty)).toBe(
                true,
            );

            // and per-element string validation still applies
            const badElement = new Emails();
            badElement.addresses = [42 as unknown as string];
            const elementErrors = await validate(badElement);
            expect(elementErrors.some((e) => e.path === 'addresses[0]')).toBe(
                true,
            );
        });

        test('rejects an empty string on a scalar property', async () => {
            class Name {
                @VerifyIsNotEmpty()
                value!: string;
            }
            const empty = new Name();
            empty.value = '';
            expect(await validate(empty)).toHaveLength(1);

            const ok = new Name();
            ok.value = 'x';
            expect(await validate(ok)).toEqual([]);
        });
    });

    describe('cycle guard', () => {
        test('does not infinite-loop on self-referential graphs', async () => {
            class Node {
                @VerifyIsString()
                label!: string;
                next?: Node;
            }
            const a = new Node();
            a.label = 'ok';
            const b = new Node();
            b.label = 'ok';
            a.next = b;
            b.next = a;
            const errors = await validate(a);
            expect(errors).toEqual([]);
        });
    });

    describe('prototype chain', () => {
        test('subclass inherits parent rules', async () => {
            class Parent {
                @VerifyIsString()
                name!: string;
            }
            class Child extends Parent {}
            const value = new Child();
            (value as unknown as { name: number }).name = 42;
            const errors = await validate(value);
            expect(errors).toHaveLength(1);
            expect(errors[0].path).toBe('name');
        });
    });
});
