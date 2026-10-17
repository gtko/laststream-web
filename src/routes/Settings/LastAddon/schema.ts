// Copyright (C) 2017-2026 Smart code 203358507

// Sous-ensemble du JSON Schema renvoyé par GET /config/schema (zod, sans $ref).
export type SchemaNode = {
    type?: string,
    title?: string,
    const?: unknown,
    default?: unknown,
    enum?: string[],
    format?: string,
    minimum?: number,
    properties?: Record<string, SchemaNode>,
    required?: string[],
    items?: SchemaNode,
    oneOf?: SchemaNode[],
};

// Valeurs saisies, de même forme que la configuration.
export type Draft = Record<string, any>;

export type Translate = (key: string, options: { defaultValue: string }) => string;

// Racines du schéma affichées dans le formulaire. excludedTags, maxResults et onlyCached restent sur les défauts du serveur.
export const FORM_ROOTS = ['sources', 'languages', 'resolutions', 'size', 'debrid', 'services'] as const;

const FIELD_LABELS: Record<string, string> = {
    'languages.preferred': 'Langues préférées',
    'languages.acceptVostfr': 'Accepter les VOSTFR',
    'languages.fallbackToOthers': 'Autres langues si rien en français',
    'resolutions.allowed': 'Qualités autorisées',
    'resolutions.max': 'Qualité maximale',
    'size.minGb': 'Taille minimale (Go)',
    'size.maxGb': 'Taille maximale (Go)',
    'debrid.apiKey': 'Clé API AllDebrid',
    'sources.name': 'Nom',
    'sources.url': 'Adresse',
    'sources.baseUrl': 'Adresse Torznab',
    'sources.apiKey': 'Clé API Torznab',
};

const OPTION_LABELS: Record<string, string> = {
    fr: 'Français',
    en: 'Anglais',
    es: 'Espagnol',
    de: 'Allemand',
    it: 'Italien',
    multi: 'Multi-langues',
    original: 'Version originale',
    upstream: 'Addon Stremio ou API HTTP',
    torznab: 'Torznab',
};

/** Champ secret (clé ou jeton) : saisi dans un champ mot de passe, jamais affiché ni conservé. */
export const isSecretKey = (name: string): boolean => /(Key|Token)$/.test(name);

export const fieldsOf = (node?: SchemaNode): [string, SchemaNode][] => Object.entries(node?.properties ?? {});

/** Champs qu'on sait saisir : booléens, nombres, textes, choix uniques et listes de choix. Les const et objets sont ignorés. */
export const isRenderable = (node: SchemaNode): boolean => {
    if (node.const !== undefined) return false;
    if (node.type === 'array') return node.items?.enum !== undefined;
    if (node.enum !== undefined) return true;
    return ['boolean', 'number', 'integer', 'string'].includes(node.type ?? '');
};

export const fieldLabel = (translate: Translate, path: string, node: SchemaNode): string => translate(
    `LASTADDON_FIELD_${path.replace(/\./g, '_')}`,
    { defaultValue: FIELD_LABELS[path] ?? node.title ?? path.split('.').pop() ?? path },
);

export const optionLabel = (translate: Translate, value: string): string => translate(
    `LASTADDON_OPTION_${value}`,
    { defaultValue: OPTION_LABELS[value] ?? value },
);

/** Valeurs par défaut du schéma (récursif sur les objets). Les champs sans défaut restent absents. */
export const defaultsOf = (node?: SchemaNode): unknown => {
    if (!node) return undefined;
    if (node.type === 'object') {
        // Un objet porte souvent `default: {}` : ses champs ont alors leurs propres défauts, qu'il faut lire aussi.
        const fromFields = Object.fromEntries(fieldsOf(node).flatMap(([key, child]) => {
            const value = defaultsOf(child);
            return value === undefined ? [] : [[key, value]];
        }));
        const merged = { ...((node.default as Draft | undefined) ?? {}), ...fromFields };
        return Object.keys(merged).length > 0 ? merged : undefined;
    }
    return node.default !== undefined ? JSON.parse(JSON.stringify(node.default)) as unknown : undefined;
};

export const setIn = (draft: Draft, path: string[], value: unknown): Draft => {
    const [head, ...rest] = path;
    if (rest.length === 0) return { ...draft, [head]: value };
    return { ...draft, [head]: setIn((draft[head] ?? {}) as Draft, rest, value) };
};

/**
 * Valeur de configuration pour un nœud du schéma : chaînes nettoyées, champs vides omis, nombres lus depuis le texte,
 * variante de `oneOf` choisie par son `type`. Renvoie undefined quand un champ requis manque.
 */
export const buildValue = (node: SchemaNode | undefined, value: unknown): unknown => {
    if (!node) return undefined;
    if (node.const !== undefined) return node.const;
    if (node.oneOf) {
        const type = (value as Draft | undefined)?.type;
        return buildValue(node.oneOf.find((option) => option.properties?.type?.const === type), value);
    }
    if (value === undefined || value === null) return undefined;
    switch (node.type) {
        case 'object': {
            // Un objet sans propriétés déclarées (size.perResolution) n'est pas saisi dans le formulaire.
            if (typeof value !== 'object' || !node.properties) return undefined;
            const out: Draft = {};
            fieldsOf(node).forEach(([key, child]) => {
                const built = buildValue(child, (value as Draft)[key]);
                if (built !== undefined) out[key] = built;
            });
            return (node.required ?? []).every((key) => out[key] !== undefined) ? out : undefined;
        }
        case 'array':
            return Array.isArray(value) ?
                value.map((item) => buildValue(node.items, item)).filter((item) => item !== undefined) :
                undefined;
        case 'number':
        case 'integer': {
            if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
            const text = String(value).trim();
            const parsed = Number(text.replace(',', '.'));
            return text === '' || !Number.isFinite(parsed) ? undefined : parsed;
        }
        case 'string': {
            if (typeof value !== 'string') return undefined;
            const trimmed = value.trim();
            return trimmed === '' ? undefined : trimmed;
        }
        case 'boolean':
            return typeof value === 'boolean' ? value : undefined;
        default:
            return value;
    }
};

/** Corps de POST /config/encode : seules les racines du formulaire sont envoyées, le reste garde les défauts serveur. */
export const buildPayload = (schema: SchemaNode, draft: Draft): Draft => {
    const payload: Draft = {};
    FORM_ROOTS.forEach((root) => {
        const built = buildValue(schema.properties?.[root], draft[root]);
        if (built !== undefined) payload[root] = built;
    });
    return payload;
};

export const hasIncompleteSource = (schema: SchemaNode, draft: Draft): boolean => {
    const items = schema.properties?.sources?.items;
    return ((draft.sources ?? []) as Draft[]).some((source) => buildValue(items, source) === undefined);
};
