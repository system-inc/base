// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import { appendReleasedTags, readReleasedTags } from './OrmReleaseFile';

/**
 * `release.ts` is the migration release ledger. Drift in its parser
 * silently lets unreleased migrations slip through deploy — so we
 * pin the parse/write behavior here. Both helpers operate on text
 * (no module loading) which keeps the test surface fully isolated.
 */

const DATABASE_NAME = 'default';

function makeProject(workerFolder: string): BaseWorkerProject {
    return { workerFolder } as unknown as BaseWorkerProject;
}

function makeRelease(workerFolder: string, body: string): string {
    const dir = path.join(workerFolder, 'database', DATABASE_NAME, 'drizzle');
    fs.mkdirSync(dir, { recursive: true });
    const releasePath = path.join(dir, 'release.ts');
    fs.writeFileSync(releasePath, body);
    return releasePath;
}

describe('readReleasedTags', () => {
    let workerFolder: string;

    beforeEach(() => {
        workerFolder = fs.realpathSync(
            fs.mkdtempSync(path.join(os.tmpdir(), 'base-cli-release-')),
        );
    });

    afterEach(() => {
        fs.rmSync(workerFolder, { recursive: true, force: true });
    });

    it('returns [] when release.ts does not exist', () => {
        // Treat "no file" as "nothing released yet" — first run of
        // the migration system on a worker.
        expect(
            readReleasedTags(makeProject(workerFolder), DATABASE_NAME),
        ).toEqual([]);
    });

    it('parses single-quoted entries', () => {
        makeRelease(
            workerFolder,
            `export const Release = {
                released: [
                    '0000_foo',
                    '0001_bar',
                ],
            };`,
        );

        expect(
            readReleasedTags(makeProject(workerFolder), DATABASE_NAME),
        ).toEqual(['0000_foo', '0001_bar']);
    });

    it('parses double-quoted entries', () => {
        makeRelease(
            workerFolder,
            `export const Release = { released: ["0000_foo", "0001_bar"] };`,
        );

        expect(
            readReleasedTags(makeProject(workerFolder), DATABASE_NAME),
        ).toEqual(['0000_foo', '0001_bar']);
    });

    it('returns [] for an empty released array', () => {
        makeRelease(workerFolder, `export const Release = { released: [] };`);

        expect(
            readReleasedTags(makeProject(workerFolder), DATABASE_NAME),
        ).toEqual([]);
    });

    it('returns [] when no released field is present', () => {
        // Don't crash on malformed/foreign files — just treat as empty.
        makeRelease(workerFolder, `// no released field here`);

        expect(
            readReleasedTags(makeProject(workerFolder), DATABASE_NAME),
        ).toEqual([]);
    });

    it('tolerates whitespace and newlines inside the array', () => {
        makeRelease(
            workerFolder,
            `export const Release = {
                released:    [

                    '0000_foo',

                    '0001_bar'
                ],
            };`,
        );

        expect(
            readReleasedTags(makeProject(workerFolder), DATABASE_NAME),
        ).toEqual(['0000_foo', '0001_bar']);
    });
});

