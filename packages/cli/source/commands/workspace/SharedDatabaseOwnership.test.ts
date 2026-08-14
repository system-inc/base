// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { SharedDatabaseOwnershipCollector } from './SharedDatabaseOwnership';

/**
 * The shared-database contract is one owner (migrator) per table; a
 * second owner means two migration histories write DDL for the same
 * table. The collector compares claims by physical database identity,
 * because two workers may name the same database differently.
 */
describe('SharedDatabaseOwnershipCollector', () => {
    it('reports a table owned by two workers on the same database', () => {
        const collector = new SharedDatabaseOwnershipCollector();
        collector.record({
            workerName: 'account',
            databaseName: '@default',
            databaseIdentity: 'd1:abc-123',
            tableNames: ['account', 'session'],
        });
        collector.record({
            workerName: 'billing',
            databaseName: 'accountDb',
            databaseIdentity: 'd1:abc-123',
            tableNames: ['session', 'invoice'],
        });

        const violations = collector.findViolations();
        expect(violations).toHaveLength(1);
        expect(violations[0]!.tableName).toBe('session');
        expect(violations[0]!.databaseIdentity).toBe('d1:abc-123');
        expect(
            violations[0]!.owners.map((owner) => owner.workerName).sort(),
        ).toEqual(['account', 'billing']);
    });

    it('does not report the same table name on different databases', () => {
        const collector = new SharedDatabaseOwnershipCollector();
        collector.record({
            workerName: 'account',
            databaseName: '@default',
            databaseIdentity: 'd1:abc-123',
            tableNames: ['settings'],
        });
        collector.record({
            workerName: 'billing',
            databaseName: '@default',
            databaseIdentity: 'd1:def-456',
            tableNames: ['settings'],
        });
        expect(collector.findViolations()).toEqual([]);
    });

    it('does not report one worker claiming a table twice', () => {
        // Registering the same table via two paths (owned + module) is
        // idempotent within a worker, never a cross-worker conflict.
        const collector = new SharedDatabaseOwnershipCollector();
        collector.record({
            workerName: 'account',
            databaseName: '@default',
            databaseIdentity: 'd1:abc-123',
            tableNames: ['account'],
        });
        collector.record({
            workerName: 'account',
            databaseName: '@default',
            databaseIdentity: 'd1:abc-123',
            tableNames: ['account'],
        });
        expect(collector.findViolations()).toEqual([]);
    });

    it('reports each doubly-owned table on a database separately', () => {
        const collector = new SharedDatabaseOwnershipCollector();
        collector.record({
            workerName: 'a',
            databaseName: 'shared',
            databaseIdentity: 'mysql:host.example/app',
            tableNames: ['users', 'orders'],
        });
        collector.record({
            workerName: 'b',
            databaseName: 'shared',
            databaseIdentity: 'mysql:host.example/app',
            tableNames: ['users', 'orders'],
        });
        const violations = collector.findViolations();
        expect(
            violations.map((violation) => violation.tableName).sort(),
        ).toEqual(['orders', 'users']);
    });
});
