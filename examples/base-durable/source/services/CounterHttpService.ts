// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';
import { OrmDatabase } from '@system-inc/base-foundation/orm/database/OrmDatabase';
import { InjectDatabase } from '@system-inc/base-foundation/orm/decorators/InjectDatabase';
import { equals } from '@system-inc/base-foundation/orm/filters/OrmEqualsFilter';
import { HttpPath } from '@system-inc/base-foundation/router/decorators/HttpPath';
import { HttpRoute } from '@system-inc/base-foundation/router/decorators/HttpRoute';
import { HttpService } from '@system-inc/base-foundation/router/decorators/HttpService';
import { CounterEntity } from '../entities/CounterEntity';

/**
 * HTTP routes for the durable counter.
 *
 * The durable object is keyed by URL/ID; each counter row inside the DO
 * is keyed by the `:key` path parameter.
 */
@Injectable()
@HttpService()
export class CounterHttpService {
    constructor(
        @InjectDatabase()
        private readonly database: OrmDatabase,
    ) {}

    @HttpRoute('GET', '/counter/:key')
    async get(
        @HttpPath('key') key: string,
    ): Promise<{ key: string; value: number }> {
        const repository = this.database.getRepository(CounterEntity);
        const counter = await repository.findOne({
            where: { key: equals(key) },
        });
        return { key, value: counter?.value ?? 0 };
    }

    @HttpRoute('POST', '/counter/:key/increment')
    async increment(
        @HttpPath('key') key: string,
    ): Promise<{ key: string; value: number }> {
        const repository = this.database.getRepository(CounterEntity);
        const existing = await repository.findOne({
            where: { key: equals(key) },
        });
        if (existing) {
            existing.value += 1;
            await repository.update(existing);
            return { key, value: existing.value };
        }
        const created = CounterEntity.from({ key, value: 1 });
        await repository.insert(created);
        return { key, value: created.value };
    }
}
