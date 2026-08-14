// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as nodePath from 'node:path';

import { OrmDatabaseType } from '@system-inc/base-foundation/orm/database/adapter/OrmDatabaseType';
import { Run } from '../../common/Run';
import {
    ormGetDrizzleBoilerplate,
    ormGetDrizzleLocalD1Boilerplate,
} from '../../orm/drizzle/OrmGetDrizzleBoilerplate';
import { ormGetDrizzleCredentials } from '../../orm/drizzle/OrmGetDrizzleCredentials';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';

/**
 * Env var the generated drizzle.config.ts reads dbCredentials from.
 *
 * Resolving credentials in the CLI (where ts-node handles decorators)
 * and passing them via env keeps drizzle-kit's bundled loader out of
 * settings.ts — otherwise it walks foundation services and trips on
 * parameter decorators.
 */
export const DRIZZLE_CREDENTIALS_ENV = 'BASE_DRIZZLE_CREDENTIALS';

/**
 * Env var the generated drizzle.config.ts reads its `tablesFilter` from.
 *
 * Passed via env (not a CLI flag) because drizzle-kit's `push` refuses to mix
 * `--config` with config-level CLI options like `--tablesFilter`. Set fresh per
 * run so the filter always reflects the worker's current entities.
 */
export const DRIZZLE_TABLES_FILTER_ENV = 'BASE_DRIZZLE_TABLES_FILTER';

/**
 * Targets a drizzle-kit run at wrangler's local D1 sqlite file instead of
 * the remote database. drizzle-kit's `d1-http` driver only speaks to the
 * Cloudflare API, so local mode swaps in the plain-sqlite config variant
 * (`ormGetDrizzleLocalD1Boilerplate`) and passes the file path as the
 * credentials.
 */
export interface OrmLocalD1Target {
    /** Absolute path to the local sqlite file (see `miniflareD1SqlitePath`). */
    sqlitePath: string;
}

export async function ormRunDrizzleCommand(
    workerProject: BaseWorkerProject,
    environment: string,
    databaseName: string,
    databaseType: OrmDatabaseType,
    command: string,
    args: string[] = [],
    tablesFilter?: string[],
    localD1?: OrmLocalD1Target,
): Promise<string> {
    const configPath = localD1
        ? ormGetDrizzleLocalD1Boilerplate(workerProject, databaseName)
        : ormGetDrizzleBoilerplate(
              workerProject,
              environment,
              databaseName,
              databaseType,
          );

    // Non-durable databases need connection credentials. Resolve them
    // here (where ts-node handles decorators) and pass via env so the
    // generated drizzle.config.ts can be a static file with no settings
    // import. Durable has no credentials — drizzle.config.ts doesn't
    // reference the env var.
    const drizzleEnv: Record<string, string | undefined> = {
        ...process.env,
    };
    // Scope the command (push/introspect) to these tables via the config's
    // tablesFilter env read. Omitted → the config leaves tablesFilter unset.
    if (tablesFilter && tablesFilter.length > 0) {
        drizzleEnv[DRIZZLE_TABLES_FILTER_ENV] = tablesFilter.join(',');
    }
    // These drizzle-kit commands operate purely on the local migration folder
    // (snapshots/journal/SQL) and never connect to the database, so they don't
    // need credentials — resolving them would needlessly fail on workers
    // without real connection config (test stubs, fresh setups). `push`/
    // `migrate`/`introspect`/`studio` do connect and resolve creds below.
    const localOnlyCommands = new Set(['generate', 'check', 'up', 'drop']);
    const commandNeedsCredentials =
        databaseType.driver !== 'durable' && !localOnlyCommands.has(command);
    if (localD1) {
        // Local D1 target: the "credentials" are just the sqlite file path
        // wrangler persists for this database. No Cloudflare account/token
        // needed — local browsing works fully offline.
        drizzleEnv[DRIZZLE_CREDENTIALS_ENV] = JSON.stringify({
            url: localD1.sqlitePath,
        });
    } else if (commandNeedsCredentials) {
        const settingsModule =
            await workerProject.loadSettingsModule(environment);
        const credentials = ormGetDrizzleCredentials(
            workerProject,
            databaseName,
            environment,
            settingsModule.settings,
        );
        drizzleEnv[DRIZZLE_CREDENTIALS_ENV] = JSON.stringify(credentials ?? {});
    }

    const commandArgs = [command, `--config=${configPath}`, ...args];
    console.log(`Running Drizzle command: ${commandArgs.join(' ')}`);
    // Anchor drizzle-kit's CWD at the worker folder. The generated
    // drizzle.config.ts uses `./database/...` paths relative to here,
    // so this works the same no matter where the user invoked `base`.
    //
    // Resolving the bin via `require.resolve` instead of going through
    // `npx` matters: npx walks up looking for a workspace root and
    // silently changes CWD to it (e.g. from a worker folder up to the
    // examples/ root), which would defeat the cwd we just set.
    // captureOutput so a failure REPORTS ITSELF.
    //
    // With the default `stdio: 'inherit'`, drizzle-kit's error goes straight to
    // the terminal and `ProgramError.output` stays empty — and drizzle-kit's own
    // progress spinner rewrites its line with `\r`, so the message that mattered
    // is overwritten by the next frame before anyone can read it. The result was
    // a migration failing with nothing but a stack trace pointing at this call:
    // no failing statement, no MySQL error, no indication of how far it got.
    //
    // Capturing still prints everything live (silent is not set); it only ALSO
    // keeps the text, so the error below can carry it.
    try {
        return await Run.program(resolveDrizzleKitBin(), commandArgs, {
            env: drizzleEnv,
            cwd: workerProject.workerFolder,
            captureOutput: true,
        });
    } catch (error) {
        const output =
            error instanceof Run.ProgramError ? (error.output ?? '') : '';
        // Prefer the spinner-filtered tail; fall back to the raw buffer.
        //
        // The filtering drops spinner frames so the real message is readable,
        // but drizzle-kit prints some failures ONTO the spinner's own line, so a
        // message can share a frame with the text being discarded and vanish
        // with it. That once left "It produced no output" over a real, printed
        // MySQL error — a worse failure than the noise the filtering removes,
        // because silence reads as "nothing happened" when something very
        // specific did. Losing the real error to tidiness is the one outcome
        // this wrapper must never produce, so the unfiltered dump is the floor.
        const detail =
            drizzleOutputTail(output) || drizzleOutputRawTail(output);
        throw new Error(
            `Drizzle command '${command}' failed.` +
                (detail ? `\n\n${detail}\n` : ' It produced no output.'),
            { cause: error },
        );
    }
}

