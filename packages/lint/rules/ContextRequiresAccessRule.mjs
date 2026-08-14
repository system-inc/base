// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * If a method (or constructor) has a parameter decorated with
 * `@InjectRequestContext(X)` where X is a "protected" context key, the
 * method or its enclosing class must carry one of the decorators that
 * establishes the corresponding access. Otherwise the injected value comes
 * from an unverified context and any business logic acting on it is unsafe.
 *
 * The rule logic is generic — both `@InjectRequestContext` and
 * `@GqlFieldResolver` (the downstream-resolver exemption) are core base
 * concepts available to every consumer. The *configuration* (which context
 * keys are protected and which decorators establish access) is project-
 * specific and supplied via rule options.
 *
 * Methods decorated with `@GqlFieldResolver` are exempt — by the time a
 * field resolver runs, whoever produced the parent object already
 * established access.
 *
 * Parameters whose type explicitly admits `undefined` / `null` (`?:`,
 * `| undefined`, `| null`, `unknown`, `any`) are treated as "soft use" and
 * skip the requirement, since the developer has committed to handle the
 * missing case inline.
 *
 * Example configuration:
 *
 *   'base/context-requires-access': ['error', {
 *       requirements: [
 *           {
 *               contextKey: 'AccountRequestContextKey',
 *               requiresAny: ['RequireSessionAccess', 'WithSessionAccess'],
 *           },
 *       ],
 *   }]
 */

function getDecoratorName(decoratorNode) {
    const expr = decoratorNode.expression;
    if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') {
        return expr.callee.name;
    }
    if (expr.type === 'Identifier') {
        return expr.name;
    }
    return null;
}

function getInjectedContextKeyName(decoratorNode) {
    const expr = decoratorNode.expression;
    if (expr.type !== 'CallExpression') return null;
    if (expr.callee.type !== 'Identifier') return null;
    if (expr.callee.name !== 'InjectRequestContext') return null;
    const arg = expr.arguments[0];
    if (!arg) return null;
    // Bare identifier: `@InjectRequestContext(AccountKey)`.
    if (arg.type === 'Identifier') return arg.name;
    // Namespaced / member access: `@InjectRequestContext(Keys.AccountKey)` —
    // the configured key name is the property. Without this a namespaced key
    // silently bypassed the requirement.
    if (
        arg.type === 'MemberExpression' &&
        !arg.computed &&
        arg.property.type === 'Identifier'
    ) {
        return arg.property.name;
    }
    return null;
}

function getParameterDecorators(param) {
    if (!param) return [];
    // Decorators live on the parameter node itself for every parameter shape —
    // a plain Identifier, a defaulted parameter (AssignmentPattern), and a
    // constructor TSParameterProperty. They are NOT on `param.left` for a
    // defaulted parameter, so reading that silently skipped this rule for any
    // decorated parameter that carried a default value.
    return param.decorators || [];
}

function getParameterIdentifier(param) {
    if (!param) return null;
    if (param.type === 'Identifier') return param;
    if (param.type === 'TSParameterProperty') return param.parameter;
    if (
        param.type === 'AssignmentPattern' &&
        param.left.type === 'Identifier'
    ) {
        return param.left;
    }
    return null;
}

function typeNodeAllowsUndefinedOrNull(node) {
    if (!node) return false;
    if (
        node.type === 'TSUndefinedKeyword' ||
        node.type === 'TSNullKeyword' ||
        node.type === 'TSAnyKeyword' ||
        node.type === 'TSUnknownKeyword' ||
        node.type === 'TSVoidKeyword'
    ) {
        return true;
    }
    if (node.type === 'TSUnionType') {
        return node.types.some(typeNodeAllowsUndefinedOrNull);
    }
    return false;
}

function paramTypeIsSoftUse(param) {
    const id = getParameterIdentifier(param);
    if (!id) return false;
    if (id.optional === true) return true;
    const annotation = id.typeAnnotation;
    if (!annotation || !annotation.typeAnnotation) return false;
    return typeNodeAllowsUndefinedOrNull(annotation.typeAnnotation);
}

