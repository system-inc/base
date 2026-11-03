// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Json, JsonObject } from '@system-inc/base-common/json/Json';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';
import {
    isRpcFailureResponse,
    RpcResult,
} from '@system-inc/base-common/rpc/protocol/RpcResponse';
import { McpConfiguration } from '../../configuration/BaseConfiguration';
import { BaseError } from '../../error/BaseError';
import {
    ERROR_CODE_AUTHENTICATION_REQUIRED,
    ERROR_CODE_INSUFFICIENT_ENTITLEMENTS,
    ERROR_CODE_PERMISSION_DENIED,
} from '../../error/ErrorCode';
import { HandlerRequestContext } from '../../request/HandlerRequestContext';
import { sessionAccessDenial } from '../access-control/SessionAccessMiddleware';
import { BaseRequest } from '../request/BaseRequest';
import { RpcDispatcher } from '../rpc/RpcDispatcher';
import {
    JsonRpcErrorCode,
    JsonRpcId,
    McpProtocolError,
    McpSupportedProtocolVersions,
} from './McpProtocol';
import { McpTool, McpToolRegistry } from './McpToolRegistry';

/**
 * Who the server is, for the `initialize` result.
 */
export interface McpServerInfo {
    readonly name: string;
    readonly title: string;
    readonly version: string;
}

/**
 * Thrown when the provider rejects the credentials a request carried, so
 * the endpoint answers HTTP 401 instead of treating the caller as
 * anonymous.
 */
class McpCredentialsRejected extends Error {
    constructor(readonly error: BaseError) {
        super(error.message);
    }
}

/**
 * Serves MCP's Streamable HTTP transport, stateless and with JSON
 * responses only: `initialize`, `ping`, `tools/list`, and `tools/call`.
 * There is no SSE stream and no session.
 *
 * A tool call runs through {@link RpcDispatcher.dispatch}, so visibility,
 * session access (before arguments are deserialized), validation, and
 * request-scoped DI apply exactly as they do on the RPC route. A tool the
 * caller's session access hides is absent from `tools/list`, and calling
 * it answers exactly as an unknown tool does.
 */
export class McpDispatcher {
    constructor(
        private readonly settings: McpConfiguration,
        private readonly serverInfo: McpServerInfo,
        private readonly tools: McpToolRegistry,
        private readonly rpcDispatcher: () => RpcDispatcher,
    ) {}

    async handleRequest(request: BaseRequest): Promise<Response> {
        const refusal = this.refuseOrigin(request);
        if (refusal) {
            return refusal;
        }

        // stateless with JSON responses: no SSE stream to GET, no session
        // to DELETE
        if (request.method !== 'POST') {
            return new Response(null, {
                status: 405,
                headers: { Allow: 'POST' },
            });
        }

        const protocolVersion = request.headers.get('mcp-protocol-version');
        if (
            protocolVersion !== null &&
            !McpSupportedProtocolVersions.includes(protocolVersion)
        ) {
            return errorResponse(
                null,
                JsonRpcErrorCode.InvalidRequest,
                `Unsupported MCP protocol version: ${protocolVersion}`,
                400,
            );
        }

        let message: unknown;
        try {
            message = await request.json();
        } catch {
            return errorResponse(
                null,
                JsonRpcErrorCode.ParseError,
                'Parse error',
                400,
            );
        }
        if (!isJsonRpcMessage(message)) {
            return errorResponse(
                null,
                JsonRpcErrorCode.InvalidRequest,
                'Invalid Request',
                400,
            );
        }

        // a notification, or a response to a request we never send: accept
        // and ignore it
        if (message.id === undefined || typeof message.method !== 'string') {
            return new Response(null, { status: 202 });
        }

        const id = message.id;
        try {
            const result = await this.handleMethod(
                message.method,
                message.params,
                request,
            );
            return Response.json({ jsonrpc: '2.0', id, result });
        } catch (error) {
            return this.errorFor(id, error);
        }
    }

    private async handleMethod(
        method: string,
        params: JsonObject | undefined,
        request: BaseRequest,
    ): Promise<Json> {
        switch (method) {
            case 'initialize':
                return this.initialize(params);
            case 'ping':
                return {};
            case 'tools/list':
                return { tools: await this.listTools(request) };
            case 'tools/call':
                return this.callTool(params, request);
            default:
                throw new McpProtocolError(
                    JsonRpcErrorCode.MethodNotFound,
                    `Method not found: ${method}`,
                );
        }
    }

    private initialize(params: JsonObject | undefined): Json {
        const requested = params?.protocolVersion;
        const protocolVersion =
            typeof requested === 'string' &&
            McpSupportedProtocolVersions.includes(requested)
                ? requested
                : McpSupportedProtocolVersions[0];
        return {
            protocolVersion,
            capabilities: { tools: {} },
            serverInfo: { ...this.serverInfo },
            ...(this.settings.instructions !== undefined && {
                instructions: this.settings.instructions,
            }),
        };
    }

    private async listTools(request: BaseRequest): Promise<Json[]> {
        const visible: Json[] = [];
        for (const tool of this.tools.all()) {
            if (await this.isVisible(tool, request)) {
                visible.push(tool.definition as unknown as Json);
            }
        }
        return visible;
    }

