// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseErrorSerializer } from './BaseErrorSerializer';

describe('BaseErrorSerializer', () => {
    describe('toClientErrorData', () => {
        describe('database error message redaction', () => {
            it('should redact SQL query and bind variables from DatabaseError message', () => {
                const fullDbError = `DatabaseError: target: connected.-.primary: vttablet: rpc error: code = AlreadyExists desc = Duplicate entry '8c060d03-9e07-4630-88b9-176a33cde195-192-168-1-1-agent' for key 'Agent.IDX_38763ebe9efbb73dd6ceeb6a6f' (errno 1062) (sqlstate 23000) (CallerID: s1bywoiyui7eh1ntrqc5): Sql: "insert into Agent(id, createdAt, updatedAt, createdByAccountId, createdByProfileId, updatedByAccountId, updatedByProfileId, agent, identifier, displayIdentifier, displayName, description, profileId, status, durableObjectId, faultCode, isFaulted, faultReason) values (:vtg1, :vtg2, :vtg3, :vtg4, :vtg5, default, default, default, :vtg6, :vtg7, :vtg8, :vtg9, :vtg10, :vtg11, default, default, default, null)", BindVars: {REDACTED}`;

                const serializer = new BaseErrorSerializer(
                    new Error(fullDbError),
                );
                const result = serializer.toClientErrorData();

                expect(result.message).toBe(
                    "DatabaseError: Duplicate entry '8c060d03-9e07-4630-88b9-176a33cde195-192-168-1-1-agent' for key 'Agent.IDX_38763ebe9efbb73dd6ceeb6a6f'",
                );
                expect(result.message).not.toContain('Sql:');
                expect(result.message).not.toContain('BindVars');
                expect(result.message).not.toContain('insert into');
            });

            it('should preserve non-database error messages unchanged', () => {
                const regularError = 'Something went wrong with the request';

                const serializer = new BaseErrorSerializer(
                    new Error(regularError),
                );
                const result = serializer.toClientErrorData();

                expect(result.message).toBe(regularError);
            });

            it('should handle DatabaseError without desc pattern', () => {
                const malformedDbError =
                    'DatabaseError: some unexpected format without desc';

                const serializer = new BaseErrorSerializer(
                    new Error(malformedDbError),
                );
                const result = serializer.toClientErrorData();

                expect(result.message).toBe(
                    'DatabaseError: A database error occurred',
                );
            });

            it('should keep full error in internal error property', () => {
                const fullDbError = `DatabaseError: target: connected.-.primary: vttablet: rpc error: code = AlreadyExists desc = Duplicate entry 'test' (errno 1062): Sql: "insert into Table...", BindVars: {...}`;

                const serializer = new BaseErrorSerializer(
                    new Error(fullDbError),
                );

                // Internal error should retain the full message for logging
                expect(serializer.error.message).toBe(fullDbError);

                // Client-facing should be redacted
                const clientError = serializer.toClientErrorData();
                expect(clientError.message).toBe(
                    "DatabaseError: Duplicate entry 'test'",
                );
            });

            it('should redact nested cause database errors', () => {
                const innerError = new Error(
                    'DatabaseError: target: db: desc = Foreign key constraint violation \'FK_user_profile\' (errno 1452): Sql: "update...", BindVars: {x: 1}',
                );
                const outerError = new Error('Operation failed');
                (outerError as Error & { cause: Error }).cause = innerError;

                const serializer = new BaseErrorSerializer(outerError);
                const result = serializer.toClientErrorData();

                expect(result.cause?.message).toBe(
                    "DatabaseError: Foreign key constraint violation 'FK_user_profile'",
                );
                expect(result.cause?.message).not.toContain('Sql:');
            });
        });

        it('should exclude stack traces from client error data', () => {
            const error = new Error('Test error');

            const serializer = new BaseErrorSerializer(error);
            const clientError = serializer.toClientErrorData();

            expect(clientError.stack).toBeUndefined();
        });

        it('should mask message when mask=true', () => {
            const error = new Error('Sensitive internal error details');

            const serializer = new BaseErrorSerializer(error);
            const clientError = serializer.toClientErrorData(true);

            expect(clientError.message).toBe('Internal Server Error');
        });

        describe('circular cause chains', () => {
            it('does not overflow the stack on a cyclic BaseErrorData cause chain', () => {
                // Pre-shaped BaseErrorData objects bypass normalize's cycle
                // de-duplication, so the cycle survives into serialization.
                const a = {
                    name: 'A',
                    message: 'a',
                    statusCode: 500,
                } as Record<string, unknown>;
                const b = {
                    name: 'B',
                    message: 'b',
                    statusCode: 500,
                } as Record<string, unknown>;
                a.cause = b;
                b.cause = a;

                const serializer = new BaseErrorSerializer(a);
                let result!: ReturnType<typeof serializer.toClientErrorData>;
                expect(() => {
                    result = serializer.toClientErrorData();
                }).not.toThrow();

                expect(result.name).toBe('A');
                expect(result.cause?.name).toBe('B');
                expect(result.cause?.cause?.message).toBe(
                    'Circular reference detected in error cause chain',
                );
            });

            it('does not overflow on a self-referential cause', () => {
                const self = {
                    name: 'Self',
                    message: 'loops',
                    statusCode: 500,
                } as Record<string, unknown>;
                self.cause = self;

                const serializer = new BaseErrorSerializer(self);
                let result!: ReturnType<typeof serializer.toClientErrorData>;
                expect(() => {
                    result = serializer.toClientErrorData();
                }).not.toThrow();

                expect(result.cause?.message).toBe(
                    'Circular reference detected in error cause chain',
                );
            });
        });
    });
});
