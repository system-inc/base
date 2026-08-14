// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// reference-gen · TRANSFORM stage.
//
// Maps the raw TypeDoc reflection (`artifacts/typedoc.foundation.json`) into our own
// `reference-model.json` (schema: see this folder's README) plus a
// `coverage-report.md` listing TSDoc gaps. Pure function of the extract output —
// no filesystem access besides what generate.mjs hands in.

// TypeDoc ReflectionKind values (stable numeric enum).
const Kind = {
    Project: 1,
    Module: 2,
    Namespace: 4,
    Enum: 8,
    EnumMember: 16,
    Variable: 32,
    Function: 64,
    Class: 128,
    Interface: 256,
    Constructor: 512,
    Property: 1024,
    Method: 2048,
    CallSignature: 4096,
    Parameter: 32768,
    TypeLiteral: 65536,
    TypeParameter: 131072,
    Accessor: 262144,
    GetSignature: 524288,
    TypeAlias: 2097152,
    Reference: 4194304,
};

// Top-level declaration kinds that become ReferenceSymbols. Namespaces appear
// when a module declaration-merges values onto a type (e.g. the WebSocketEvent
// guards) or groups injection keys; their members document like static members.
const documentableKinds = new Set([
    Kind.Function,
    Kind.Class,
    Kind.Interface,
    Kind.TypeAlias,
    Kind.Variable,
    Kind.Enum,
    Kind.Namespace,
]);

const kindNames = {
    [Kind.Function]: 'function',
    [Kind.Class]: 'class',
    [Kind.Interface]: 'interface',
    [Kind.TypeAlias]: 'type',
    [Kind.Variable]: 'constant',
    [Kind.Enum]: 'enum',
    [Kind.Namespace]: 'namespace',
};

// --- Categorization (path under foundation/source/ → docs category + group) --------
//
// The nav is two levels: subsystem, then group. A symbol's subsystem comes from
// its top-level source folder, its group from what the symbol is — decorators
// first, then the remaining kinds. So `orm/decorators/OrmTable` lands under
// ORM › Decorators and `orm/database/repository/OrmRepository` under ORM › Classes,
// and everything about a subsystem stays in one place.

const topLevelCategories = {
    base: 'Core',
    module: 'Core',
    worker: 'Core',
    configuration: 'Core',
    startup: 'Core',
    'dependency-injection': 'Dependency Injection',
    orm: 'ORM',
    graphql: 'GraphQL',
    rpc: 'RPC',
    queue: 'Queue',
    scheduled: 'Scheduled',
    event: 'Events',
    'access-control': 'Access Control',
    validation: 'Validation',
    serialization: 'Serialization',
    error: 'Errors',
    cryptography: 'Cryptography',
    logging: 'Logging',
    cloudflare: 'Storage',
    'key-value-storage': 'Storage',
    'object-store': 'Storage',
    request: 'HTTP',
    router: 'HTTP',
    http: 'HTTP',
    middleware: 'HTTP',
    'web-socket': 'WebSocket',
    test: 'Testing',
};

/**
 * The subsystem a symbol belongs to — the first level of the nav.
 *
 * @param {string} modulePath e.g. 'router/decorators/HttpRoute'
 */
function categorize(modulePath) {
    const top = modulePath.split('/')[0];
    const storageHint = /kv|objectstore|object-store/i.test(modulePath);
    return topLevelCategories[top] ?? (storageHint ? 'Storage' : 'Other');
}

/**
 * Plural group labels, in the order they should appear beneath a subsystem.
 * Decorators lead because they are the surface most readers arrive looking for.
 */
const groupOrder = [
    'Decorators',
    'Classes',
    'Interfaces',
    'Functions',
    'Types',
    'Enums',
    'Constants',
    'Namespaces',
];

const kindGroups = {
    decorator: 'Decorators',
    class: 'Classes',
    interface: 'Interfaces',
    function: 'Functions',
    type: 'Types',
    enum: 'Enums',
    constant: 'Constants',
    namespace: 'Namespaces',
};