describe('appendReleasedTags', () => {
    let workerFolder: string;

    beforeEach(() => {
        workerFolder = fs.realpathSync(
            fs.mkdtempSync(path.join(os.tmpdir(), 'base-cli-release-')),
        );
    });

    afterEach(() => {
        fs.rmSync(workerFolder, { recursive: true, force: true });
    });

    it('throws when release.ts is missing', () => {
        // Missing means the scaffold step never ran. Refuse rather
        // than silently creating a fresh ledger that hides history.
        expect(() =>
            appendReleasedTags(makeProject(workerFolder), DATABASE_NAME, [
                '0000_foo',
            ]),
        ).toThrow(/release\.ts not found/);
    });

    it('appends new tags before the closing bracket', () => {
        const releasePath = makeRelease(
            workerFolder,
            `export const Release = {
    released: [
        '0000_foo',
    ],
};`,
        );

        const added = appendReleasedTags(
            makeProject(workerFolder),
            DATABASE_NAME,
            ['0001_bar', '0002_baz'],
        );

        expect(added).toEqual(['0001_bar', '0002_baz']);
        expect(
            readReleasedTags(makeProject(workerFolder), DATABASE_NAME),
        ).toEqual(['0000_foo', '0001_bar', '0002_baz']);
        // Surrounding file structure is preserved.
        const after = fs.readFileSync(releasePath, 'utf8');
        expect(after).toContain('export const Release = {');
        expect(after.trimEnd().endsWith('};')).toBe(true);
    });

    it('deduplicates against existing entries and returns only what was added', () => {
        makeRelease(
            workerFolder,
            `export const Release = {
    released: [
        '0000_foo',
        '0001_bar',
    ],
};`,
        );

        const added = appendReleasedTags(
            makeProject(workerFolder),
            DATABASE_NAME,
            ['0001_bar', '0002_baz'], // 0001_bar is dup
        );

        expect(added).toEqual(['0002_baz']);
        expect(
            readReleasedTags(makeProject(workerFolder), DATABASE_NAME),
        ).toEqual(['0000_foo', '0001_bar', '0002_baz']);
    });

    it('returns [] without modifying the file when all tags already exist', () => {
        const releasePath = makeRelease(
            workerFolder,
            `export const Release = {
    released: [
        '0000_foo',
    ],
};`,
        );
        const before = fs.readFileSync(releasePath, 'utf8');

        const added = appendReleasedTags(
            makeProject(workerFolder),
            DATABASE_NAME,
            ['0000_foo'],
        );

        expect(added).toEqual([]);
        // Byte-for-byte unchanged — important for git/CI noise reduction.
        expect(fs.readFileSync(releasePath, 'utf8')).toBe(before);
    });

    it('detects and preserves the existing array indent', () => {
        // The detector uses the first indented quote inside the array.
        // A 4-space indent should remain a 4-space indent after append.
        const releasePath = makeRelease(
            workerFolder,
            `export const Release = {
    released: [
        '0000_foo',
    ],
};`,
        );

        appendReleasedTags(makeProject(workerFolder), DATABASE_NAME, [
            '0001_bar',
        ]);

        const content = fs.readFileSync(releasePath, 'utf8');
        // The appended tag should sit on its own line, indented to
        // match '0000_foo'. We don't assert exact byte count to stay
        // resilient to tab vs space style — just that there's at
        // least leading whitespace before the new entry.
        expect(content).toMatch(/\n\s+'0001_bar',\n/);
    });

    it('appends into the scaffold’s empty single-line array', () => {
        // The scaffold writes `released: [] as string[]` on one line.
        const releasePath = makeRelease(
            workerFolder,
            `export default {
    released: [] as string[],
};`,
        );

        appendReleasedTags(makeProject(workerFolder), DATABASE_NAME, [
            '0000_foo',
        ]);

        expect(
            readReleasedTags(makeProject(workerFolder), DATABASE_NAME),
        ).toEqual(['0000_foo']);
        const content = fs.readFileSync(releasePath, 'utf8');
        expect(content).toContain("released: [\n        '0000_foo',\n    ]");
    });

    it('adds the missing comma when appending to a single-line array with entries', () => {
        // A hand-edited single-line entry must gain a separating comma —
        // a bare insertion before `]` would produce invalid TypeScript.
        const releasePath = makeRelease(
            workerFolder,
            `export default {
    released: ['0000_foo'] as string[],
};`,
        );

        appendReleasedTags(makeProject(workerFolder), DATABASE_NAME, [
            '0001_bar',
        ]);

        expect(
            readReleasedTags(makeProject(workerFolder), DATABASE_NAME),
        ).toEqual(['0000_foo', '0001_bar']);
        const content = fs.readFileSync(releasePath, 'utf8');
        expect(content).toContain("'0000_foo',");
        expect(content).toMatch(/'0000_foo',\n\s+'0001_bar',\n/);
    });

    it('throws when the released array pattern cannot be located', () => {
        // The file exists but doesn't match the expected `released: [...]`
        // shape. Refuse to write rather than guess.
        makeRelease(
            workerFolder,
            `// Some other file shape with no released array`,
        );

        expect(() =>
            appendReleasedTags(makeProject(workerFolder), DATABASE_NAME, [
                '0000_foo',
            ]),
        ).toThrow(/Could not locate `released:/);
    });
});
