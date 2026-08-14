// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DurableObject } from 'cloudflare:workers';

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { Mutable } from '@system-inc/base-common/type/UtilityTypes';
import { BaseSettings } from '../../../base/BaseSettings';
import { EnvironmentVariables } from '../../../configuration/EnvironmentVariables';
import { PlatformType } from '../../../configuration/Platform';
import { BaseWebSocket } from '../../../web-socket/WebSocketTypes';
import { BaseWorker } from '../../../worker/BaseWorker';
import { CloudflareInjections } from '../../CloudflareInjections';
import { AlarmScheduledEvent } from './AlarmScheduledEvent';

/**
 * The Cloudflare Durable Object wraps the DurableObject class
 * and provides a BaseWorker instance to handle requests.
 */
export abstract class CfDurableObject extends DurableObject {
    protected abstract readonly settings: BaseSettings;

    private _worker: BaseWorker | null = null;
    protected get worker(): BaseWorker {
        if (!this._worker) {
            this._worker = BaseWorker.create(this.settings);
            this._worker.container.registerInstance(
                CloudflareInjections.DurableObjectState.toString(),
                this.state,
            );
        }
        return this._worker;
    }

    constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
        Logger.debug(
            LogCategory.Durable,
            'CfDurableObject.constructor %s',
            ctx.id.toString(),
        );
        super(ctx, env);
    }

    get state(): DurableObjectState {
        return this.ctx;
    }

    get environmentVariables(): EnvironmentVariables {
        const environmentVariables = this.env as Mutable<EnvironmentVariables>;
        // set the platform type to Cloudflare Durable Object
        if (!environmentVariables.PLATFORM) {
            environmentVariables.PLATFORM =
                PlatformType.CloudflareDurableObject;
        }
        return environmentVariables;
    }

    override async fetch(request: Request): Promise<Response> {
        Logger.debug(
            LogCategory.Durable,
            'CfDurableObject.fetch %s',
            this.state.id.toString(),
        );
        const response = await this.worker.fetch(
            request,
            this.environmentVariables,
        );
        return response;
    }

    override async alarm(alarmInfo?: AlarmInvocationInfo): Promise<void> {
        Logger.debug(LogCategory.Durable, 'CfDurableObject.alarm');
        await this.worker.scheduled(
            new AlarmScheduledEvent(alarmInfo),
            this.environmentVariables,
        );
    }

    override async webSocketMessage(
        webSocket: WebSocket,
        message: string | ArrayBuffer,
    ): Promise<void> {
        // Do NOT log `message`: on a busy socket this writes every payload —
        // which routinely carries user/PII data — to production logs.
        Logger.debug(
            LogCategory.Durable,
            'CfDurableObject.webSocketMessage %s',
            this.state.id.toString(),
        );
        return this.worker
            .getBase(this.environmentVariables)
            .webSocketMessage(webSocket as BaseWebSocket, message);
    }

    override async webSocketClose(webSocket: WebSocket): Promise<void> {
        Logger.debug(
            LogCategory.Durable,
            'CfDurableObject.webSocketClose %s',
            this.state.id.toString(),
        );
        return this.worker
            .getBase(this.environmentVariables)
            .webSocketClose(webSocket as BaseWebSocket);
    }

    override async webSocketError(
        webSocket: WebSocket,
        error: unknown,
    ): Promise<void> {
        Logger.debug(
            LogCategory.Durable,
            'CfDurableObject.webSocketError %s',
            this.state.id.toString(),
        );
        return this.worker
            .getBase(this.environmentVariables)
            .webSocketError(webSocket as BaseWebSocket, error);
    }
}