/**
 * The group a symbol sits in beneath its subsystem — the second level of the
 * nav. Driven by the symbol's kind, so a decorator-adjacent constant (e.g.
 * `HttpServiceDecoratorName`) files under Constants rather than Decorators.
 *
 * @param {string} kind
 */
function groupFor(kind) {
    return kindGroups[kind] ?? 'Other';
}

// --- Comment rendering ---------------------------------------------------------------

/**
 * Render TypeDoc comment parts to markdown. `resolveLink` maps a numeric or object
 * inline-tag target to a symbol id string (or null).
 * @param {any[] | undefined} parts
 * @param {(target: any) => string | null} resolveLink
 */
function renderComment(parts, resolveLink) {
    if (!parts?.length) return '';
    let out = '';
    for (const part of parts) {
        if (part.kind === 'inline-tag') {
            const label = (part.text ?? '').trim();
            const id = resolveLink(part.target);
            out += id ? `[${label}](#${id})` : label;
        } else {
            out += part.text ?? '';
        }
    }
    return out.trim();
}

/**
 * Pull the structured block tags out of a comment.
 * @param {any} comment
 * @param {(target: any) => string | null} resolveLink
 */
function extractBlockTags(comment, resolveLink) {
    /** @type {{ examples: string[], see: string[], remarks?: string, deprecated?: string, since?: string }} */
    const tags = { examples: [], see: [] };
    for (const block of comment?.blockTags ?? []) {
        const text = renderComment(block.content, resolveLink);
        switch (block.tag) {
            case '@example':
                tags.examples.push(text);
                break;
            case '@see':
                tags.see.push(text);
                break;
            case '@remarks':
                tags.remarks = text;
                break;
            case '@deprecated':
                tags.deprecated = text || 'Deprecated.';
                break;
            case '@since':
                tags.since = text;
                break;
        }
    }
    return tags;
}

// --- Type rendering ------------------------------------------------------------------

/**
 * Render a TypeDoc type tree to a TypeScript-ish string, recording referenced
 * reflection ids into `refs` as a side effect.
 * @param {any} type
 * @param {Set<number>} refs
 * @returns {string}
 */
function renderType(type, refs) {
    if (!type) return 'unknown';
    const r = (t) => renderType(t, refs);
    switch (type.type) {
        case 'intrinsic':
            return type.name;
        case 'literal':
            return typeof type.value === 'string'
                ? JSON.stringify(type.value)
                : String(type.value);
        case 'reference': {
            if (typeof type.target === 'number') refs.add(type.target);
            const args = type.typeArguments?.length
                ? `<${type.typeArguments.map(r).join(', ')}>`
                : '';
            return `${type.name}${args}`;
        }
        case 'union':
            return type.types.map(r).join(' | ');
        case 'intersection':
            return type.types.map(r).join(' & ');
        case 'array': {
            const element = r(type.elementType);
            return /[|&=>\s]/.test(element) ? `(${element})[]` : `${element}[]`;
        }
        case 'tuple':
            return `[${(type.elements ?? []).map(r).join(', ')}]`;
        case 'namedTupleMember':
            return `${type.name}${type.isOptional ? '?' : ''}: ${r(type.element)}`;
        case 'optional':
            return `${r(type.elementType)}?`;
        case 'rest':
            return `...${r(type.elementType)}`;
        case 'typeOperator':
            return `${type.operator} ${r(type.target)}`;
        case 'indexedAccess':
            return `${r(type.objectType)}[${r(type.indexType)}]`;
        case 'conditional':
            return `${r(type.checkType)} extends ${r(type.extendsType)} ? ${r(type.trueType)} : ${r(type.falseType)}`;
        case 'predicate':
            return type.targetType
                ? `${type.asserts ? 'asserts ' : ''}${type.name} is ${r(type.targetType)}`
                : `asserts ${type.name}`;
        case 'query':
            return `typeof ${r(type.queryType)}`;
        case 'templateLiteral': {
            const tail = (type.tail ?? [])
                .map(([t, text]) => `\${${r(t)}}${text}`)
                .join('');
            return `\`${type.head ?? ''}${tail}\``;
        }
        case 'mapped':
            return `{ [${type.parameter} in ${r(type.parameterType)}]${type.optionalModifier === '+' ? '?' : ''}: ${r(type.templateType)} }`;
        case 'reflection':
            return renderTypeLiteral(type.declaration, refs);
        case 'inferred':
            return `infer ${type.name}`;
        case 'unknown':
            return type.name ?? 'unknown';
        default:
            return type.name ?? 'unknown';
    }
}

