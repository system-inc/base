// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';

import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import { ormGetDrizzleBoilerplatePath } from './OrmGetDrizzleBoilerplate';

/**
 * Read the `release.ts` file as plain text and extract the tag list.
 * Doesn't import or evaluate — just parses the literal array.
 *
 * Returns an empty array if the file doesn't exist (treat as "nothing
 * has been released yet").
 */
export function readReleasedTags(
    workerProject: BaseWorkerProject,
    databaseName: string,
): string[] {
    const releasePath = getReleaseFilePath(workerProject, databaseName);
    if (!fs.existsSync(releasePath)) {
        return [];
    }
    const content = fs.readFileSync(releasePath, 'utf8');
    return parseReleasedTagsFromSource(content);
}

/**
 * Append new tags to the `release.ts` released array. Preserves
 * comments and formatting elsewhere in the file by only inserting
 * before the closing `]` of the released array. Deduplicates against
 * what's already there.
 *
 * Returns the list of tags actually added.
 */
export function appendReleasedTags(
    workerProject: BaseWorkerProject,
    databaseName: string,
    newTags: string[],
): string[] {
    const releasePath = getReleaseFilePath(workerProject, databaseName);
    if (!fs.existsSync(releasePath)) {
        throw new Error(
            `release.ts not found at ${releasePath}. Run \`base orm schema:generate\` first to scaffold it.`,
        );
    }

    const content = fs.readFileSync(releasePath, 'utf8');
    const existing = new Set(parseReleasedTagsFromSource(content));
    const toAdd = newTags.filter((t) => !existing.has(t));

    if (toAdd.length === 0) {
        return [];
    }

    // Find `released: [` and the matching `]`.
    const arrayMatch = /(released\s*:\s*\[)([\s\S]*?)(\])/.exec(content);
    if (!arrayMatch) {
        throw new Error(
            `Could not locate \`released: [...]\` in ${releasePath}. ` +
                `Either it has unusual formatting, or the file has been ` +
                `customized in a way the CLI doesn't recognize. ` +
                `Edit the file manually to add: ${toAdd.join(', ')}`,
        );
    }

    // Detect the indent of existing entries (look for a tag-like
    // string inside the array) so we match the user's style.
    const body = arrayMatch[2];
    const entryIndent = detectArrayIndent(body) ?? '        ';

    // Closing-bracket indent: match the indent of the line the array
    // opens on, so `]` lines up under `released:`.
    const openLineStart = content.lastIndexOf('\n', arrayMatch.index) + 1;
    const closingIndent =
        /^[ \t]*/.exec(content.slice(openLineStart, arrayMatch.index))?.[0] ??
        '';

    // Rebuild the array body's separators rather than blindly inserting
    // before `]`: the scaffold (and hand edits) may keep the array on a
    // single line — `released: ['0000_foo'] as string[]` — where a bare
    // insertion would drop the comma between entries and produce
    // invalid TypeScript. Existing entry bytes (and any comments among
    // them) are preserved; only trailing whitespace and the separator
    // before the new entries are normalized.
    const entries = toAdd.map((t) => `${entryIndent}'${t}',\n`).join('');
    const existingBody = body.replace(/[ \t\n]+$/, '');
    const newBody =
        existingBody === ''
            ? `\n${entries}${closingIndent}`
            : `${existingBody}${existingBody.endsWith(',') ? '' : ','}\n${entries}${closingIndent}`;

    const updated =
        content.slice(0, arrayMatch.index + arrayMatch[1].length) +
        newBody +
        content.slice(
            arrayMatch.index + arrayMatch[1].length + arrayMatch[2].length,
        );

    fs.writeFileSync(releasePath, updated);
    return toAdd;
}

function getReleaseFilePath(
    workerProject: BaseWorkerProject,
    databaseName: string,
): string {
    return path.join(
        ormGetDrizzleBoilerplatePath(workerProject, databaseName),
        'release.ts',
    );
}

