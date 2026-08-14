// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DeployOrderNode, orderByDependencies } from './DeployOrder';

/**
 * The order decides whether a fresh account's first workspace deploy
 * succeeds: Cloudflare rejects a service or Durable Object binding whose
 * target script does not exist yet, so binding targets must sort first.
 */
describe('orderByDependencies', () => {
    function node(
        folder: string,
        deployedName: string,
        dependencies: string[] = [],
    ): DeployOrderNode {
        return { folder, deployedName, dependencies };
    }

    it('keeps independent workers in input order', () => {
        const result = orderByDependencies([
            node('charlie', 'charlie'),
            node('alpha', 'alpha'),
            node('bravo', 'bravo'),
        ]);
        expect(result.ordered).toEqual(['charlie', 'alpha', 'bravo']);
        expect(result.cyclic).toEqual([]);
    });

    it('moves a binding target ahead of its binder', () => {
        // gateway sorts first on the filesystem but binds api — the
        // readdir-order failure this module exists to prevent.
        const result = orderByDependencies([
            node('gateway', 'gateway-prod', ['api-prod']),
            node('api', 'api-prod'),
        ]);
        expect(result.ordered).toEqual(['api', 'gateway']);
        expect(result.cyclic).toEqual([]);
    });

    it('orders a chain through transitive dependencies', () => {
        const result = orderByDependencies([
            node('front', 'front', ['middle']),
            node('middle', 'middle', ['back']),
            node('back', 'back'),
        ]);
        expect(result.ordered).toEqual(['back', 'middle', 'front']);
    });

    it('ignores dependencies on scripts outside the deploy list', () => {
        // Already-live workers (gated out of this deploy) and external
        // scripts are not this deploy's problem.
        const result = orderByDependencies([
            node('worker', 'worker', ['already-live', 'external-script']),
        ]);
        expect(result.ordered).toEqual(['worker']);
        expect(result.cyclic).toEqual([]);
    });

    it('ignores a self-referencing Durable Object binding', () => {
        const result = orderByDependencies([
            node('durable', 'durable', ['durable']),
        ]);
        expect(result.ordered).toEqual(['durable']);
        expect(result.cyclic).toEqual([]);
    });

    it('releases a cycle deterministically and reports it', () => {
        const result = orderByDependencies([
            node('a', 'a', ['b']),
            node('b', 'b', ['a']),
            node('c', 'c', ['b']),
        ]);
        // No order satisfies a↔b; the earliest member is released as-is,
        // which unblocks the rest of the cycle and its dependents.
        expect(result.ordered).toEqual(['a', 'b', 'c']);
        expect(result.cyclic).toEqual(['a']);
    });

    it('orders workers without a wrangler environment block last-resort safe', () => {
        // A missing env block means no deployed name: nothing can depend
        // on it, and its own dependencies still order it correctly.
        const result = orderByDependencies([
            {
                folder: 'unnamed',
                deployedName: undefined,
                dependencies: ['api'],
            },
            node('api', 'api'),
        ]);
        expect(result.ordered).toEqual(['api', 'unnamed']);
    });
});
