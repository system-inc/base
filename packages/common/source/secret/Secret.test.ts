// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { inspect } from 'util';

import { Secret } from './Secret';

describe('Secret', () => {
    describe('reveal', () => {
        test('round-trips the wrapped value', () => {
            const s = new Secret('hunter2');
            expect(s.reveal()).toBe('hunter2');
        });

        test('works with non-string payloads', () => {
            const payload = { apiKey: 'abc', region: 'us-east' };
            const s = new Secret(payload);
            expect(s.reveal()).toBe(payload);
        });
    });

    describe('redaction', () => {
        test('JSON.stringify renders [redacted]', () => {
            const s = new Secret('hunter2');
            expect(JSON.stringify(s)).toBe('"[redacted]"');
        });

        test('JSON.stringify of a containing object redacts the field', () => {
            const s = new Secret('hunter2');
            const wrapper = { name: 'svc', secret: s };
            expect(JSON.stringify(wrapper)).toBe(
                '{"name":"svc","secret":"[redacted]"}',
            );
        });

        test('template literal renders [redacted]', () => {
            const s = new Secret('hunter2');
            expect(`value=${s}`).toBe('value=[redacted]');
        });

        test('String() renders [redacted]', () => {
            const s = new Secret('hunter2');
            expect(String(s)).toBe('[redacted]');
        });

        test('util.inspect renders Secret([redacted])', () => {
            const s = new Secret('hunter2');
            expect(inspect(s)).toBe('Secret([redacted])');
        });

        test('inspect of a containing object does not leak the value', () => {
            const s = new Secret('hunter2');
            const wrapper = { name: 'svc', secret: s };
            const out = inspect(wrapper);
            expect(out).not.toContain('hunter2');
            expect(out).toContain('Secret([redacted])');
        });
    });

    describe('enumeration', () => {
        test('Object.keys does not reveal the value', () => {
            const s = new Secret('hunter2');
            expect(Object.keys(s)).toEqual([]);
        });

        test('Object.entries does not reveal the value', () => {
            const s = new Secret('hunter2');
            expect(Object.entries(s)).toEqual([]);
        });

        test('spread copies nothing enumerable', () => {
            const s = new Secret('hunter2');
            const spread = { ...s };
            expect(Object.keys(spread)).toEqual([]);
            expect(JSON.stringify(spread)).toBe('{}');
        });
    });

    describe('map', () => {
        test('produces a new Secret holding the transformed value', () => {
            const s = new Secret('hunter2');
            const upper = s.map((v) => v.toUpperCase());
            expect(upper).toBeInstanceOf(Secret);
            expect(upper.reveal()).toBe('HUNTER2');
        });

        test('map result also redacts on serialization', () => {
            const s = new Secret('hunter2').map((v) => v.length);
            expect(JSON.stringify(s)).toBe('"[redacted]"');
            expect(s.reveal()).toBe(7);
        });

        test('map does not mutate the original', () => {
            const s = new Secret('hunter2');
            s.map((v) => v.toUpperCase());
            expect(s.reveal()).toBe('hunter2');
        });
    });
});
