// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs/promises';
import { printSchemaWithDirectives } from '@graphql-tools/utils';
import { NonEmptyArray } from '@system-inc/type-graphql/typings/utils/NonEmptyArray';
import { buildSchema } from '@system-inc/type-graphql/utils/buildSchema';
import {
    GraphQLEnumType,
    GraphQLInputObjectType,
    GraphQLInputType,
    GraphQLList,
    GraphQLNonNull,
    GraphQLScalarType,
    GraphQLSchema,
    lexicographicSortSchema,
} from 'graphql';

import { DecoratorRegistry } from '@system-inc/base-common/decorator/DecoratorRegistry';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { GqlResolverDecoratorName } from '@system-inc/base-foundation/graphql/decorators/GqlResolver';
import {
    findValidationTargetByName,
    getValidationRules,
} from '@system-inc/base-foundation/validation/ValidationEngine';
import { BaseProvider } from '../../common/BaseProvider';
import {
    GraphQLInputEnumTypeMetadata,
    GraphQLInputObjectFieldMetadata,
    GraphQLInputObjectFieldValidationMetadata,
    GraphQLInputObjectTypeMetadata,
    GraphQLInputScalarTypeMetadata,
    GraphQLInputTypeMetadata,
} from './GqlSchemaMetadata';

// Shared logic for graphql operations used by multiple commands.

/**
 * Generates a graphql schema for a given worker and options.
 *
 * @param worker
 * @param options
 */
export async function generateGqlSchema(
    baseProvider: BaseProvider,
    options?: {
        filePath?: string;
        byModule?: boolean;
        emitMetadata?: boolean;
    },
): Promise<void> {
    if (options?.byModule) {
        await generateGqlSchemaByModule(
            baseProvider,
            options?.filePath,
            options?.emitMetadata,
        );
    } else {
        await generateSchemaByWorker(
            baseProvider,
            options?.filePath,
            options?.emitMetadata,
        );
    }
}

/**
 * Generates a workers complete graphql schema and outputs to a single file.
 *
 * @param worker
 * @param filePath
 */
async function generateSchemaByWorker(
    baseProvider: BaseProvider,
    filePath?: string,
    emitMetadata?: boolean,
): Promise<void> {
    // initialize base using the worker specified
    const base = await baseProvider.getBase();
    await base.initialize();

    // Throw a clear error if the worker doesn't use GraphQL. The
    // single-worker invocation surfaces this as a hard error (user
    // ran the wrong command). The multi-worker loop in
    // GenerateGqlSchemaCommand catches this and logs a friendly
    // skip-this-worker message, then continues.
    if (!base.configuration.graphql) {
        throw new Error(
            `Worker '${baseProvider.project.worker}' has no GraphQL configuration.`,
        );
    }

    // get the graphql schema
    const graphqlSchema = await base.getGqlSchema();
    const schema = printSchemaWithDirectives(
        lexicographicSortSchema(graphqlSchema),
    );

    // determine the path to write the file to
    if (!filePath) {
        filePath = baseProvider.project.graphqlSchemaFolder;
    } else {
        filePath = filePath + `/${baseProvider.project.worker}/graphql/schemas`;
    }

    // clean the output path first
    try {
        await fs.rm(filePath, { recursive: true, force: true });
    } catch (error) {
        console.warn(`Error cleaning output path: ${filePath}`);
    }

    // create the new output folder
    try {
        await fs.mkdir(filePath, { recursive: true });
    } catch (error) {
        console.error(`Error creating output path: ${filePath}`);
        throw error;
    }

    // Single-file mode: always `schema.graphql`. Worker context comes
    // from the folder path (`<worker>/graphql/schemas/`); the filename
    // stays generic so it mirrors every other generated artifact
    // (schema.generated.ts, drizzle.config.ts, settings.ts, etc.).
    const fileName = filePath + '/schema.graphql';
    await fs.writeFile(fileName, schema);
    console.log(`Wrote schema to ${fileName}`);

    if (emitMetadata) {
        await generateSchemaMetadata(
            graphqlSchema,
            base.configuration.name,
            filePath,
        );
    }
}

