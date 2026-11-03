// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Json, JsonArray, JsonObject } from '@system-inc/base-common/json/Json';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import { RpcServerConfiguration } from '../../configuration/BaseConfiguration';
import { McpToolAnnotations } from '../../mcp/McpToolOptions';
import { requestContextParamIndices } from '../../request/decorators/RequestContextDecorator';
import {
    generateJsonSchema,
    JsonSchemaBuilder,
    jsonSchemaRootClass,
} from '../../serialization/GenerateJsonSchema';
import { JsonSchema } from '../../serialization/JsonSchema';
import {
    RpcArgumentMetadata,
    RpcHandlerMetadata,
    rpcMetadataIndexProcedures,
    RpcServiceMetadata,
} from '../rpc/RpcMetadata';
import { McpToolNamePattern } from './McpProtocol';

/**
 * A tool as `tools/list` describes it.
 */
export interface McpToolDefinition {
    readonly name: string;
    readonly title?: string;
    readonly description: string;
    readonly inputSchema: JsonSchema;
    readonly annotations?: McpToolAnnotations;
}

/**
 * An `@Rpc({ mcp })` procedure exposed as a tool.
 */
export interface McpTool {
    readonly definition: McpToolDefinition;
    /**
     * The RPC procedure a call dispatches to.
     */
    readonly procedureName: string;
    /**
     * The handler identity session access is evaluated against.
     */
    readonly handler: BaseHandler;
    /**
     * Turns the tool's named `arguments` object into the procedure's
     * positional RPC arguments.
     */
    toRpcArguments(args: JsonObject | undefined): JsonArray;
}

/**
 * The tools a worker serves, built and validated once at boot from the
 * registered RPC services' `@Rpc({ mcp })` procedures. Every contradiction
 * fails boot, naming the service and procedure: a blank description, a
 * procedure that isn't `'public'`, an invalid or duplicate tool name, or
 * arguments the tool's `arguments` object can't express.
 */
export class McpToolRegistry {
    private readonly toolsByName = new Map<string, McpTool>();

    constructor(rpcServer: RpcServerConfiguration | undefined) {
        const warnedClasses = new Set<string>();
        const procedures = rpcMetadataIndexProcedures(
            rpcServer?.procedures ?? [],
        );
        const labels = new Map<string, string>();
        for (const { service, procedure } of procedures.values()) {
            const options = procedure.options?.mcp;
            if (!options) {
                continue;
            }
            const label = `${service.serviceCtor.name}.${procedure.handlerName}`;

            if (options.description.trim() === '') {
                throw new Error(
                    `MCP tool ${label} has a blank description. The description is what a model reads to decide whether and how to call the tool — say what it does, what it returns, and when it fails.`,
                );
            }

            // checked in every mode: local mode treats everything as public,
            // so a tool that worked locally would fail in production
            const visibility =
                procedure.options?.visibility ??
                service.options?.visibility ??
                rpcServer?.visibility ??
                'internal';
            if (visibility !== 'public') {
                throw new Error(
                    `MCP tool ${label} resolves to '${visibility}' RPC visibility, but the MCP endpoint is a public route. Give the procedure (or its service) visibility: 'public'.`,
                );
            }

            const name =
                options.name ??
                defaultToolName(
                    service.serviceCtor.name,
                    procedure.handlerName,
                );
            if (!McpToolNamePattern.test(name)) {
                throw new Error(
                    `MCP tool ${label} is named '${name}', which isn't a valid MCP tool name (1–128 characters of letters, digits, '_', '-', '.'). Set mcp.name.`,
                );
            }
            const existing = labels.get(name);
            if (existing) {
                throw new Error(
                    `MCP tools ${existing} and ${label} are both named '${name}'. Set mcp.name on one of them.`,
                );
            }
            labels.set(name, label);

            const input = describeArguments(service, procedure, label);
            warnUndescribed(
                input.schema,
                input.rootClassName,
                label,
                warnedClasses,
            );

            this.toolsByName.set(name, {
                definition: {
                    name,
                    ...(options.title !== undefined && {
                        title: options.title,
                    }),
                    description: options.description,
                    inputSchema: input.schema,
                    ...(options.annotations !== undefined && {
                        annotations: options.annotations,
                    }),
                },
                procedureName: procedure.handlerName,
                handler: new BaseHandler(
                    service.serviceCtor,
                    procedure.handlerName,
                ),
                toRpcArguments: input.toRpcArguments,
            });
        }
    }

    /**
     * The tool with this name, if one exists.
     */
    get(name: string): McpTool | undefined {
        return this.toolsByName.get(name);
    }

    /**
     * Every tool, sorted by name.
     */
    all(): McpTool[] {
        return [...this.toolsByName.values()].sort((a, b) =>
            a.definition.name.localeCompare(b.definition.name),
        );
    }
}

/**
 * `<service>_<procedure>` in snake_case, with a trailing `RpcService`,
 * `Rpc`, or `Service` dropped from the class name.
 */