function parseReleasedTagsFromSource(content: string): string[] {
    const arrayMatch = /released\s*:\s*\[([\s\S]*?)\]/.exec(content);
    if (!arrayMatch) return [];
    const inside = arrayMatch[1];
    return [...inside.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

function detectArrayIndent(arrayBody: string): string | null {
    // Find the first line that starts with whitespace followed by a quote.
    const m = /(^|\n)([ \t]+)['"]/.exec(arrayBody);
    return m ? m[2] : null;
}

/**
 * Delete any unreleased migrations from the given database's drizzle
 * dir so that drizzle-kit's next `generate` will produce a fresh
 * migration absorbing all current changes since the last released
 * one. Released migrations are append-only and never touched.
 *
 * Returns the list of tags folded away (empty if nothing was
 * unreleased — the next generate will just create a new migration
 * after the current head).
 *
 * Removes, for each unreleased entry:
 *   - the migration SQL file (e.g. `0003_strange_shard.sql`)
 *   - the corresponding meta snapshot (e.g. `meta/0003_snapshot.json`)
 *   - the entry from `meta/_journal.json`
 *
 * Safe to call regardless of whether release.ts exists; an absent
 * release file means "nothing released," so nothing gets folded (all
 * existing migrations are treated as released-by-default to avoid
 * destroying work).
 */
export function foldUnreleasedMigrations(
    workerProject: BaseWorkerProject,
    databaseName: string,
): string[] {
    const drizzleDir = path.join(
        workerProject.workerFolder,
        'database',
        databaseName,
        'drizzle',
    );
    const journalPath = path.join(
        drizzleDir,
        'migrations',
        'meta',
        '_journal.json',
    );
    if (!fs.existsSync(journalPath)) {
        return [];
    }

    // If release.ts doesn't exist (legacy or first-run state), treat
    // all entries as released to avoid clobbering them.
    const releaseFilePath = path.join(drizzleDir, 'release.ts');
    if (!fs.existsSync(releaseFilePath)) {
        return [];
    }

    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
        entries?: Array<{ idx: number; tag: string; [k: string]: unknown }>;
        [k: string]: unknown;
    };
    const entries = journal.entries ?? [];

    const released = new Set(readReleasedTags(workerProject, databaseName));

    const foldedTags: string[] = [];
    const keptEntries: typeof entries = [];

    for (const entry of entries) {
        if (released.has(entry.tag)) {
            keptEntries.push(entry);
            continue;
        }
        foldedTags.push(entry.tag);

        // Delete the SQL file. drizzle-kit names them `{idx_4-pad}_{name}.sql`,
        // matching the tag in the journal.
        const sqlPath = path.join(drizzleDir, 'migrations', `${entry.tag}.sql`);
        if (fs.existsSync(sqlPath)) {
            fs.unlinkSync(sqlPath);
        }

        // Delete the snapshot.
        const snapshotPath = path.join(
            drizzleDir,
            'migrations',
            'meta',
            `${entry.idx.toString().padStart(4, '0')}_snapshot.json`,
        );
        if (fs.existsSync(snapshotPath)) {
            fs.unlinkSync(snapshotPath);
        }
    }

    if (foldedTags.length === 0) {
        return [];
    }

    // Rewrite the journal with only the released entries kept.
    journal.entries = keptEntries;
    fs.writeFileSync(journalPath, JSON.stringify(journal, null, 4));

    return foldedTags;
}

/**
 * For every drizzle database in the worker (any driver — D1, PlanetScale,
 * better-sqlite, Durable Object SQLite), check that every migration tag in
 * the journal is in that database's `release.ts` released list. Returns the
 * unreleased tags per database (empty map means clean).
 *
 * Used by `base deploy` to refuse promotion to non-Development envs
 * when migrations haven't been released yet.
 */
export function findUnreleasedMigrations(
    workerProject: BaseWorkerProject,
): Map<string, string[]> {
    const result = new Map<string, string[]>();
    const databaseFolder = path.join(workerProject.workerFolder, 'database');
    if (!fs.existsSync(databaseFolder)) {
        return result;
    }

    for (const dirent of fs.readdirSync(databaseFolder, {
        withFileTypes: true,
    })) {
        if (!dirent.isDirectory()) continue;
        const databaseName = dirent.name;
        const drizzleDir = path.join(databaseFolder, databaseName, 'drizzle');
        const journalPath = path.join(
            drizzleDir,
            'migrations',
            'meta',
            '_journal.json',
        );
        if (!fs.existsSync(journalPath)) continue;

        const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
            entries?: Array<{ tag: string }>;
        };
        const tags = (journal.entries ?? []).map((e) => e.tag);
        const released = new Set(readReleasedTags(workerProject, databaseName));
        const unreleased = tags.filter((t) => !released.has(t));
        if (unreleased.length > 0) {
            result.set(databaseName, unreleased);
        }
    }

    return result;
}