/**
 *
 * @param worker
 * @param filePath
 * @param baseProvider
 */
async function generateGqlSchemaByModule(
    baseProvider: BaseProvider,
    filePath?: string,
    emitMetadata?: boolean,
): Promise<void> {
    // initialize base using the worker specified
    const base = await baseProvider.getBase();
    await base.initialize();

    // determine the path to write the file to
    if (!filePath) {
        filePath = baseProvider.project.graphqlSchemaFolder;
    } else {
        filePath = filePath + `/${baseProvider.project.worker}/graphql/schemas`;
    }

    // clean the output path first
    try {
        await fs.rm(filePath, { recursive: true, force: true });
    } catch (error) {
        console.warn(`Error cleaning output path: ${filePath}`);
    }

    try {
        await fs.mkdir(filePath, { recursive: true });
    } catch (error) {
        console.error(`Error creating output path: ${filePath}`);
        throw error;
    }

    // Resolvers live in the unified `services` arrays, self-described by
    // their @GqlResolver decorator — filter them out the same way the
    // manifest sorter does.
    const resolversOf = (services?: Constructor<object>[]) =>
        (services ?? []).filter((service) =>
            DecoratorRegistry.get().has(service, GqlResolverDecoratorName),
        );

    if (base.configuration.modules && base.configuration.modules.length > 0) {
        // generate a separate schema file for each module
        for (const module of base.configuration.modules) {
            // Honor the registration's feature toggle: a module registered
            // with `graphql: false` contributes no resolvers to this worker
            // (the manifest strips them), so it gets no schema file either.
            if (module.options?.graphql === false) {
                continue;
            }
            const moduleResolvers = resolversOf(module.settings.services);
            if (moduleResolvers.length > 0) {
                await generateModuleGraphQLSchema(
                    filePath,
                    module.name,
                    moduleResolvers,
                    emitMetadata,
                );
            }
        }
    }

    // generate the schema file for any resolvers defined in the worker settings
    const workerSettings = await baseProvider.loadSettings();
    const workerGraphqlResolvers = resolversOf(
        workerSettings.settings.services,
    );
    if (workerGraphqlResolvers.length > 0) {
        await generateModuleGraphQLSchema(
            filePath,
            base.configuration.name,
            workerGraphqlResolvers,
            emitMetadata,
        );
    }
}

/**
 *
 * @param filePath
 * @param module
 * @param resolvers
 */
async function generateModuleGraphQLSchema(
    filePath: string,
    module: string,
    resolvers: Constructor<object>[],
    emitMetadata?: boolean,
): Promise<void> {
    const generatedSchema = await buildSchema({
        resolvers: resolvers as NonEmptyArray<Constructor<object>>,
    });

    const schema = printSchemaWithDirectives(
        lexicographicSortSchema(generatedSchema),
    );
    if (module.endsWith('Module')) {
        module = module.substring(0, module.length - 6);
    }

    const fileName = filePath + `/${module}.graphql`;
    await fs.writeFile(fileName, schema);
    console.log(`Wrote schema to ${fileName}`);

    if (emitMetadata) {
        await generateSchemaMetadata(generatedSchema, module, filePath);
    }
}