function collectMethodAndClassDecoratorNames(methodNode) {
    const names = new Set();
    for (const dec of methodNode.decorators || []) {
        const n = getDecoratorName(dec);
        if (n) names.add(n);
    }
    const classBody = methodNode.parent;
    const classNode = classBody && classBody.parent;
    if (
        classNode &&
        (classNode.type === 'ClassDeclaration' ||
            classNode.type === 'ClassExpression')
    ) {
        for (const dec of classNode.decorators || []) {
            const n = getDecoratorName(dec);
            if (n) names.add(n);
        }
    }
    return names;
}

const DOWNSTREAM_RESOLVER_DECORATORS = new Set(['GqlFieldResolver']);

function methodIsDownstreamResolver(methodNode) {
    for (const dec of methodNode.decorators || []) {
        const name = getDecoratorName(dec);
        if (name && DOWNSTREAM_RESOLVER_DECORATORS.has(name)) {
            return true;
        }
    }
    return false;
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                'A method that injects a protected RequestContext key must also carry the matching access decorator',
        },
        messages: {
            missingProtector:
                "Method '{{methodName}}' injects '{{contextKey}}' but is not protected by {{requirements}} (on the method or its enclosing class)",
        },
        schema: [
            {
                type: 'object',
                properties: {
                    requirements: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                contextKey: { type: 'string' },
                                requiresAny: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    minItems: 1,
                                },
                            },
                            required: ['contextKey', 'requiresAny'],
                            additionalProperties: false,
                        },
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    create(context) {
        const options = context.options[0] || {};
        const requirements = options.requirements || [];
        const requirementMap = new Map();
        for (const r of requirements) {
            requirementMap.set(r.contextKey, r.requiresAny);
        }
        if (requirementMap.size === 0) return {};

        // Resolve an imported local name back to the name it was exported
        // under, so an aliased import — `import { AccountKey as AK }` then
        // `@InjectRequestContext(AK)` — is matched against the configured key
        // rather than silently bypassing the requirement. Import declarations
        // are visited before the method bodies that use them.
        const importAliases = new Map();

        return {
            ImportDeclaration(node) {
                for (const spec of node.specifiers) {
                    if (
                        spec.type === 'ImportSpecifier' &&
                        spec.imported.type === 'Identifier'
                    ) {
                        importAliases.set(spec.local.name, spec.imported.name);
                    }
                }
            },
            MethodDefinition(node) {
                if (!node.value || !Array.isArray(node.value.params)) return;
                if (methodIsDownstreamResolver(node)) return;

                const usedProtectedKeys = new Set();
                for (const param of node.value.params) {
                    for (const dec of getParameterDecorators(param)) {
                        const surfaceName = getInjectedContextKeyName(dec);
                        if (!surfaceName) continue;
                        const key =
                            importAliases.get(surfaceName) ?? surfaceName;
                        if (!requirementMap.has(key)) continue;
                        if (paramTypeIsSoftUse(param)) continue;
                        usedProtectedKeys.add(key);
                    }
                }
                if (usedProtectedKeys.size === 0) return;

                const presentDecorators =
                    collectMethodAndClassDecoratorNames(node);

                for (const key of usedProtectedKeys) {
                    const requiresAny = requirementMap.get(key);
                    const hasAny = requiresAny.some((d) =>
                        presentDecorators.has(d),
                    );
                    if (!hasAny) {
                        const methodName =
                            node.key.type === 'Identifier'
                                ? node.key.name
                                : '<computed>';
                        context.report({
                            node: node.key,
                            messageId: 'missingProtector',
                            data: {
                                contextKey: key,
                                methodName,
                                requirements: requiresAny
                                    .map((d) => `@${d}()`)
                                    .join(' or '),
                            },
                        });
                    }
                }
            },
        };
    },
};
