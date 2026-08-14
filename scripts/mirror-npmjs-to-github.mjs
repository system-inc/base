// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// Mirrors already-published npmjs packages into GitHub Packages by
// downloading the EXACT npmjs tarballs — no rebuild, byte-identical, so
// consumer package-lock integrity hashes stay valid on either registry —
// and republishing them to npm.pkg.github.com.
//
// Why this exists: npm routes an entire scope to ONE registry. CI that
// reads private @system-inc packages from GitHub Packages therefore needs
// every public @system-inc dependency (type-graphql, nexus) present there
// too, or `npm ci` 404s on them.
//
//   node scripts/mirror-npmjs-to-github.mjs [pkg@version ...]
//
// With no arguments, mirrors the default set below (what downstream consumers
// pins, plus nexus latest). Each tarball's sha1 is verified against the
// npmjs metadata before publishing. Already-mirrored versions are skipped.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    GITHUB_PACKAGES_REGISTRY,
    githubPackagesVersions,
    resolveGithubPackagesToken,
    SCOPED_REGISTRY_FLAG,
} from './github-packages.mjs';

const DEFAULT_MIRRORS = [
    '@system-inc/type-graphql@2.0.0-rc.3',
    '@system-inc/nexus@1.0.0',
    '@system-inc/nexus@2.0.1',
];

const root = dirname(dirname(fileURLToPath(import.meta.url))); // scripts/ -> repo root
const specs = process.argv.slice(2).length
    ? process.argv.slice(2)
    : DEFAULT_MIRRORS;

const token = resolveGithubPackagesToken();
if (!token) {
    console.error(
        'No GitHub Packages token found. Either set GITHUB_PACKAGES_TOKEN ' +
            '(classic PAT with write:packages), or add to ~/.npmrc:\n' +
            '  //npm.pkg.github.com/:_authToken=<token>',
    );
    process.exit(1);
}

const npmrc = join(root, '.npmrc.github');
writeFileSync(
    npmrc,
    `registry=${GITHUB_PACKAGES_REGISTRY}\n//npm.pkg.github.com/:_authToken=${token}\n`,
);
const workDir = mkdtempSync(join(tmpdir(), 'npm-mirror-'));

function parseSpec(spec) {
    const at = spec.lastIndexOf('@');
    if (at <= 0) {
        throw new Error(`Expected <name>@<version>, got: ${spec}`);
    }
    return { name: spec.slice(0, at), version: spec.slice(at + 1) };
}

try {
    let mirrored = 0;
    let skipped = 0;
    for (const spec of specs) {
        const { name, version } = parseSpec(spec);

        if (githubPackagesVersions(name, npmrc).includes(version)) {
            console.log(`⏭ ${spec} already on GitHub Packages — skipped.`);
            skipped++;
            continue;
        }

        const metadataResponse = await fetch(
            `https://registry.npmjs.org/${name.replace('/', '%2F')}`,
        );
        if (!metadataResponse.ok) {
            throw new Error(
                `npmjs metadata for ${name}: HTTP ${metadataResponse.status}`,
            );
        }
        const metadata = await metadataResponse.json();
        const dist = metadata.versions?.[version]?.dist;
        if (!dist) {
            throw new Error(`${spec} not found on npmjs.`);
        }

        console.log(`▸ downloading ${spec} from npmjs...`);
        const tarballResponse = await fetch(dist.tarball);
        if (!tarballResponse.ok) {
            throw new Error(`tarball download: HTTP ${tarballResponse.status}`);
        }
        const bytes = Buffer.from(await tarballResponse.arrayBuffer());

        const sha1 = createHash('sha1').update(bytes).digest('hex');
        if (sha1 !== dist.shasum) {
            throw new Error(
                `${spec}: downloaded tarball sha1 ${sha1} != npmjs shasum ${dist.shasum}`,
            );
        }

        const tarballPath = join(
            workDir,
            `${name.replace('@', '').replace('/', '-')}-${version}.tgz`,
        );
        writeFileSync(tarballPath, bytes);

        console.log(`▸ publishing ${spec} -> ${GITHUB_PACKAGES_REGISTRY}`);
        execFileSync(
            'npm',
            [
                'publish',
                tarballPath,
                SCOPED_REGISTRY_FLAG,
                '--userconfig',
                npmrc,
                '--registry',
                GITHUB_PACKAGES_REGISTRY,
            ],
            { cwd: root, stdio: 'inherit' },
        );
        mirrored++;
    }

    console.log(
        `\n✓ GitHub Packages mirror: ${mirrored} published, ${skipped} skipped (already present).`,
    );
} finally {
    rmSync(npmrc, { force: true });
    rmSync(workDir, { recursive: true, force: true });
}