async function generateSchemaMetadata(
    schema: GraphQLSchema,
    fileName: string,
    filePath: string,
) {
    const schemaMetadata: GraphQLSchemaMetadata = {
        types: {
            input: {},
        },
    };
    const inputTypes: Record<string, GraphQLInputTypeMetadata> =
        schemaMetadata.types.input;

    const typeMap = schema.getTypeMap();
    for (const type of Object.values(typeMap)) {
        // determine if the type is an input type
        if (type instanceof GraphQLInputObjectType) {
            const inputMetadata: GraphQLInputObjectTypeMetadata = {
                kind: 'object',
                type: type.name,
                description: type.description ?? undefined,
                fields: [],
            };
            const inputFields = Object.values(type.getFields());
            if (inputFields.length > 0) {
                // Look up the TypeScript class that backs this GraphQL
                // input type by name, then read the validation rules
                // registered against it via `@Verify*` decorators.
                const validatableType = findValidationTargetByName(type.name);
                const rulesForClass = validatableType
                    ? getValidationRules(validatableType)
                    : [];

                for (const inputField of inputFields) {
                    const fieldMetadata =
                        generateGraphQLInputObjectPropertyMetadata(
                            inputField.type,
                        );
                    fieldMetadata.name = inputField.name;

                    // if we have validation metadata for the class, we will add it to the field metadata
                    const rulesForField = rulesForClass.filter(
                        (rule) => rule.propertyName === inputField.name,
                    );

                    if (rulesForField.length > 0) {
                        fieldMetadata.validation = [];
                        for (const rule of rulesForField) {
                            const validationMetadata = <
                                GraphQLInputObjectFieldValidationMetadata
                            >{
                                type: rule.ruleName,
                                options: rule.options,
                            };

                            // Preserve the legacy `constraints[]` shape so
                            // downstream consumers keep working. Our rules
                            // carry a single options value — wrap it when
                            // non-null, otherwise omit the field.
                            if (
                                rule.options !== undefined &&
                                rule.options !== null
                            ) {
                                validationMetadata.constraints = [rule.options];
                            }

                            // `each` tracks whether a value-level rule will
                            // auto-iterate over a list field. Array-level
                            // rules operate on the list as a whole.
                            if (fieldMetadata.kind === 'list') {
                                validationMetadata.each =
                                    rule.operatesOn === 'value';
                            }

                            fieldMetadata.validation!.push(validationMetadata);
                        }
                    }

                    inputMetadata.fields.push(fieldMetadata);
                }
            }
            inputTypes[type.name] = inputMetadata;
        } else if (type instanceof GraphQLEnumType) {
            const enumMetadata: GraphQLInputEnumTypeMetadata = {
                kind: 'enum',
                type: type.name,
                description: type.description ?? undefined,
                values: type.getValues().map((value) => value.name),
            };
            inputTypes[type.name] = enumMetadata;
        } else if (type instanceof GraphQLScalarType) {
            const scalarMetadata: GraphQLInputScalarTypeMetadata = {
                kind: 'scalar',
                type: type.name,
                description: type.description ?? undefined,
            };
            inputTypes[type.name] = scalarMetadata;
        } else {
            // type is not input type
            // console.log(type);
        }
    }

    const json = JSON.stringify(schemaMetadata, null, 4);
    const file = filePath + `/${fileName}.json`;
    await fs.writeFile(file, json);
    console.log(`Wrote schema metadata to ${file}`);
}

function generateGraphQLInputObjectPropertyMetadata(
    inputType: GraphQLInputType,
): GraphQLInputObjectFieldMetadata {
    let required = false;
    let type: string | undefined = undefined;
    let category: 'object' | 'scalar' | 'enum' | 'list' | undefined = undefined;

    if (inputType instanceof GraphQLNonNull) {
        required = true;
        inputType = inputType.ofType;
    }

    if (inputType instanceof GraphQLList) {
        inputType = inputType.ofType;
        if (inputType instanceof GraphQLNonNull) {
            required = true;
            inputType = inputType.ofType;
        }
        category = 'list';
    }

    if (inputType instanceof GraphQLInputObjectType) {
        category = 'object';
        type = inputType.name;
    } else if (inputType instanceof GraphQLEnumType) {
        category = 'enum';
        type = inputType.name;
    } else if (inputType instanceof GraphQLScalarType) {
        category = 'scalar';
        type = inputType.name;
    } else {
        throw new Error(`Unsupported input type: ${type}`);
    }

    return <GraphQLInputObjectFieldMetadata>{
        kind: category,
        type: type,
        required: required,
    };
}

interface GraphQLSchemaMetadata {
    types: {
        input: Record<string, GraphQLInputTypeMetadata>;
    };
}
