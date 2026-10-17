// Copyright (C) 2017-2026 Smart code 203358507

import { LastAddonError } from './errors';

export const DEFAULT_TTL_MS = 10 * 60 * 1000;
const SESSION_PREFIX = 'laststream.lastaddon.cache:';

type CacheEntry = {
    value: unknown;
    expiresAt: number;
};

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

const readSession = (key: string): CacheEntry | undefined => {
    try {
        const raw = globalThis.sessionStorage?.getItem(`${SESSION_PREFIX}${key}`);
        if (!raw) return undefined;
        const entry = JSON.parse(raw) as CacheEntry | null;
        return typeof entry?.expiresAt === 'number' ? entry : undefined;
    } catch {
        return undefined;
    }
};

const writeSession = (key: string, entry: CacheEntry): void => {
    try {
        globalThis.sessionStorage?.setItem(`${SESSION_PREFIX}${key}`, JSON.stringify(entry));
    } catch {
        // Quota dépassé ou stockage désactivé : le cache mémoire suffit.
    }
};

/**
 * Renvoie la valeur en cache si elle n'a pas expiré (mémoire puis sessionStorage), sinon exécute `load`.
 * Les requêtes identiques en vol sont partagées. Les erreurs ne sont jamais mises en cache.
 */
export const cachedRequest = <T>(key: string, load: () => Promise<T>, ttlMs: number = DEFAULT_TTL_MS): Promise<T> => {
    const entry = memory.get(key) ?? readSession(key);
    if (entry && entry.expiresAt > Date.now()) {
        memory.set(key, entry);
        return Promise.resolve(entry.value as T);
    }

    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;

    const request = new Promise<T>((resolve) => {
        resolve(load());
    }).then((value) => {
        const fresh: CacheEntry = { value, expiresAt: Date.now() + ttlMs };
        memory.set(key, fresh);
        writeSession(key, fresh);
        return value;
    }).finally(() => {
        inflight.delete(key);
    });

    inflight.set(key, request);
    return request;
};

/** Vide le cache mémoire et les entrées sessionStorage de LastAddon. */
export const clearCache = (): void => {
    memory.clear();
    try {
        const storage = globalThis.sessionStorage;
        if (!storage) return;
        for (let index = storage.length - 1; index >= 0; index -= 1) {
            const key = storage.key(index);
            if (key?.startsWith(SESSION_PREFIX)) storage.removeItem(key);
        }
    } catch {
        // Stockage indisponible : rien à nettoyer.
    }
};

const readErrorCode = async (response: Response): Promise<string | undefined> => {
    try {
        const body = (await response.json()) as { error?: unknown } | null;
        return typeof body?.error === 'string' ? body.error : undefined;
    } catch {
        return undefined;
    }
};

export type RequestOptions = {
    method?: 'GET' | 'POST';
    body?: unknown;
};

/** Requête JSON sans cache. Toute erreur est remontée sous forme de LastAddonError. */
export const requestJson = async <T>(url: string, options: RequestOptions = {}): Promise<T> => {
    const method = options.method ?? 'GET';
    const headers: Record<string, string> = { accept: 'application/json' };
    let body: string | undefined;
    if (options.body !== undefined) {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
        response = await fetch(url, { method, headers, body });
    } catch {
        throw new LastAddonError('network', 'LastAddon is unreachable.');
    }

    if (!response.ok) {
        const code = await readErrorCode(response);
        throw new LastAddonError('http', `LastAddon responded with HTTP ${response.status}.`, {
            status: response.status,
            code,
        });
    }

    try {
        return (await response.json()) as T;
    } catch {
        throw new LastAddonError('invalid_response', 'LastAddon returned a body that is not valid JSON.');
    }
};
