// Copyright (C) 2017-2026 Smart code 203358507

import { LastAddonError } from './errors';

export const DEFAULT_TTL_MS = 10 * 60 * 1000;
// Le serveur répond `private, max-age=300` : un cache client plus court ne ferait que refetcher.
export const MIN_TTL_MS = 5 * 60 * 1000;
// Le serveur limite les GET /lt/* à 120/min/IP : on garde peu de requêtes en vol (les autres attendent leur tour).
export const MAX_IN_FLIGHT = 6;
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

    const lifetime = Math.max(ttlMs, MIN_TTL_MS);
    const request = new Promise<T>((resolve) => {
        resolve(load());
    }).then((value) => {
        const fresh: CacheEntry = { value, expiresAt: Date.now() + lifetime };
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

let inFlight = 0;

type Waiter = {
    grant: () => void,
    reject: (error: Error) => void,
};
const waiting: Waiter[] = [];

const abortError = (): Error => new DOMException('Requête LastAddon annulée.', 'AbortError');

// Un créneau libéré passe directement au premier en attente (FIFO) ; `inFlight` ne redescend qu'à vide.
// Une requête annulée pendant l'attente quitte la file sans jamais occuper de créneau.
const acquireSlot = (signal?: AbortSignal): Promise<void> => {
    if (signal?.aborted) return Promise.reject(abortError());
    if (inFlight < MAX_IN_FLIGHT) {
        inFlight += 1;
        return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
        const waiter: Waiter = { grant: resolve, reject };
        waiting.push(waiter);
        signal?.addEventListener('abort', () => {
            const index = waiting.indexOf(waiter);
            if (index !== -1) {
                waiting.splice(index, 1);
                reject(abortError());
            }
        }, { once: true });
    });
};

const releaseSlot = (): void => {
    const next = waiting.shift();
    if (next) next.grant();
    else inFlight -= 1;
};

/**
 * Annule les requêtes en attente de créneau (changement de page : elles ne servent plus). Les requêtes déjà
 * en vol ne sont pas touchées, elles alimentent le cache. Renvoie à React comme nettoyage d'effet.
 */
export const cancelQueuedRequests = (): void => {
    waiting.splice(0).forEach((waiter) => waiter.reject(abortError()));
};

/** Exécute `task` dès qu'un des MAX_IN_FLIGHT créneaux est libre, ou échoue si `signal` est annulé avant. */
const limited = async <T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
    await acquireSlot(signal);
    try {
        return await task();
    } finally {
        releaseSlot();
    }
};

export type RequestOptions = {
    method?: 'GET' | 'POST';
    body?: unknown;
    signal?: AbortSignal;
};

/**
 * Requête JSON sans cache, à concurrence bornée. `signal` annule la requête (en attente ou en vol).
 * Toute autre erreur est remontée sous forme de LastAddonError.
 */
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
        response = await limited(() => fetch(url, { method, headers, body, signal: options.signal }), options.signal);
    } catch (error) {
        if (options.signal?.aborted) throw error;
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
