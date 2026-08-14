// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { printSchemaWithDirectives } from '@graphql-tools/utils';
import {
    BreakingChangeType,
    buildSchema,
    DangerousChangeType,
    lexicographicSortSchema,
    type GraphQLSchema,
} from 'graphql';

import { Base } from '@system-inc/base-foundation/base/Base';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import {
    performGqlSchemaCheck,
    printGqlSchemaCheckResult,
} from './GqlSchemaCheck';

/**
 * Test fixture: stand-ins for the two real collaborators. We only need
 * `getGqlSchema()` from Base and `worker`/`graphqlSchemaFolder` from
 * BaseWorkerProject — minimal mocks keep the test pure and decoupled.
 */
function makeBase(currentSchema: GraphQLSchema): Base {
    return {
        getGqlSchema: async () => currentSchema,
    } as unknown as Base;
}

function makeProject(
    workerName: string,
    schemaFolder: string,
): BaseWorkerProject {
    return {
        worker: workerName,
        graphqlSchemaFolder: schemaFolder,
    } as unknown as BaseWorkerProject;
}

/**
 * Write a baseline file using the same canonical form
 * performGqlSchemaCheck uses internally for the current schema. Lets
 * "no changes" tests assert state: 'ok' without round-trip noise.
 */
function writeCanonicalBaseline(folder: string, schema: GraphQLSchema): string {
    fs.mkdirSync(folder, { recursive: true });
    const sdl = printSchemaWithDirectives(lexicographicSortSchema(schema));
    const baselinePath = path.join(folder, 'schema.graphql');
    fs.writeFileSync(baselinePath, sdl);
    return baselinePath;
}

describe('performGqlSchemaCheck', () => {
    let schemaFolder: string;

    beforeEach(() => {
        schemaFolder = fs.realpathSync(
            fs.mkdtempSync(path.join(os.tmpdir(), 'base-cli-gqlcheck-')),
        );
    });

    afterEach(() => {
        fs.rmSync(schemaFolder, { recursive: true, force: true });
    });

    it("returns 'missing-baseline' when schema.graphql doesn't exist", async () => {
        const current = buildSchema(`type Query { foo: String }`);

        const result = await performGqlSchemaCheck(
            makeBase(current),
            makeProject('test-worker', schemaFolder),
        );

        expect(result.state).toBe('missing-baseline');
        expect(result.workerName).toBe('test-worker');
        expect(result.baselinePath).toBe(
            path.join(schemaFolder, 'schema.graphql'),
        );
        expect(result.breaking).toEqual([]);
        expect(result.dangerous).toEqual([]);
    });

    it("returns 'ok' when current matches baseline", async () => {
        const schema = buildSchema(`type Query { foo: String, bar: Int }`);
        writeCanonicalBaseline(schemaFolder, schema);

        const result = await performGqlSchemaCheck(
            makeBase(schema),
            makeProject('test-worker', schemaFolder),
        );

        expect(result.state).toBe('ok');
        expect(result.breaking).toEqual([]);
        expect(result.dangerous).toEqual([]);
    });

    it("returns 'breaking' when a field is removed from current", async () => {
        const baseline = buildSchema(`type Query { foo: String, bar: Int }`);
        writeCanonicalBaseline(schemaFolder, baseline);

        // Current is missing `bar` — clients using it would break.
        const current = buildSchema(`type Query { foo: String }`);

        const result = await performGqlSchemaCheck(
            makeBase(current),
            makeProject('test-worker', schemaFolder),
        );

        expect(result.state).toBe('breaking');
        // graphql-js may report multiple cascading changes (e.g. an
        // unreferenced scalar type being removed alongside the field
        // that referenced it). Just verify the field removal is in
        // the set.
        expect(result.breaking.length).toBeGreaterThan(0);
        expect(
            result.breaking.some((change) =>
                change.description.includes('bar'),
            ),
        ).toBe(true);
    });

    it("returns 'breaking' when a type is removed", async () => {
        const baseline = buildSchema(`
            type Query { foo: String, item: Item }
            type Item { id: ID! }
        `);
        writeCanonicalBaseline(schemaFolder, baseline);

        // Type removal is the canonical "this will break clients" case.
        // We replace Item's field with a scalar so the schema still parses.
        const current = buildSchema(`
            type Query { foo: String, item: String }
        `);

        const result = await performGqlSchemaCheck(
            makeBase(current),
            makeProject('test-worker', schemaFolder),
        );

        expect(result.state).toBe('breaking');
        expect(result.breaking.length).toBeGreaterThan(0);
    });

    it("returns 'dangerous-only' when an enum value is added", async () => {
        // Adding an enum value is dangerous (exhaustive client switches
        // may break) but not breaking (existing values still work).
        const baseline = buildSchema(`
            enum Color { RED }
            type Query { color: Color }
        `);
        writeCanonicalBaseline(schemaFolder, baseline);

        const current = buildSchema(`
            enum Color { RED GREEN }
            type Query { color: Color }
        `);

        const result = await performGqlSchemaCheck(
            makeBase(current),
            makeProject('test-worker', schemaFolder),
        );

        expect(result.state).toBe('dangerous-only');
        expect(result.breaking).toEqual([]);
        expect(result.dangerous).toHaveLength(1);
        expect(result.dangerous[0].description).toContain('GREEN');
    });

    it("prefers 'breaking' over 'dangerous-only' when both exist", async () => {
        // Drop one field (breaking) AND add an enum value (dangerous)
        // in the same diff. The breaking signal dominates.
        const baseline = buildSchema(`
            enum Color { RED }
            type Query { color: Color, oldField: Int }
        `);
        writeCanonicalBaseline(schemaFolder, baseline);

        const current = buildSchema(`
            enum Color { RED GREEN }
            type Query { color: Color }
        `);

        const result = await performGqlSchemaCheck(
            makeBase(current),
            makeProject('test-worker', schemaFolder),
        );

        expect(result.state).toBe('breaking');
        // The result still surfaces the dangerous list so callers/UI
        // can show both when they want — state just reports the worst.
        expect(result.breaking.length).toBeGreaterThan(0);
        expect(result.dangerous.length).toBeGreaterThan(0);
    });

    it('carries workerName and baselinePath on every result shape', async () => {
        const schema = buildSchema(`type Query { foo: String }`);
        writeCanonicalBaseline(schemaFolder, schema);

        const result = await performGqlSchemaCheck(
            makeBase(schema),
            makeProject('my-worker', schemaFolder),
        );

        expect(result.workerName).toBe('my-worker');
        expect(result.baselinePath).toBe(
            path.join(schemaFolder, 'schema.graphql'),
        );
    });
});

