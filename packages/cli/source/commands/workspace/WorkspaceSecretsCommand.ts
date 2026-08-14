// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';
import sodium from 'libsodium-wrappers';
import * as yargs from 'yargs';

export class WorkspaceSecretsCommand implements yargs.CommandModule {
    command = 'secrets <command>';
    describe = 'Manage secrets for the workspace';

    builder(args: yargs.Argv) {
        return args
            .hide('worker')
            .hide('environment')
            .command(new WorkspaceSecretsExportCommand())
            .command(new WorkspaceSecretsImportCommand())
            .demandCommand();
    }

    async handler(_args: yargs.Arguments) {
        // this should never be called because all of the processing is done via subcommands
        throw new Error('Method not implemented.');
    }
}

class WorkspaceSecretsExportCommand implements yargs.CommandModule {
    command = 'export';
    describe = 'Exports all secrets for the workspace to a github respository.';

    builder(args: yargs.Argv) {
        return args.option('repo', {
            alias: 'r',
            describe: 'The repository to export the secrets to.',
            type: 'string',
        });
    }

    async handler(args: yargs.Arguments) {
        // get the repo and the owner from the repository passed in
        let [owner, repo]: [
            owner: string | undefined,
            repo: string | undefined,
        ] = [undefined, undefined];
        if (typeof args.repo === 'string') {
            [owner, repo] = args.repo.replace('.git', '').split('/');
        }

        // Middleware in base-cli.ts guarantees this is set to the resolved
        // absolute workersFolder before any command handler runs.
        const workersFolder = args.workersFolder as string;
        const envTomlBase64 = await gatherBase64Secrets(
            'env.toml',
            workersFolder,
        );
        const testEnvTomlBase64 = await gatherBase64Secrets(
            'test.env.toml',
            workersFolder,
        );

        // determine where to export the secrets
        if (owner && repo) {
            const githubApiToken = process.env.GITHUB_API_TOKEN;
            if (!githubApiToken) {
                console.error(
                    'GITHUB_API_TOKEN environment variable is required.',
                );
                process.exit(1);
            }
            console.log(`Exporting secrets to ${owner}/${repo}`);
            await exportSecretToRepo('env.toml', envTomlBase64, {
                owner,
                repo,
                token: githubApiToken,
            });
            await exportSecretToRepo('test.env.toml', testEnvTomlBase64, {
                owner,
                repo,
                token: githubApiToken,
            });
        } else {
            exportSecretsToFile('env.toml', envTomlBase64, workersFolder);
            exportSecretsToFile(
                'test.env.toml',
                testEnvTomlBase64,
                workersFolder,
            );
        }
    }
}

class WorkspaceSecretsImportCommand implements yargs.CommandModule {
    command = 'import';
    describe = 'Import all secrets for the workspace.';

    builder(args: yargs.Argv) {
        return args
            .option('env', {
                describe:
                    'The the name of the env variable that contains the secrets.',
                type: 'string',
            })
            .option('file', {
                describe: 'The file to import the secrets from.',
                type: 'string',
            })
            .conflicts('env', 'file')
            .check((argv) => {
                if (!argv.env && !argv.file) {
                    throw new Error('You must provide either --env or --file.');
                }
                return true; // Validation passed
            });
    }

    async handler(args: yargs.Arguments) {
        // Middleware in base-cli.ts guarantees this is set to the
        // resolved absolute workersFolder before any handler runs.
        const workersFolder = args.workersFolder as string;

        // get the environment variable name from the arguments
        if (typeof args.env === 'string') {
            const envName = args.env;
            // check if the environment variable exists
            const envContent = process.env[envName];
            if (!envContent) {
                console.error(
                    `The environment variable ${envName} does not exist.`,
                );
                process.exit(1);
            }
            importRepositorySecrets(envContent, workersFolder);
        } else if (typeof args.file === 'string') {
            // load the secrets from the file
            const file = args.file;
            // check if the file exists
            if (!fs.existsSync(file)) {
                console.error(`The file ${file} does not exist.`);
                process.exit(1);
            }
            const fileContent = fs.readFileSync(file, 'utf-8');
            importRepositorySecrets(fileContent, workersFolder);
        }
    }
}

async function gatherBase64Secrets(
    type: 'env.toml' | 'test.env.toml',
    workersFolder: string,
): Promise<string> {
    // get all env.toml files in the workspace
    const envTomlFiles = await findTomlFiles(workersFolder, type);

    // create a base64 encoded string of the toml files
    return Buffer.from(JSON.stringify(envTomlFiles)).toString('base64');
}

function exportSecretsToFile(
    type: 'env.toml' | 'test.env.toml',
    tomlBase64: string,
    workersFolder: string,
) {
    const exportFileName = `${workersFolder}/workspace.${type}.base64`;
    console.log('Exporting secrets to', exportFileName);
    // write the json encoded toml files as one file to disk
    fs.writeFileSync(exportFileName, tomlBase64);
}

function importRepositorySecrets(base64Secrets: string, workersFolder: string) {
    // base64 decode the secrets
    const stringSecrets = Buffer.from(base64Secrets, 'base64').toString();

    // parse the string secrets into an object
    const secrets = JSON.parse(stringSecrets);
    if (!Array.isArray(secrets)) {
        console.error('The secrets are not an array.');
        process.exit(1);
    }

    // add the secrets to the workspace
    for (const secret of secrets) {
        if (!isTomlEntry(secret)) {
            console.error('The secret is not an object.');
            process.exit(1);
        }
        // Stored paths are workersFolder-relative (the export captures
        // them that way so the same payload works on any machine).
        // Defensive: if a legacy payload contains an absolute path,
        // refuse rather than write outside the workspace.
        if (path.isAbsolute(secret.path)) {
            console.error(
                `Refusing to import secret with absolute path '${secret.path}'. ` +
                    `Re-export the secrets with the current CLI ` +
                    `(\`base workspace secrets export\`) so paths are stored ` +
                    `relative to workersFolder.`,
            );
            process.exit(1);
        }
        const destination = path.join(workersFolder, secret.path);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        console.log('Writing secret to', destination);
        fs.writeFileSync(destination, secret.content);
    }
}