/**
 * Render an inline TypeLiteral declaration (object shape or function type).
 * @param {any} declaration
 * @param {Set<number>} refs
 */
function renderTypeLiteral(declaration, refs) {
    if (!declaration) return 'object';
    // Pure function type: () => T
    if (declaration.signatures?.length && !declaration.children?.length) {
        const sig = declaration.signatures[0];
        const params = (sig.parameters ?? [])
            .map(
                (p) =>
                    `${p.flags?.isRest ? '...' : ''}${p.name}${p.flags?.isOptional ? '?' : ''}: ${renderType(p.type, refs)}`,
            )
            .join(', ');
        return `(${params}) => ${renderType(sig.type, refs)}`;
    }
    if (declaration.children?.length) {
        const props = declaration.children
            .map(
                (c) =>
                    `${c.name}${c.flags?.isOptional ? '?' : ''}: ${renderType(c.type, refs)}`,
            )
            .join('; ');
        return `{ ${props} }`;
    }
    if (declaration.indexSignatures?.length) {
        const index = declaration.indexSignatures[0];
        const key = index.parameters?.[0];
        return `{ [${key?.name ?? 'key'}: ${renderType(key?.type, refs)}]: ${renderType(index.type, refs)} }`;
    }
    return '{}';
}

// --- Signatures / members ------------------------------------------------------------

/**
 * @param {any} declaration a Function/Method/Constructor/Accessor node
 * @param {Set<number>} refs
 * @param {(target: any) => string | null} resolveLink
 */
function buildSignatures(declaration, refs, resolveLink) {
    const signatureNodes =
        declaration.signatures ??
        (declaration.getSignature ? [declaration.getSignature] : []);
    return signatureNodes.map((sig) => ({
        name: sig.name,
        summary: renderComment(sig.comment?.summary, resolveLink) || undefined,
        typeParameters: sig.typeParameters?.length
            ? sig.typeParameters.map((tp) => ({
                  name: tp.name,
                  constraint: tp.type ? renderType(tp.type, refs) : undefined,
                  default: tp.default
                      ? renderType(tp.default, refs)
                      : undefined,
              }))
            : undefined,
        parameters: (sig.parameters ?? []).map((parameter) => ({
            name: parameter.name,
            type: renderType(parameter.type, refs),
            optional: parameter.flags?.isOptional || undefined,
            rest: parameter.flags?.isRest || undefined,
            default: parameter.defaultValue,
            doc:
                renderComment(parameter.comment?.summary, resolveLink) ||
                undefined,
        })),
        returns: {
            type: renderType(sig.type, refs),
            doc:
                renderComment(
                    sig.comment?.blockTags?.find((t) => t.tag === '@returns')
                        ?.content,
                    resolveLink,
                ) || undefined,
        },
    }));
}

// Variable/Function appear as children of namespaces and document as
// property/method members.
const memberKinds = new Set([
    Kind.Constructor,
    Kind.Property,
    Kind.Method,
    Kind.Accessor,
    Kind.EnumMember,
    Kind.Variable,
    Kind.Function,
]);

