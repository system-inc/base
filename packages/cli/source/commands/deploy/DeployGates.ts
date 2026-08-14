// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';

import { EnvironmentType } from '@system-inc/base-foundation/configuration/Environment';
import { Run } from '../../common/Run';
import { findUnreleasedMigrations } from '../../orm/drizzle/OrmReleaseFile';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';

/**
 * Pre-deploy gates shared by the single-worker and --all-workers deploy
 * paths. Deploy is the last exit before production, so it refuses on
 * anything CI would have caught — without assuming CI ran:
 *
 *   1. clean git tree (refuses for Production; warns elsewhere) — enforceCleanGitTree
 *   2. no unreleased migrations (non-Development) — reportUnreleasedMigrations
 *   3. the workspace's own typecheck/lint/test scripts — runWorkspaceChecks
 *
 * Bypasses are deliberately narrow: `--allow-dirty` for gate 1,
 * `--skip-workspace-checks` for gate 3 (CI pipelines that just ran the
 * scripts). `--force` remains the blunt emergency hatch and implies both.
 */

/**
 * The npm scripts deploy runs as its correctness gate, in fail-fast
 * order. Formatting is deliberately excluded — prettier drift can't
 * break runtime behavior, so it stays a CI/PR concern.
 */
const WORKSPACE_CHECK_SCRIPTS = ['typecheck', 'lint', 'test'] as const;

/**
 * Locate the workspace root by walking up from `startFolder`: the first
 * directory whose package.json declares a `base` config block (the
 * workspace marker `resolveWorkersScope` also keys off) wins; if none
 * declares one, fall back to the nearest package.json found.
 */
export function findWorkspaceRoot(startFolder: string): string | undefined {
    let current = path.resolve(startFolder);
    let nearestPackageJson: string | undefined;
    for (;;) {
        const packageJsonPath = path.join(current, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            nearestPackageJson = nearestPackageJson ?? current;
            try {
                const packageJson = JSON.parse(
                    fs.readFileSync(packageJsonPath, 'utf8'),
                ) as { base?: unknown };
                if (packageJson.base !== undefined) {
                    return current;
                }
            } catch {
                // Unparseable package.json — treat as absent and keep walking.
            }
        }
        const parent = path.dirname(current);
        if (parent === current) {
            return nearestPackageJson;
        }
        current = parent;
    }
}

/**
 * Split the workspace-check scripts into those the given package.json
 * `scripts` block declares and those it doesn't.
 */
export function resolveWorkspaceCheckScripts(
    scripts: Record<string, string> | undefined,
): { present: string[]; missing: string[] } {
    const present: string[] = [];
    const missing: string[] = [];
    for (const script of WORKSPACE_CHECK_SCRIPTS) {
        (scripts && script in scripts ? present : missing).push(script);
    }
    return { present, missing };
}

/**
 * Run the workspace's declared `typecheck` / `lint` / `test` npm scripts
 * from the workspace root. The workspace defines what "checked" means —
 * deploy just insists it passes. A script the workspace doesn't declare
 * is skipped with a warning; a failing script refuses the deploy.
 *
 * Bypass: `--skip-workspace-checks` (CI that just ran them) or `--force`.
 */
export async function runWorkspaceChecks(
    args: yargs.Arguments,
    workersFolder: string,
): Promise<void> {
    if (args.skipWorkspaceChecks === true || args.force === true) {
        console.log(
            'Skipping workspace checks (typecheck, lint, test) — ' +
                `${args.force === true ? '--force' : '--skip-workspace-checks'} given.`,
        );
        return;
    }

    const workspaceRoot = findWorkspaceRoot(workersFolder);
    if (!workspaceRoot) {
        console.warn(
            '⚠️  No workspace package.json found — skipping workspace checks ' +
                '(typecheck, lint, test).',
        );
        return;
    }

    const packageJson = JSON.parse(
        fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };
    const { present, missing } = resolveWorkspaceCheckScripts(
        packageJson.scripts,
    );
    for (const script of missing) {
        console.warn(
            `⚠️  Workspace declares no '${script}' script — skipping that check.`,
        );
    }
    if (present.length === 0) {
        return;
    }

    for (const script of present) {
        console.log(`Running workspace check: npm run ${script} ...`);
        try {
            await Run.program('npm', ['run', script], { cwd: workspaceRoot });
        } catch {
            console.error(
                `❌ Workspace '${script}' failed — refusing to deploy a broken ` +
                    `workspace. Fix the failures, or bypass with ` +
                    `--skip-workspace-checks if CI already ran them.`,
            );
            process.exit(1);
        }
    }
    console.log('✅ Workspace checks passed.');
}