    private async callTool(
        params: JsonObject | undefined,
        request: BaseRequest,
    ): Promise<Json> {
        const name = params?.name;
        const args = params?.arguments;
        if (
            typeof name !== 'string' ||
            (args !== undefined && !isJsonObject(args))
        ) {
            throw new McpProtocolError(
                JsonRpcErrorCode.InvalidParams,
                'tools/call takes a string `name` and an object `arguments`.',
            );
        }

        const tool = this.tools.get(name);
        if (!tool || !(await this.isVisible(tool, request))) {
            throw unknownTool(name);
        }

        const call: RpcCall = {
            type: 'request',
            id: crypto.randomUUID(),
            procedure: tool.procedureName,
            arguments: tool.toRpcArguments(args),
            __protocol: 'BaseRPC',
            __version: '1.0',
        };
        let result: RpcResult;
        try {
            result = await this.rpcDispatcher().dispatch(call, request);
        } catch (error) {
            // session access is enforced again inside dispatch; a denial
            // there answers the same as a hidden tool
            if (isSessionDenial(error)) {
                throw unknownTool(name);
            }
            if (isAuthenticationRequired(error)) {
                throw new McpCredentialsRejected(error);
            }
            const { safe, raw, masked } = BaseError.forClient(error);
            if (masked) {
                Logger.error(LogCategory.Mcp, '%o', raw);
            }
            return toolError(safe.message);
        }
        return toolResult(result);
    }

    /**
     * Whether the caller's session access allows the tool, evaluated
     * without running its handler. A provider rejecting the request's
     * credentials surfaces as HTTP 401; other provider errors propagate.
     */
    private async isVisible(
        tool: McpTool,
        request: BaseRequest,
    ): Promise<boolean> {
        try {
            const denial = await sessionAccessDenial(
                request.context as HandlerRequestContext,
                tool.handler,
            );
            return denial === undefined;
        } catch (error) {
            if (isAuthenticationRequired(error)) {
                throw new McpCredentialsRejected(error);
            }
            throw error;
        }
    }

    /**
     * Refuses a browser origin not on the allow-list (DNS-rebinding
     * protection) and, when an allow-list is set, an unlisted `Host`.
     */
    private refuseOrigin(request: BaseRequest): Response | undefined {
        const origin = request.headers.get('origin');
        if (origin !== null && !this.settings.allowedOrigins.includes(origin)) {
            Logger.warn(LogCategory.Mcp, 'Refused MCP origin %s.', origin);
            return errorResponse(
                null,
                JsonRpcErrorCode.InvalidRequest,
                `Origin not allowed: ${origin}`,
                403,
            );
        }
        const allowedHosts = this.settings.allowedHosts;
        if (allowedHosts) {
            const host =
                request.headers.get('host') ?? new URL(request.url).host;
            if (!allowedHosts.includes(host)) {
                Logger.warn(LogCategory.Mcp, 'Refused MCP host %s.', host);
                return errorResponse(
                    null,
                    JsonRpcErrorCode.InvalidRequest,
                    `Host not allowed: ${host}`,
                    403,
                );
            }
        }
        return undefined;
    }

    private errorFor(id: JsonRpcId, error: unknown): Response {
        if (error instanceof McpProtocolError) {
            return errorResponse(id, error.code, error.message, 200);
        }
        if (error instanceof McpCredentialsRejected) {
            return errorResponse(
                id,
                JsonRpcErrorCode.InvalidRequest,
                error.error.toJSON().message,
                401,
            );
        }
        const { safe, raw, masked } = BaseError.forClient(error);
        if (masked) {
            Logger.error(LogCategory.Mcp, '%o', raw);
        }
        return errorResponse(
            id,
            JsonRpcErrorCode.InternalError,
            safe.message,
            200,
        );
    }
}

interface JsonRpcMessage {
    readonly jsonrpc: '2.0';
    readonly id?: JsonRpcId;
    readonly method?: unknown;
    readonly params?: JsonObject;
}

/**
 * A single JSON-RPC 2.0 message (batches were removed from MCP). Requests
 * carry a string or number id; `params`, when present, is an object.
 */
function isJsonRpcMessage(value: unknown): value is JsonRpcMessage {
    if (!isJsonObject(value) || value.jsonrpc !== '2.0') {
        return false;
    }
    const id = value.id;
    if (id !== undefined && typeof id !== 'string' && typeof id !== 'number') {
        return false;
    }
    return value.params === undefined || isJsonObject(value.params);
}

function isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorResponse(
    id: JsonRpcId | null,
    code: JsonRpcErrorCode,
    message: string,
    status: number,
): Response {
    return Response.json(
        { jsonrpc: '2.0', id, error: { code, message } },
        { status },
    );
}

function unknownTool(name: string): McpProtocolError {
    return new McpProtocolError(
        JsonRpcErrorCode.InvalidParams,
        `Unknown tool: ${name}`,
    );
}

function isSessionDenial(error: unknown): error is BaseError {
    return (
        error instanceof BaseError &&
        (error.errorCode === ERROR_CODE_PERMISSION_DENIED ||
            error.errorCode === ERROR_CODE_INSUFFICIENT_ENTITLEMENTS)
    );
}

function isAuthenticationRequired(error: unknown): error is BaseError {
    return (
        error instanceof BaseError &&
        error.errorCode === ERROR_CODE_AUTHENTICATION_REQUIRED
    );
}

/**
 * A successful call: the result as JSON text, and as `structuredContent`,
 * which must be an object, so a primitive or array is wrapped as
 * `{ result }`. A procedure that returns nothing gets empty content.
 */
function toolResult(result: RpcResult): Json {
    if (isRpcFailureResponse(result)) {
        const { message, cause } = result.error;
        return toolError(
            cause ? `${message}\n${JSON.stringify(cause)}` : message,
        );
    }
    const value = result.result as Json | undefined;
    if (value === undefined) {
        return { content: [] };
    }
    return {
        content: [{ type: 'text', text: JSON.stringify(value) }],
        structuredContent: isJsonObject(value) ? value : { result: value },
    };
}

/**
 * A failed call, reported to the model as a tool result (not a protocol
 * error) so it can read the message and correct its call.
 */
function toolError(message: string): Json {
    return { content: [{ type: 'text', text: message }], isError: true };
}
