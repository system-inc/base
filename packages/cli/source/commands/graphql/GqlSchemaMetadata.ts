// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export type GraphQLInputTypeMetadata =
    | GraphQLInputScalarTypeMetadata
    | GraphQLInputEnumTypeMetadata
    | GraphQLInputObjectTypeMetadata;

interface BaseGraphQLInputTypeMetadata {
    type: string;
    description?: string;
}

export interface GraphQLInputScalarTypeMetadata extends BaseGraphQLInputTypeMetadata {
    kind: 'scalar';
}

export interface GraphQLInputEnumTypeMetadata extends BaseGraphQLInputTypeMetadata {
    kind: 'enum';
    values: Array<string>;
}

export interface GraphQLInputObjectTypeMetadata extends BaseGraphQLInputTypeMetadata {
    kind: 'object';
    fields: Array<GraphQLInputObjectFieldMetadata>;
}

export interface GraphQLInputObjectFieldMetadata {
    name: string;
    kind: 'object' | 'scalar' | 'enum' | 'list';
    type: string;
    required: boolean;
    validation?: GraphQLInputObjectFieldValidationMetadata[];
}

export interface GraphQLInputObjectListFieldMetadata extends GraphQLInputObjectFieldMetadata {
    kind: 'list';
    allowsEmpty: boolean;
}

export interface GraphQLInputObjectFieldValidationMetadata {
    type: string;
    constraints?: unknown[];
    each?: boolean;
    context?: unknown;
    options?: unknown;
}
