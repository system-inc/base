// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ClientError, gql } from 'graphql-request';

import { BaseErrorData } from '@system-inc/base-common/error/interfaces/BaseErrorData';
import { HttpStatusCode } from '@system-inc/base-common/http/HttpStatus';
import { ArgumentValidationErrorData } from '@system-inc/base-foundation/error/interfaces/ArgumentValidationErrorData';
import { IntegrationTestEnvironment } from '@system-inc/base-foundation/test/IntegrationTestEnvironment';

const gqlClient = IntegrationTestEnvironment.get().client.getGqlClient();

describe('GraphQL Test', () => {
    test('GraphQL Query basicQuery', async () => {
        // arrange
        const query = gql`
            query MyQuery {
                basicQuery {
                    age
                    name
                    __typename
                }
            }
        `;

        // act
        const result = await gqlClient.request<{
            basicQuery: { age: number; name: string; __typename: string };
        }>(query);

        // assert
        expect(result.basicQuery.name).toBe('John');
        expect(result.basicQuery.age).toBe(10);
        expect(result.basicQuery.__typename).toBe('Tester');
    });

    test('GraphQL Mutation basicMutation', async () => {
        // arrange
        const mutation = gql`
            mutation MyMutation {
                basicMutation {
                    age
                    name
                    __typename
                }
            }
        `;

        // act
        const result = await gqlClient.request<{
            basicMutation: { age: number; name: string; __typename: string };
        }>(mutation);

        // assert
        expect(result.basicMutation.name).toBe('Johnny');
        expect(result.basicMutation.age).toBe(101);
        expect(result.basicMutation.__typename).toBe('Tester');
    });

    test('GraphQL test throw', async () => {
        // arrange
        const query = gql`
            query MyQuery {
                testThrow {
                    age
                    name
                }
            }
        `;

        // act
        try {
            await gqlClient.request(query);
            throw new Error('Should have thrown');
        } catch (error) {
            if (error instanceof ClientError) {
                const gqlError = error.response.errors?.[0];
                expect(gqlError?.message).toBe('This is a test error');
                const baseError = gqlError?.extensions
                    ?.baseError as BaseErrorData;
                expect(baseError).toBeDefined();
                expect(baseError?.message).toBe('This is a test error');
                expect(baseError?.name).toBe('BaseError');
                expect(baseError?.statusCode).toBe(HttpStatusCode.Forbidden);
            } else {
                throw error;
            }
        }
    });

    test('@InjectRequestContext() injects the whole RC in GraphQL resolvers', async () => {
        const query = gql`
            query RcInjection {
                rcInjection {
                    requestId
                    deviceId
                }
            }
        `;

        const result = await gqlClient.request<{
            rcInjection: { requestId: string; deviceId: string };
        }>(query);

        // requestId is framework-generated and should always be a UUID-ish string.
        expect(typeof result.rcInjection.requestId).toBe('string');
        expect(result.rcInjection.requestId.length).toBeGreaterThan(0);
    });

    test('@InjectRequestContext(KEY) extracts the same value via HTTP and GraphQL', async () => {
        // A worker-level global middleware (configured in settings.ts)
        // reads `x-cross-dispatcher-token` and writes it under
        // `crossDispatcherTokenKey`. Both an HTTP route and a GraphQL
        // query echo the same key — the two paths should agree on the
        // extracted value for any given header.
        const token = `cross-dispatcher-${Math.random().toString(36).slice(2)}`;
        const client = IntegrationTestEnvironment.get().client;

        const httpResponse = await client.sendRequest(
            `${client.getServerBaseUrl()}/test/router/cross-dispatcher`,
            { headers: { 'x-cross-dispatcher-token': token } },
        );
        expect(httpResponse.status).toBe(200);
        const httpValue = await httpResponse.text();
        expect(httpValue).toBe(token);

        const gqlResult = await gqlClient.request<{
            crossDispatcherToken: string;
        }>(
            gql`
                query CrossDispatcher {
                    crossDispatcherToken
                }
            `,
            undefined,
            { 'x-cross-dispatcher-token': token },
        );
        expect(gqlResult.crossDispatcherToken).toBe(token);
    });

    test('@InjectRequestContext between two @GqlArgument params preserves both args', async () => {
        // Regression: the fork's `getParams` previously built paramValues
        // with `.map()` over sorted params, producing a dense array
        // whose positions only coincidentally matched method slots. A
        // middle `@InjectRequestContext` write would clobber a
        // type-graphql value; the trailing arg ended up `undefined`.
        const query = gql`
            query RcMiddle {
                rcMiddleInjection(before: "alpha", after: "omega") {
                    before
                    rcRequestId
                    after
                }
            }
        `;
        const result = await gqlClient.request<{
            rcMiddleInjection: {
                before: string;
                rcRequestId: string;
                after: string;
            };
        }>(query);

        expect(result.rcMiddleInjection.before).toBe('alpha');
        expect(result.rcMiddleInjection.after).toBe('omega');
        expect(typeof result.rcMiddleInjection.rcRequestId).toBe('string');
        expect(result.rcMiddleInjection.rcRequestId.length).toBeGreaterThan(0);
    });

    test('@InjectGqlOperationContext() reports operation type and name on a query', async () => {
        const query = gql`
            query MyOp {
                opContext {
                    operationType
                    operationName
                    selectedFields
                }
            }
        `;
        const result = await gqlClient.request<{
            opContext: {
                operationType: string;
                operationName: string;
                selectedFields: string[];
            };
        }>(query);

        expect(result.opContext.operationType).toBe('query');
        expect(result.opContext.operationName).toBe('opContext');
        expect(result.opContext.selectedFields).toEqual(
            expect.arrayContaining([
                'operationType',
                'operationName',
                'selectedFields',
            ]),
        );
    });

    test('@InjectGqlOperationContext() reports mutation type', async () => {
        const mutation = gql`
            mutation MyOp {
                opContextMutation {
                    operationType
                    operationName
                }
            }
        `;
        const result = await gqlClient.request<{
            opContextMutation: {
                operationType: string;
                operationName: string;
            };
        }>(mutation);

        expect(result.opContextMutation.operationType).toBe('mutation');
        expect(result.opContextMutation.operationName).toBe(
            'opContextMutation',
        );
    });

    test('@InjectGqlOperationContext() selectionSet reflects only the requested fields', async () => {
        // Regression: selectionSet must be derived from the client's actual
        // selection — not the schema's field list.
        const query = gql`
            query MyOp {
                opContext {
                    selectedFields
                }
            }
        `;
        const result = await gqlClient.request<{
            opContext: { selectedFields: string[] };
        }>(query);

        expect(result.opContext.selectedFields).toEqual(['selectedFields']);
    });

    test('GraphQL test validation', async () => {
        // arrange
        const query = gql`
            query MyQuery {
                testValidation(input: { age: 10, name: "" }) {
                    age
                    name
                }
            }
        `;

        // act
        try {
            await gqlClient.request(query);
            throw new Error('Should have thrown');
        } catch (error) {
            if (error instanceof ClientError) {
                const gqlError = error.response.errors?.[0];
                expect(gqlError?.message).toBe('Argument Validation Error');
                const baseError = gqlError?.extensions
                    ?.baseError as ArgumentValidationErrorData;
                expect(baseError).toBeDefined();
                expect(baseError.statusCode).toBe(
                    HttpStatusCode.UnprocessableEntity,
                );
                expect(baseError.extensions.validationErrors).toBeDefined();
                const validationErrors = baseError.extensions.validationErrors;
                if (Array.isArray(validationErrors)) {
                    expect(validationErrors.length).toBe(1);
                    expect(validationErrors[0].path).toBe('name');
                    expect(validationErrors[0].constraints).toBeDefined();
                    expect(validationErrors[0].constraints?.IsNotEmpty).toBe(
                        'name should not be empty',
                    );
                } else {
                    throw new Error('Validation errors should be an array');
                }
            } else {
                throw error;
            }
        }
    });
});