function defaultToolName(className: string, procedureName: string): string {
    const serviceName = className.replace(/(RpcService|Rpc|Service)$/, '');
    return [serviceName, procedureName]
        .filter((part) => part !== '')
        .map(toSnakeCase)
        .join('_');
}

function toSnakeCase(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .toLowerCase();
}

interface ToolInput {
    readonly schema: JsonSchema;
    /**
     * The class the input schema inlines at its root, if any.
     */
    readonly rootClassName?: string;
    readonly toRpcArguments: (args: JsonObject | undefined) => JsonArray;
}

/**
 * The tool's input schema and argument mapping. A procedure whose only
 * argument is a serializable class takes that class's fields as the tool's
 * arguments; any other takes one named property per `@RpcArgument`.
 */
function describeArguments(
    service: RpcServiceMetadata,
    procedure: RpcHandlerMetadata,
    label: string,
): ToolInput {
    const prototype = service.serviceCtor.prototype as Record<string, unknown>;
    const method = prototype[procedure.handlerName];
    const injected = requestContextParamIndices(
        prototype,
        procedure.handlerName,
    );
    const declared = Object.values(procedure.args)
        .filter((arg): arg is RpcArgumentMetadata => arg !== undefined)
        .sort((a, b) => a.index - b.index);

    // every parameter the caller fills must be described; rest parameters
    // don't count in `length`, so they can't be detected here
    const parameterCount = Math.max(
        typeof method === 'function' ? method.length : 0,
        ...declared.map((arg) => arg.index + 1),
    );
    for (let index = 0; index < parameterCount; index++) {
        if (!procedure.args[index] && !injected.has(index)) {
            throw new Error(
                `MCP tool ${label} has a parameter at index ${index} without @RpcArgument, so the tool's arguments can't describe it. Add @RpcArgument(() => Type, { name }).`,
            );
        }
    }

    const only = declared.length === 1 ? declared[0] : undefined;
    const rootClass = only?.typeFunc && jsonSchemaRootClass(only.typeFunc);
    if (only && rootClass) {
        return {
            schema: generateJsonSchema(only.typeFunc!),
            rootClassName: rootClass.name,
            toRpcArguments: (args) => positional([[only.index, args]]),
        };
    }

    const builder = new JsonSchemaBuilder();
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const arg of declared) {
        const name = arg.options?.name;
        if (!name) {
            throw new Error(
                `MCP tool ${label} has an argument at index ${arg.index} without a name. A tool's arguments are named, so give each @RpcArgument a name: @RpcArgument(() => Type, { name: '…' }).`,
            );
        }
        if (name in properties) {
            throw new Error(`MCP tool ${label} names two arguments '${name}'.`);
        }
        let schema = arg.typeFunc ? builder.schemaFor(arg.typeFunc) : {};
        if (arg.options?.description !== undefined) {
            schema = { ...schema, description: arg.options.description };
        }
        if (arg.options?.defaultValue !== undefined) {
            schema = { ...schema, default: arg.options.defaultValue };
        } else if (!arg.options?.optional) {
            required.push(name);
        }
        properties[name] = schema;
    }

    return {
        schema: builder.document(
            required.length > 0
                ? { type: 'object', properties, required }
                : { type: 'object', properties },
        ),
        toRpcArguments: (args) =>
            positional(
                declared.map((arg) => [arg.index, args?.[arg.options!.name!]]),
            ),
    };
}

/**
 * Positional RPC arguments with each value at its parameter's index. A
 * missing value stays `undefined` (not `null`), so the dispatcher applies
 * the argument's default or reports it missing, and `@InjectRequestContext`
 * slots stay free for the dispatcher to fill.
 */
function positional(
    entries: ReadonlyArray<readonly [number, Json | undefined]>,
): JsonArray {
    const args: (Json | undefined)[] = [];
    for (const [index, value] of entries) {
        args[index] = value;
    }
    return args as JsonArray;
}

/**
 * Logs one warning per class (or per tool, for named arguments) listing
 * input properties without a description: a model picks argument values
 * from those descriptions.
 */
function warnUndescribed(
    schema: JsonSchema,
    rootClassName: string | undefined,
    label: string,
    warnedClasses: Set<string>,
): void {
    const objects: [string, JsonSchema][] = [
        [rootClassName ?? `the arguments of ${label}`, schema],
        ...Object.entries(schema.$defs ?? {}),
    ];
    for (const [owner, object] of objects) {
        if (warnedClasses.has(owner)) {
            continue;
        }
        warnedClasses.add(owner);
        const undescribed = Object.entries(object.properties ?? {})
            .filter(([, property]) => property.description === undefined)
            .map(([property]) => property);
        if (undescribed.length > 0) {
            Logger.warn(
                LogCategory.Mcp,
                'MCP tool input %s has properties without a description: %s',
                owner,
                undescribed.join(', '),
            );
        }
    }
}
