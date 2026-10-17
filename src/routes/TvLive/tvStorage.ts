// Copyright (C) 2017-2026 Smart code 203358507

import type { TvChannel, TvImportRequest } from 'stremio/common/lastAddon';

// Tout reste dans ce navigateur. Les identifiants Xtream ne sont jamais journalisés ni placés dans une URL :
// ils sont seulement transmis à LastAddon pour lire la playlist (voir tvImport).
const FAVORITES_KEY = 'ls_tv_fav';
const LAST_CHANNEL_KEY = 'ls_tv_last';
const PLAYLIST_KEY = 'ls_tv_playlist';

const readJson = <T>(key: string, fallback: T): T => {
    try {
        const raw = globalThis.localStorage?.getItem(key);
        return raw ? JSON.parse(raw) as T : fallback;
    } catch {
        return fallback;
    }
};

const writeJson = (key: string, value: unknown): void => {
    try {
        globalThis.localStorage?.setItem(key, JSON.stringify(value));
    } catch {
        // Stockage indisponible (navigation privée, quota) : le réglage reste valable pour la session.
    }
};

const removeKey = (key: string): void => {
    try {
        globalThis.localStorage?.removeItem(key);
    } catch {
        // Rien à retirer si le stockage est indisponible.
    }
};

export const readFavorites = (): string[] => {
    const value = readJson<unknown>(FAVORITES_KEY, []);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
};

export const writeFavorites = (ids: string[]): void => writeJson(FAVORITES_KEY, ids);

export type LastChannel = Pick<TvChannel, 'id' | 'name' | 'logo' | 'group' | 'cat' | 'source' | 'fast' | 'url' | 'sig' | 'epgId' | 'flaky'>;

// `sig` peut manquer dans une entrée enregistrée avant le durcissement : le lecteur la traite alors comme non jouable.
export const readLastChannel = (): LastChannel | null => {
    const value = readJson<LastChannel | null>(LAST_CHANNEL_KEY, null);
    return value && typeof value.id === 'string' && typeof value.url === 'string' ? value : null;
};

export const writeLastChannel = (channel: TvChannel): void => {
    const { id, name, logo, group, cat, source, fast, url, sig, epgId, flaky } = channel;
    writeJson(LAST_CHANNEL_KEY, { id, name, logo, group, cat, source, fast, url, sig, epgId, flaky });
};

/** Configuration de la playlist personnelle (même forme que la requête d'import LastAddon). */
export const readPlaylist = (): TvImportRequest | null => {
    const value = readJson<TvImportRequest | null>(PLAYLIST_KEY, null);
    if (!value || typeof value !== 'object') return null;
    if (value.type === 'm3u' && typeof value.url === 'string') return value;
    if (
        value.type === 'xtream'
        && typeof value.server === 'string'
        && typeof value.username === 'string'
        && typeof value.password === 'string'
    ) {
        return value;
    }
    return null;
};

// Chaînes issues de l'import de la playlist personnelle, gardées 6 h en mémoire (jamais sur disque, sans identifiants).
const USER_CHANNELS_TTL_MS = 6 * 60 * 60 * 1000;
let userChannelsCache: { channels: TvChannel[], expiresAt: number } | null = null;

export const readUserChannelsCache = (now: number = Date.now()): TvChannel[] | null => (
    userChannelsCache && userChannelsCache.expiresAt > now ? userChannelsCache.channels : null
);

export const writeUserChannelsCache = (channels: TvChannel[], now: number = Date.now()): void => {
    userChannelsCache = { channels, expiresAt: now + USER_CHANNELS_TTL_MS };
};

export const clearUserChannelsCache = (): void => {
    userChannelsCache = null;
};

export const writePlaylist = (playlist: TvImportRequest): void => {
    clearUserChannelsCache();
    writeJson(PLAYLIST_KEY, playlist);
};

/** Oublier ma playlist : retire la configuration du stockage local et les chaînes importées de la mémoire. */
export const clearPlaylist = (): void => {
    clearUserChannelsCache();
    removeKey(PLAYLIST_KEY);
};