/**
 * Verifies the printer formats each state with the right channel and
 * tone. We capture stdout/stderr instead of asserting exact strings —
 * the wording will drift over time, but the channel and the presence
 * of key fragments (worker name, change descriptions) should not.
 */
describe('printGqlSchemaCheckResult', () => {
    let logSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
    });

    function logged(): string {
        return logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    }

    function errored(): string {
        return errorSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    }

    it('ok state logs success to stdout, nothing on stderr', () => {
        printGqlSchemaCheckResult({
            state: 'ok',
            workerName: 'foo',
            baselinePath: '/tmp/foo/schema.graphql',
            breaking: [],
            dangerous: [],
        });

        expect(logged()).toContain('foo');
        expect(logged()).toMatch(/backward-compatible|ok|✅/i);
        expect(errored()).toBe('');
    });

    it('missing-baseline goes to stderr with a generate hint', () => {
        printGqlSchemaCheckResult({
            state: 'missing-baseline',
            workerName: 'foo',
            baselinePath: '/tmp/foo/schema.graphql',
            breaking: [],
            dangerous: [],
        });

        expect(errored()).toContain('/tmp/foo/schema.graphql');
        expect(errored()).toMatch(/schema:generate/);
    });

    it('breaking state writes changes to stderr', () => {
        printGqlSchemaCheckResult({
            state: 'breaking',
            workerName: 'foo',
            baselinePath: '/tmp/foo/schema.graphql',
            breaking: [
                {
                    type: BreakingChangeType.FIELD_REMOVED,
                    description: 'Query.bar was removed.',
                },
            ],
            dangerous: [],
        });

        expect(errored()).toContain('Query.bar was removed.');
        expect(errored()).toMatch(/breaking/i);
    });

    it('dangerous-only writes changes to stdout (warning, not failure)', () => {
        printGqlSchemaCheckResult({
            state: 'dangerous-only',
            workerName: 'foo',
            baselinePath: '/tmp/foo/schema.graphql',
            breaking: [],
            dangerous: [
                {
                    type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
                    description: 'GREEN was added to Color.',
                },
            ],
        });

        expect(logged()).toContain('GREEN was added to Color.');
        // Pure-warning case shouldn't trip stderr — exit-on-error wiring
        // in the caller depends on stderr being clean here.
        expect(errored()).toBe('');
    });

    it('applies a log prefix to per-line output', () => {
        printGqlSchemaCheckResult(
            {
                state: 'ok',
                workerName: 'foo',
                baselinePath: '/tmp/foo/schema.graphql',
                breaking: [],
                dangerous: [],
            },
            { logPrefix: '[foo]: ' },
        );

        expect(logged()).toContain('[foo]: ');
    });
});