async function findTomlFiles(
    workerFolder: string,
    tomlFileName: 'env.toml' | 'test.env.toml',
): Promise<TomlEntry[]> {
    const results: TomlEntry[] = [];

    /**
     * Capture each found toml file as a workersFolder-RELATIVE path so
     * the resulting payload travels between machines. Absolute paths
     * baked from the exporter's CWD don't exist on a CI runner.
     */
    function record(entryPath: string, content: string): void {
        results.push({
            path: path.relative(workerFolder, entryPath),
            content,
        });
    }

    async function searchOneLevel(currentDir: string): Promise<void> {
        const entries = await fs.promises.readdir(currentDir, {
            withFileTypes: true,
        });

        for (const entry of entries) {
            const entryPath = path.join(currentDir, entry.name);

            if (entry.isFile() && entry.name === tomlFileName) {
                const content = await fs.promises.readFile(entryPath, 'utf-8');
                record(entryPath, content);
            } else if (entry.isDirectory()) {
                // Check files inside this subdirectory (one level deep)
                const subEntries = await fs.promises.readdir(entryPath, {
                    withFileTypes: true,
                });

                for (const subEntry of subEntries) {
                    const subEntryPath = path.join(entryPath, subEntry.name);
                    if (subEntry.isFile() && subEntry.name === tomlFileName) {
                        const content = await fs.promises.readFile(
                            subEntryPath,
                            'utf-8',
                        );
                        record(subEntryPath, content);
                    } else if (
                        subEntry.isDirectory() &&
                        subEntry.name === 'container'
                    ) {
                        const containerTomlPath = path.join(
                            subEntryPath,
                            tomlFileName,
                        );
                        if (fs.existsSync(containerTomlPath)) {
                            const content = await fs.promises.readFile(
                                containerTomlPath,
                                'utf-8',
                            );
                            record(containerTomlPath, content);
                        }
                    }
                }
            }
        }
    }

    await searchOneLevel(workerFolder);

    return results;
}

interface GithubRepoParams {
    owner: string;
    repo: string;
    token: string; // Personal access token with `repo` or `repo:actions` scope
}

async function exportSecretToRepo(
    type: 'env.toml' | 'test.env.toml',
    base64: string,
    repoParams: GithubRepoParams,
): Promise<void> {
    try {
        // Step 1: Get the repository's public key
        const keyResponse = await fetch(
            `https://api.github.com/repos/${repoParams.owner}/${repoParams.repo}/actions/secrets/public-key`,
            {
                method: 'GET',
                headers: {
                    'X-GitHub-Api-Version': '2022-11-28',
                    Authorization: `Bearer ${repoParams.token}`, // Add your GitHub token here
                },
            },
        );

        if (!keyResponse.ok) {
            throw new Error(
                `GitHub API request failed with status ${keyResponse.status}`,
            );
        }

        const publicKey: GithubRepoPublicKey = await keyResponse.json();

        // Step 2: Encrypt the secret value using the public key
        const encryptedValue = await encryptSecret(base64, publicKey.key);
        const secretName = secretNameFromType(type);

        // Step 3: Create or update the repository secret
        const addResponse = await fetch(
            `https://api.github.com/repos/${repoParams.owner}/${repoParams.repo}/actions/secrets/${secretName}`,
            {
                method: 'PUT',
                headers: {
                    'X-GitHub-Api-Version': '2022-11-28',
                    Authorization: `Bearer ${repoParams.token}`, // Add your GitHub token here
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    encrypted_value: encryptedValue,
                    key_id: publicKey.key_id,
                }),
            },
        );

        if (!addResponse.ok) {
            throw new Error(
                `GitHub API request failed with status ${addResponse.status}`,
            );
        }

        console.log(
            `Secret "${secretName}" has been added/updated successfully.`,
        );
    } catch (error) {
        console.error(`Failed to add secret type: "${type}":`, error);
        throw error;
    }
}

async function encryptSecret(
    secretValue: string,
    publicKey: string,
): Promise<string> {
    // Initialize libsodium
    await sodium.ready;

    // Decode the public key from Base64 to Uint8Array
    const publicKeyBytes = sodium.from_base64(
        publicKey,
        sodium.base64_variants.ORIGINAL,
    );

    // Convert the secret value into a Uint8Array
    const secretBytes = sodium.from_string(secretValue);

    // Encrypt the secret using the public key
    const encryptedBytes = sodium.crypto_box_seal(secretBytes, publicKeyBytes);

    // Encode the encrypted secret back to Base64
    return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
}

interface GithubRepoPublicKey {
    key: string;
    key_id: string;
}

interface TomlEntry {
    path: string;
    content: string;
}

function isTomlEntry(value: unknown): value is TomlEntry {
    return (
        typeof value === 'object' &&
        value !== null &&
        'path' in value &&
        typeof value.path === 'string' &&
        'content' in value &&
        typeof value.content === 'string'
    );
}

function secretNameFromType(type: 'env.toml' | 'test.env.toml'): string {
    return type === 'env.toml' ? 'ENV_TOML' : 'TEST_ENV_TOML';
}
