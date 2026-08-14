// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ESLintUtils } from '@typescript-eslint/utils';

import {
    hasRelationDecorator,
    typeIncludesUndefined,
} from './_decoratorHelpers.mjs';

/**
 * Type-aware rule: properties decorated with an ORM relation decorator
 * (`@OrmManyToOne` / `@OrmOneToMany` / `@OrmOneToOne`) must include
 * `undefined` in their TypeScript type.
 *
 * Reason: the ORM does not eagerly load relations, so accessing the property
 * before it has been hydrated returns `undefined`. The TS type must reflect
 * that load state, otherwise call sites get false confidence and crash with
 * a TypeError when the relation hasn't been loaded.
 *
 * Convention is `?:` (i.e. `profile?: Profile`); `| undefined` is also
 * accepted. `| null` alone is NOT accepted — runtime returns `undefined`,
 * not `null`, when a relation isn't loaded.
 */

export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                'ORM relation properties must include undefined in their type',
            recommended: true,
            requiresTypeChecking: true,
        },
        messages: {
            mustBeOptional:
                "Relation property must be optional ('{{name}}?: {{typeText}}') because TypeORM relations are undefined when not loaded",
        },
        schema: [],
    },
    create(context) {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();

        return {
            PropertyDefinition(node) {
                if (!hasRelationDecorator(node)) return;
                if (node.key.type !== 'Identifier') return;

                const type = services.getTypeAtLocation(node.key);
                if (typeIncludesUndefined(type)) return;

                context.report({
                    node: node.key,
                    messageId: 'mustBeOptional',
                    data: {
                        name: node.key.name,
                        typeText: checker.typeToString(type),
                    },
                });
            },
        };
    },
};
