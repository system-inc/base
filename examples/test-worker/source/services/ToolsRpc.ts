// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RequireSessionAccess } from '@system-inc/base-foundation/access-control/decorators/RequireSessionAccess';
import { Rpc } from '@system-inc/base-foundation/rpc/decorators/Rpc';
import { RpcArgument } from '@system-inc/base-foundation/rpc/decorators/RpcArgument';
import { RpcService } from '@system-inc/base-foundation/rpc/decorators/RpcService';
import { SerializableField } from '@system-inc/base-foundation/serialization/decorators/SerializableField';
import { SerializableObject } from '@system-inc/base-foundation/serialization/decorators/SerializableObject';
import { VerifyMaxLength } from '@system-inc/base-foundation/validation/decorators/VerifyMaxLength';

@SerializableObject()
export class SecretRequest {
    @VerifyMaxLength(20)
    @SerializableField(() => String, {
        description: 'The label to attach to the secret.',
    })
    label: string;
}

/**
 * RPC procedures exposed as MCP tools (see `mcp` in settings), served on
 * `/mcp` and exercised by `Mcp.integration.test.ts` with the official MCP
 * SDK client.
 */
@RpcService({ visibility: 'public' })
export class ToolsRpc {
    @Rpc({
        mcp: {
            description: 'Returns the text in upper case.',
            annotations: { readOnlyHint: true },
        },
    })
    async shout(
        @RpcArgument(() => String, {
            name: 'text',
            description: 'The text to shout.',
        })
        text: string,
    ): Promise<string> {
        return text.toUpperCase();
    }

    @RequireSessionAccess({ roles: ['Administrator'] })
    @Rpc({
        mcp: {
            description:
                'Returns a labeled secret. Visible only to administrators.',
        },
    })
    async adminSecret(
        @RpcArgument(() => SecretRequest) request: SecretRequest,
    ): Promise<{ label: string; secret: string }> {
        return { label: request.label, secret: 'swordfish' };
    }
}
