// Copyright (C) 2017-2026 Smart code 203358507

import { LastAddonError } from './errors';
import type { LastAddonSettings, LastAddonSnapshot } from './types';

export const LASTADDON_ID = 'com.laststream.lastaddon';
export const SETTINGS_STORAGE_KEY = 'laststream.lastaddon';
export const DEV_STORAGE_KEY = 'laststream.lastaddon.dev';
export const PROTOTYPE_API_BASE = 'http://localhost:8089/api';

export type QueryValue = string | number | boolean | null | undefined;

const readDevPrototypeFlag = (): boolean => {
    try {
        if (typeof process !== 'undefined' && process.env?.LASTADDON_DEV_PROTOTYPE === '1') return true;
    } catch {
        // Pas de `process` dans le navigateur : on passe au réglage localStorage.
    }
    try {
        return globalThis.localStorage?.getItem(DEV_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
};

// Interrupteur unique. true : les URLs pointent sur le prototype (http://localhost:8089/api/<path>)
// au lieu de {base}/{config}/lt/<path>. Lu une fois au chargement : recharger la page après un changement.
export const DEV_PROTOTYPE_MODE: boolean = readDevPrototypeFlag();

const EMPTY_SETTINGS: LastAddonSettings = { base: '', config: '' };

const readSettings = (): LastAddonSettings => {
    try {
        const raw = globalThis.localStorage?.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return EMPTY_SETTINGS;
        const parsed = JSON.parse(raw) as Partial<LastAddonSettings> | null;
        return {
            base: typeof parsed?.base === 'string' ? parsed.base : '',
            config: typeof parsed?.config === 'string' ? parsed.config : '',
        };
    } catch {
        return EMPTY_SETTINGS;
    }
};

const writeSettings = (settings: LastAddonSettings): void => {
    try {
        globalThis.localStorage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // Stockage indisponible (navigation privée, quota) : le réglage reste valable en mémoire.
    }
};

const makeSnapshot = (settings: LastAddonSettings): LastAddonSnapshot => ({
    configured: DEV_PROTOTYPE_MODE || (settings.base !== '' && settings.config !== ''),
    base: settings.base,
    config: settings.config,
});

let settings: LastAddonSettings = readSettings();
let snapshot: LastAddonSnapshot = makeSnapshot(settings);
const listeners = new Set<() => void>();

const commit = (next: LastAddonSettings): void => {
    settings = next;
    snapshot = makeSnapshot(next);
    writeSettings(next);
    listeners.forEach((listener) => listener());
};

const normalizeBase = (raw: string): string => {
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (trimmed === '') return '';
    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        throw new LastAddonError('invalid_base', 'LastAddon base URL is not a valid URL.');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new LastAddonError('invalid_base', 'LastAddon base URL must use http or https.');
    }
    return trimmed;
};

export const getBase = (): string => settings.base;

export const getConfig = (): string => settings.config;

/** Enregistre l'URL de base (sans slash final). Chaîne vide : efface. Lève LastAddonError('invalid_base'). */
export const setBase = (base: string): void => {
    const normalized = normalizeBase(base);
    if (normalized === settings.base) return;
    commit({ ...settings, base: normalized });
};

/** Enregistre la configuration chiffrée (sortie de encodeConfig). Chaîne vide : efface. */
export const setConfig = (config: string): void => {
    const trimmed = config.trim();
    if (trimmed === settings.config) return;
    commit({ ...settings, config: trimmed });
};

export const isConfigured = (): boolean => snapshot.configured;

export const getSnapshot = (): LastAddonSnapshot => snapshot;

/** Abonnement aux changements de base ou de configuration. Renvoie la fonction de désabonnement. */
export const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

/** Base obligatoire pour les routes non-lt (schéma, encodage, test, manifest). Lève not_configured si absente. */
export const requireBase = (): string => {
    if (settings.base === '') {
        throw new LastAddonError('not_configured', 'LastAddon base URL is not configured.');
    }
    return settings.base;
};

const encodePath = (path: string): string => path
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const buildQuery = (query?: Record<string, QueryValue>): string => {
    if (!query) return '';
    const params = new URLSearchParams();
    Object.keys(query).forEach((key) => {
        const value = query[key];
        if (value !== undefined && value !== null) params.append(key, String(value));
    });
    const serialized = params.toString();
    return serialized === '' ? '' : `?${serialized}`;
};

/**
 * URL d'une route lt. `path` est relatif à /lt (ex. `tmdb/movie/550`, `tv/channels`).
 * Mode prototype : http://localhost:8089/api/<path>. Sinon : {base}/{config}/lt/<path>.
 * Lève LastAddonError('not_configured') hors mode prototype si base ou configuration manquent.
 */
export const ltUrl = (path: string, query?: Record<string, QueryValue>): string => {
    const suffix = `${encodePath(path)}${buildQuery(query)}`;
    if (DEV_PROTOTYPE_MODE) return `${PROTOTYPE_API_BASE}/${suffix}`;
    if (settings.base === '' || settings.config === '') {
        throw new LastAddonError('not_configured', 'LastAddon is not configured (base URL or config missing).');
    }
    return `${settings.base}/${encodeURIComponent(settings.config)}/lt/${suffix}`;
};
