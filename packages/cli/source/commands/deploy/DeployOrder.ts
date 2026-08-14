// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * One worker's place in the workspace deploy graph: the folder the deploy
 * loop iterates, the script name it deploys under in the target
 * environment, and the deployed script names its bindings reference.
 */
export interface DeployOrderNode {
    folder: string;
    deployedName?: string;
    dependencies: ReadonlyArray<string>;
}

export interface DeployOrderResult {
    /**
     * Every input folder, dependencies before their binders; independent
     * workers keep their input order.
     */
    ordered: string[];
    /**
     * Folders released with unsatisfied in-list dependencies — members of
     * binding cycles, which no order can satisfy on a fresh account.
     */
    cyclic: string[];
}

/**
 * Orders workers so that every worker deploys after the workers it binds
 * to. Cloudflare rejects a service or Durable Object binding whose target
 * script does not exist, so on a fresh account the binding targets must
 * deploy first. Dependencies naming scripts outside the input set are
 * ignored — they are either already live or not this deploy's problem.
 * When only cycle members remain, the earliest one is released as-is (and
 * reported), which keeps the order deterministic and lets the rest of the
 * cycle follow.
 */
export function orderByDependencies(
    nodes: ReadonlyArray<DeployOrderNode>,
): DeployOrderResult {
    const folderByDeployedName = new Map<string, string>();
    for (const node of nodes) {
        if (node.deployedName !== undefined) {
            folderByDeployedName.set(node.deployedName, node.folder);
        }
    }

    // Resolve each node's dependencies to in-list folders, dropping
    // self-references (a Durable Object binding may name its own script).
    const dependencyFolders = new Map<string, Set<string>>();
    for (const node of nodes) {
        const resolved = new Set<string>();
        for (const dependency of node.dependencies) {
            const folder = folderByDeployedName.get(dependency);
            if (folder !== undefined && folder !== node.folder) {
                resolved.add(folder);
            }
        }
        dependencyFolders.set(node.folder, resolved);
    }

    const ordered: string[] = [];
    const cyclic: string[] = [];
    const remaining = nodes.map((node) => node.folder);
    const pending = new Set(remaining);

    while (remaining.length > 0) {
        const readyIndex = remaining.findIndex((folder) => {
            for (const dependency of dependencyFolders.get(folder)!) {
                if (pending.has(dependency)) {
                    return false;
                }
            }
            return true;
        });

        // Only cycle members remain: release the earliest to break the
        // deadlock deterministically.
        const index = readyIndex === -1 ? 0 : readyIndex;
        const folder = remaining[index];
        if (readyIndex === -1) {
            cyclic.push(folder);
        }
        remaining.splice(index, 1);
        pending.delete(folder);
        ordered.push(folder);
    }

    return { ordered, cyclic };
}