/**
 * @param {any} declaration a Class/Interface/Enum node
 * @param {Set<number>} refs
 * @param {(target: any) => string | null} resolveLink
 */
function buildMembers(declaration, refs, resolveLink) {
    const members = [];
    for (const child of declaration.children ?? []) {
        if (!memberKinds.has(child.kind)) continue;
        if (child.flags?.isPrivate) continue;
        // Protected members are implementation plumbing, not consumable API —
        // except protected *abstract* ones, which are the subclassing contract
        // (e.g. CfDurableObject.settings, which users must override).
        if (child.flags?.isProtected && !child.flags?.isAbstract) continue;
        const flags = child.flags ?? {};
        const comment =
            child.comment ??
            child.signatures?.[0]?.comment ??
            child.getSignature?.comment;
        const tags = extractBlockTags(comment, resolveLink);
        members.push({
            name: child.name,
            kind:
                child.kind === Kind.Constructor
                    ? 'constructor'
                    : child.kind === Kind.Method || child.kind === Kind.Function
                      ? 'method'
                      : child.kind === Kind.Accessor
                        ? 'accessor'
                        : child.kind === Kind.EnumMember
                          ? 'enumMember'
                          : 'property',
            static: flags.isStatic || undefined,
            readonly: flags.isReadonly || undefined,
            optional: flags.isOptional || undefined,
            protected: flags.isProtected || undefined,
            summary: renderComment(comment?.summary, resolveLink) || undefined,
            deprecated: tags.deprecated,
            type:
                child.kind === Kind.Property || child.kind === Kind.Variable
                    ? renderType(child.type, refs)
                    : child.kind === Kind.Accessor
                      ? renderType(child.getSignature?.type, refs)
                      : undefined,
            value:
                child.kind === Kind.EnumMember ? child.type?.value : undefined,
            defaultValue: child.defaultValue,
            signatures:
                child.kind === Kind.Method ||
                child.kind === Kind.Constructor ||
                child.kind === Kind.Function
                    ? buildSignatures(child, refs, resolveLink)
                    : undefined,
        });
    }
    return members.length ? members : undefined;
}

// --- Decorator semantics -------------------------------------------------------------

const decoratorTargetsByReturnType = [
    ['ClassDecorator', 'class'],
    ['MethodDecorator', 'method'],
    ['PropertyDecorator', 'property'],
    ['ParameterDecorator', 'parameter'],
];

/**
 * Whether a const's type is decorator-shaped: a `*Decorator` reference, a
 * function type, or an intersection/union containing one (e.g. the VerifyIs*
 * rules typed `(options) => PropertyDecorator & { check: ... }`).
 * @param {any} type
 * @returns {boolean}
 */
function isDecoratorType(type) {
    if (!type) return false;
    if (type.type === 'reference') return /Decorator/.test(type.name);
    if (type.type === 'reflection')
        return Boolean(type.declaration?.signatures?.length);
    if (type.type === 'intersection' || type.type === 'union')
        return type.types.some(isDecoratorType);
    return false;
}

/** Infer what a decorator factory decorates from its return type string. */
function inferDecoratorTarget(returnTypeString) {
    const targets = decoratorTargetsByReturnType
        .filter(([marker]) => returnTypeString.includes(marker))
        .map(([, target]) => target);
    if (targets.length) return targets.join(' | ');
    if (/TypedPropertyDescriptor|descriptor/i.test(returnTypeString))
        return 'method';
    return undefined;
}

// --- Main transform ------------------------------------------------------------------

/**
 * @param {any} project the serialized TypeDoc project (kind 1)
 * @param {{ packageName: string }} options
 * @returns {{ model: any, report: string }}
 */