/**
 * Whether a dirty tree merely warns (true) or refuses the deploy (false).
 * Only Production refuses: that's where the deployed COMMIT_SHA must stay
 * reproducible for incident forensics. Iteration environments (Development
 * and any custom environment like Test/Integration/Staging) deploy with a
 * warning and a '-dirty'-marked SHA — the metadata stays honest without
 * blocking. `--allow-dirty` / `--force` extend the warning behavior to
 * Production for genuine emergencies.
 */
export function dirtyTreeDowngradesToWarning(
    args: yargs.Arguments,
    environment: string,
): boolean {
    return (
        args.allowDirty === true ||
        args.force === true ||
        environment !== EnvironmentType.Production
    );
}

/**
 * Refuse to deploy uncommitted changes to Production — the deployed
 * COMMIT_SHA must describe the code that actually shipped. Every other
 * environment (and `--allow-dirty` / `--force`) downgrades to a warning
 * with the SHA marked '-dirty'; see dirtyTreeDowngradesToWarning.
 * No git repo / no git binary: silently skipped (freshly scaffolded
 * projects; metadata is best-effort everywhere else too).
 */
export async function enforceCleanGitTree(
    args: yargs.Arguments,
    environment: string,
    workersFolder: string,
): Promise<void> {
    const workspaceRoot = findWorkspaceRoot(workersFolder) ?? workersFolder;
    let status: string;
    try {
        status = await Run.program('git', ['status', '--porcelain'], {
            captureOutput: true,
            silent: true,
            cwd: workspaceRoot,
        });
    } catch {
        return;
    }

    const dirtyFiles = status
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    if (dirtyFiles.length === 0) {
        return;
    }

    if (dirtyTreeDowngradesToWarning(args, environment)) {
        console.warn(
            `⚠️  Deploying with ${dirtyFiles.length} uncommitted change(s) — ` +
                `the recorded COMMIT_SHA will be marked '-dirty'.`,
        );
        return;
    }

    console.error(
        `❌ Refusing to deploy uncommitted changes to '${environment}'.`,
    );
    for (const line of dirtyFiles.slice(0, 10)) {
        console.error(`   ${line}`);
    }
    if (dirtyFiles.length > 10) {
        console.error(`   … and ${dirtyFiles.length - 10} more`);
    }
    console.error(
        '\n   Commit (or stash) your changes so the deployed COMMIT_SHA is ' +
            'honest, or bypass with --allow-dirty.',
    );
    process.exit(1);
}

/**
 * Report unreleased migrations for a worker targeting a non-Development
 * environment. Returns true when the deploy must be blocked; the caller
 * exits (single-worker immediately, --all-workers after covering every
 * worker so one run surfaces all violations).
 *
 * Bypass: `--force`, or the Development environment.
 */
export function reportUnreleasedMigrations(
    project: BaseWorkerProject,
    environment: string,
): boolean {
    if (environment === EnvironmentType.Development) {
        return false;
    }
    const unreleased = findUnreleasedMigrations(project);
    if (unreleased.size === 0) {
        return false;
    }
    console.error(
        `❌ [${project.worker}]: Cannot deploy unreleased migrations to '${environment}'.`,
    );
    for (const [db, tags] of unreleased) {
        console.error(`   Database '${db}':`);
        for (const t of tags) {
            console.error(`     - ${t}`);
        }
    }
    console.error(
        `\n   Run \`base orm migration:release\` to promote them, ` +
            `commit the change, then deploy.`,
    );
    return true;
}
