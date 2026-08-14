// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ormIsUniqueConstraintViolation } from './OrmUniqueConstraintViolation';

describe('ormIsUniqueConstraintViolation', () => {
    describe('the shape PlanetScale actually returns', () => {
        // Verbatim from a real Vitess rejection. The code lives inside the
        // message rather than on a field, which is why a property-only check
        // would report the production case as a fault.
        const planetScaleDuplicate = new Error(
            `DatabaseError: target: connected.-.primary: vttablet: rpc error: code = AlreadyExists desc = Duplicate entry '8c060d03-9e07-4630-88b9-176a33cde195' for key 'Agent.IDX_38763ebe9efbb73dd6ceeb6a6f' (errno 1062) (sqlstate 23000) (CallerID: s1bywoiyui7eh1ntrqc5): Sql: "insert into Agent(id) values (:vtg1)", BindVars: {REDACTED}`,
        );

        it('recognizes it', () => {
            expect(ormIsUniqueConstraintViolation(planetScaleDuplicate)).toBe(
                true,
            );
        });

        it('recognizes it through a wrapper', () => {
            const wrapped = new Error('Insert failed', {
                cause: planetScaleDuplicate,
            });
            expect(ormIsUniqueConstraintViolation(wrapped)).toBe(true);
        });
    });

    describe('drivers that populate a field', () => {
        it('recognizes mysql2', () => {
            expect(
                ormIsUniqueConstraintViolation(
                    Object.assign(new Error('dup'), {
                        code: 'ER_DUP_ENTRY',
                        errno: 1062,
                    }),
                ),
            ).toBe(true);
        });

        it('recognizes SQLite', () => {
            expect(
                ormIsUniqueConstraintViolation(
                    Object.assign(new Error('constraint failed'), {
                        code: 'SQLITE_CONSTRAINT_UNIQUE',
                    }),
                ),
            ).toBe(true);
        });
    });

    describe('what must not be mistaken for one', () => {
        // These are the whole point. A caller reads a false here as "nobody
        // claimed the row," and reading any of them as true would have it
        // carry on as though a race it never lost had been lost.
        it.each([
            ['a dropped connection', new Error('read ECONNRESET')],
            ['a timeout', new Error('Query timed out after 30000ms')],
            [
                'a Vitess throttle',
                new Error(
                    'DatabaseError: target: db.-.primary: vttablet: rpc error: code = Unavailable desc = request throttled',
                ),
            ],
            [
                'a foreign key rejection',
                Object.assign(new Error('fk'), {
                    code: 'ER_NO_REFERENCED_ROW_2',
                }),
            ],
            [
                'a value too long for a column',
                new Error('Data too long for column'),
            ],
            ['nothing at all', null],
            ['a bare string', 'Duplicate entry'],
        ])('does not claim %s', (_name, error) => {
            expect(ormIsUniqueConstraintViolation(error)).toBe(false);
        });

        it('does not loop on an error that causes itself', () => {
            const selfReferential = new Error('boom') as Error & {
                cause?: unknown;
            };
            selfReferential.cause = selfReferential;
            expect(ormIsUniqueConstraintViolation(selfReferential)).toBe(false);
        });
    });
});