export function transform(project, { packageName }) {
    // Pass 1: index every reflection by id, and every documentable top-level
    // declaration by its stable symbol id.
    /** @type {Map<number, { node: any, symbolId: string }>} */
    const byId = new Map();
    /** @type {{ modulePath: string, node: any, symbolId: string, aliasName?: string, aliasFor?: string }[]} */
    const declarations = [];
    /** @type {{ modulePath: string, node: any, symbolId: string }[]} */
    const reExports = [];

    for (const module_ of project.children ?? []) {
        if (module_.kind !== Kind.Module) continue;
        for (const declaration of module_.children ?? []) {
            if (declaration.kind === Kind.Reference) {
                reExports.push({
                    modulePath: module_.name,
                    node: declaration,
                    symbolId: `${module_.name}#${declaration.name}`,
                });
                continue;
            }
            if (!documentableKinds.has(declaration.kind)) continue;
            if (declaration.flags?.isPrivate) continue;
            const symbolId = `${module_.name}#${declaration.name}`;
            declarations.push({
                modulePath: module_.name,
                node: declaration,
                symbolId,
            });
            const index = (node) => {
                if (!node || typeof node !== 'object') return;
                if (typeof node.id === 'number')
                    byId.set(node.id, { node, symbolId });
                for (const child of node.children ?? []) index(child);
            };
            index(declaration);
        }
    }

    // Re-exports (e.g. `VerifyBy` → `registerRule`) are public API under their
    // own subpath: document each as an alias symbol built from its target.
    for (const { modulePath, node, symbolId } of reExports) {
        const target = byId.get(node.target);
        if (!target) continue; // target not documented — nothing to alias
        declarations.push({
            modulePath,
            node: target.node,
            symbolId,
            aliasName: node.name,
            aliasFor: target.symbolId,
        });
    }

    /** Resolve a type/inline-tag target to a documented symbol id (or null). */
    const resolveLink = (target) => {
        if (typeof target === 'number')
            return byId.get(target)?.symbolId ?? null;
        return null; // external package or URL target — no internal link
    };

    // Stamp the commit SHA from any GitHub permalink (version-locking for free).
    let commit;
    outer: for (const { node } of declarations) {
        for (const source of node.sources ?? []) {
            const match = source.url?.match(/\/blob\/([0-9a-f]{40})\//);
            if (match) {
                commit = match[1];
                break outer;
            }
        }
    }

    // Pass 2: build ReferenceSymbols.
    const symbols = [];
    for (const {
        modulePath,
        node,
        symbolId,
        aliasName,
        aliasFor,
    } of declarations) {
        // Decorators are declared as functions or as consts built by factories
        // (e.g. the VerifyIs* validation rules from `registerRule`). A const only
        // counts when its type is callable — decorator folders also export
        // metadata-key/name constants.
        const isDecorator =
            modulePath.includes('/decorators/') &&
            (node.kind === Kind.Function ||
                (node.kind === Kind.Variable && isDecoratorType(node.type)));
        const category = categorize(modulePath);
        const refs = new Set();
        const comment = node.comment ?? node.signatures?.[0]?.comment;
        const tags = extractBlockTags(comment, resolveLink);
        const source = node.sources?.[0];

        const signatures =
            node.kind === Kind.Function
                ? buildSignatures(node, refs, resolveLink)
                : undefined;
        const members = buildMembers(node, refs, resolveLink);

        const typeParameters = node.typeParameters?.length
            ? node.typeParameters.map((tp) => ({
                  name: tp.name,
                  constraint: tp.type ? renderType(tp.type, refs) : undefined,
                  default: tp.default
                      ? renderType(tp.default, refs)
                      : undefined,
              }))
            : undefined;

        // For type aliases and constants, render the aliased/declared type.
        const type =
            node.kind === Kind.TypeAlias || node.kind === Kind.Variable
                ? renderType(node.type, refs)
                : undefined;

        const extendedTypes = node.extendedTypes?.length
            ? node.extendedTypes.map((t) => renderType(t, refs))
            : undefined;
        const implementedTypes = node.implementedTypes?.length
            ? node.implementedTypes.map((t) => renderType(t, refs))
            : undefined;

        let decorator;
        if (isDecorator) {
            const primary = signatures?.[0];
            decorator = {
                target: inferDecoratorTarget(primary?.returns.type ?? ''),
                optionsType: primary?.parameters.find((p) =>
                    /options|settings|configuration/i.test(p.name),
                )?.type,
            };
        }

        // Coverage: does this symbol carry enough TSDoc to document itself?
        const summary = renderComment(comment?.summary, resolveLink);
        const missingParamDocs = (signatures ?? [])
            .flatMap((sig) => sig.parameters)
            .filter((p) => !p.doc)
            .map((p) => p.name);

        // Cross-refs: only targets that resolve to another documented symbol.
        const crossRefs = [...refs]
            .map((id) => byId.get(id)?.symbolId)
            .filter((id) => id && id !== symbolId);

        const kind = isDecorator ? 'decorator' : kindNames[node.kind];

        symbols.push({
            id: symbolId,
            name: aliasName ?? node.name,
            kind,
            aliasFor,
            category,
            group: groupFor(kind),
            package: packageName,
            source: source
                ? { file: source.fileName, line: source.line, url: source.url }
                : undefined,
            doc: {
                summary: summary || undefined,
                remarks: tags.remarks,
                examples: tags.examples,
                see: tags.see,
                deprecated: tags.deprecated,
                since: tags.since,
            },
            typeParameters,
            type,
            extendedTypes,
            implementedTypes,
            signatures,
            members,
            decorator,
            crossRefs: [...new Set(crossRefs)].sort(),
            coverage: {
                hasSummary: Boolean(summary),
                hasExample: tags.examples.length > 0,
                missingParamDocs,
            },
        });
    }

    // Declaration-merged namespaces (an enum/interface/type plus a namespace of
    // the same name in the same module, e.g. `WebSocketEvent` and its guards)
    // collapse into the type's symbol as static members.
    /** @type {Map<string, any>} */
    const symbolById = new Map();
    const mergedSymbols = [];
    for (const symbol of symbols) {
        const existing = symbolById.get(symbol.id);
        if (!existing) {
            symbolById.set(symbol.id, symbol);
            mergedSymbols.push(symbol);
            continue;
        }
        const [host, namespace] =
            existing.kind === 'namespace'
                ? [symbol, existing]
                : [existing, symbol];
        if (namespace.kind !== 'namespace') {
            mergedSymbols.push(symbol); // unexpected duplicate — keep both
            continue;
        }
        host.members = [
            ...(host.members ?? []),
            ...(namespace.members ?? []).map((member) => ({
                ...member,
                static: true,
            })),
        ];
        host.doc.summary ??= namespace.doc.summary;
        host.coverage.hasSummary = Boolean(host.doc.summary);
        host.crossRefs = [
            ...new Set([...host.crossRefs, ...namespace.crossRefs]),
        ].sort();
        if (existing === namespace) {
            mergedSymbols[mergedSymbols.indexOf(namespace)] = host;
            symbolById.set(host.id, host);
        }
    }

    mergedSymbols.sort((a, b) => a.id.localeCompare(b.id));

    const model = {
        // Namespaced to the artifact, not to whichever repo consumes it — the
        // consumer has already moved once and the schema is produced here
        // regardless.
        $schema: 'base/reference-model@2',
        package: packageName,
        commit,
        generatedAt: new Date().toISOString(),
        counts: countBy(mergedSymbols, (s) => s.kind),
        tree: buildTree(mergedSymbols),
        symbols: mergedSymbols,
    };

    return { model, report: buildCoverageReport(mergedSymbols, commit) };
}

/**
 * The nav tree the docs site renders: subsystem → group → symbol ids. Emitted
 * explicitly so the consumer never has to re-derive grouping or ordering, and
 * so both sides agree on what "empty" means (a group with no symbols is simply
 * absent). Subsystems are alphabetical; groups follow `groupOrder`; symbols are
 * alphabetical by name within a group.
 *
 * @param {any[]} symbols
 */
function buildTree(symbols) {
    /** @type {Map<string, Map<string, any[]>>} */
    const bySubsystem = new Map();
    for (const symbol of symbols) {
        let groups = bySubsystem.get(symbol.category);
        if (!groups) {
            groups = new Map();
            bySubsystem.set(symbol.category, groups);
        }
        const group = groups.get(symbol.group) ?? [];
        group.push(symbol);
        groups.set(symbol.group, group);
    }

    return [...bySubsystem.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, groups]) => ({
            category,
            count: [...groups.values()].reduce((n, g) => n + g.length, 0),
            groups: [...groups.entries()]
                .sort(
                    ([a], [b]) =>
                        (groupOrder.indexOf(a) + 1 || Infinity) -
                        (groupOrder.indexOf(b) + 1 || Infinity),
                )
                .map(([group, groupSymbols]) => ({
                    group,
                    symbols: groupSymbols
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((s) => s.id),
                })),
        }));
}