// ESC. Written as a char code because a literal escape byte in source is
// invisible to a reader and easy to mangle in an edit.
const asciiEscape = String.fromCharCode(27);

/** Erase-line + cursor-to-column-1 — one drizzle-kit spinner frame boundary. */
const spinnerFrameBoundary = `${asciiEscape}[2K${asciiEscape}[1G`;

/** Any ANSI control sequence, so captured output reads as plain text. */
const ansiEscapeSequence = new RegExp(`${asciiEscape}\\[[0-9;]*[A-Za-z]`, 'g');

/** A spinner frame with no message riding along — pure animation, no signal. */
const bareSpinnerFrame = /^\[.\] applying migrations\.\.\.$/;

/**
 * The meaningful tail of drizzle-kit's output, with the spinner removed.
 *
 * drizzle-kit animates with erase-line and NO newline, so every frame
 * overwrites the last and an error printed mid-spin is erased by the next
 * frame. Captured raw, the buffer is one long line of frames with the real
 * message buried between escape sequences. Splitting on the frame boundary
 * turns what was visually overwritten back into readable lines.
 */
function drizzleOutputTail(output: string): string {
    return output
        .split(spinnerFrameBoundary)
        .join('\n')
        .replace(ansiEscapeSequence, '')
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0 && !bareSpinnerFrame.test(line))
        .slice(-12)
        .join('\n');
}

/**
 * The tail of the raw buffer with only escape codes stripped — the fallback for
 * when filtering discards the very message it was meant to surface.
 */
function drizzleOutputRawTail(output: string): string {
    return output
        .replace(ansiEscapeSequence, '')
        .split(/[\r\n]+/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(-20)
        .join('\n');
}

function resolveDrizzleKitBin(): string {
    try {
        // drizzle-kit doesn't expose './package.json' in its `exports`, so
        // resolve the main entry and derive the package dir from that.
        const mainPath = require.resolve('drizzle-kit');
        return nodePath.join(nodePath.dirname(mainPath), 'bin.cjs');
    } catch (error) {
        throw new Error(
            `Could not resolve 'drizzle-kit': ${(error as Error).message}. Install it: \`npm install --save-dev drizzle-kit\``,
        );
    }
}