/** @template T @param {T[]} items @param {(item: T) => string} key */
function countBy(items, key) {
    /** @type {Record<string, number>} */
    const counts = {};
    for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
    return counts;
}

// --- Coverage report -----------------------------------------------------------------

/**
 * @param {any[]} symbols
 * @param {string | undefined} commit
 */
function buildCoverageReport(symbols, commit) {
    // Aliases inherit their target's docs — reporting them would double-count
    // every gap, so measure only original symbols.
    symbols = symbols.filter((s) => !s.aliasFor);
    const missingSummary = symbols.filter((s) => !s.coverage.hasSummary);
    const decoratorsMissingExample = symbols.filter(
        (s) => s.kind === 'decorator' && !s.coverage.hasExample,
    );
    const functionsMissingExample = symbols.filter(
        (s) => s.kind === 'function' && !s.coverage.hasExample,
    );
    const missingParamDocs = symbols.filter(
        (s) => s.coverage.missingParamDocs.length > 0,
    );
    const withExample = symbols.filter((s) => s.coverage.hasExample);

    const percent = (n) =>
        symbols.length ? `${Math.round((n / symbols.length) * 100)}%` : '0%';
    const line = (s) =>
        `- ${s.source?.url ? `[\`${s.name}\`](${s.source.url})` : `\`${s.name}\``} — \`${s.id}\``;

    const sections = [
        '# TSDoc coverage report',
        '',
        `Generated from \`${commit ?? 'unknown commit'}\`.`,
        '',
        '| Metric | Count | Of total |',
        '| --- | --- | --- |',
        `| Documented symbols | ${symbols.length} | 100% |`,
        `| With summary | ${symbols.length - missingSummary.length} | ${percent(symbols.length - missingSummary.length)} |`,
        `| With \`@example\` | ${withExample.length} | ${percent(withExample.length)} |`,
        `| Missing summary | ${missingSummary.length} | ${percent(missingSummary.length)} |`,
        `| Decorators missing \`@example\` | ${decoratorsMissingExample.length} | — |`,
        `| Functions missing \`@example\` | ${functionsMissingExample.length} | — |`,
        `| Signatures with undocumented params | ${missingParamDocs.length} | — |`,
        '',
    ];

    const section = (title, items, describe = line) => {
        if (!items.length) return;
        sections.push(`## ${title} (${items.length})`, '');
        for (const item of items) sections.push(describe(item));
        sections.push('');
    };

    section('Symbols missing a summary', missingSummary);
    section('Decorators missing `@example`', decoratorsMissingExample);
    section(
        'Signatures with undocumented parameters',
        missingParamDocs,
        (s) =>
            `${line(s)} — missing: ${s.coverage.missingParamDocs.map((p) => `\`${p}\``).join(', ')}`,
    );

    return sections.join('\n');
}
