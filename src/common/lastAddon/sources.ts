// Copyright (C) 2017-2026 Smart code 203358507

import { getLaststream } from './stream';
import type { LastStreamInfo, LastStreamLang } from './types';

// Fonctions pures de sélection des sources LastAddon : tri par score, regroupement par qualité,
// mesure du débit disponible et choix de la source de lecture automatique.

export type QualityGroupKey = '2160p' | '1080p' | '720p' | 'SD' | 'other';

export const QUALITY_GROUP_ORDER: readonly QualityGroupKey[] = ['2160p', '1080p', '720p', 'SD', 'other'];

export type QualityGroup<T> = {
    key: QualityGroupKey;
    streams: T[];
};

export type AutoplayPick<T> = {
    stream: T;
    languageFallback: boolean;
};

export const BANDWIDTH_CACHE_TTL_MS = 10 * 60 * 1000;
export const BANDWIDTH_TIMEOUT_MS = 2000;
export const BANDWIDTH_PROBE_BYTES = 262144;
// En dessous de cette taille, la mesure reflète surtout la latence : on l'ignore.
export const BANDWIDTH_MIN_PROBE_BYTES = 65536;
// Marge : une source ne doit pas dépasser 80 % du débit mesuré.
export const BANDWIDTH_HEADROOM = 0.8;
export const BANDWIDTH_FALLBACK_PROBE_URL = '/assets/images/empty.png';
const BANDWIDTH_STORAGE_KEY = 'laststream.bandwidth';

type BandwidthCacheEntry = {
    kbps: number;
    expiresAt: number;
};

let memoryBandwidth: BandwidthCacheEntry | null = null;

/** URL HTTP(S) directe d'un stream, ou null (torrent, lien externe, flux sans URL). */
export const getStreamHttpUrl = (stream: object): string | null => {
    const url = (stream as { url?: unknown }).url;
    return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
};

/** Qualité d'un stream ; les streams sans objet `laststream` vont dans « other ». */
export const getQualityGroupKey = (stream: object): QualityGroupKey => {
    switch (getLaststream(stream)?.resolution) {
        case '2160p': return '2160p';
        case '1080p': return '1080p';
        case '720p': return '720p';
        case '480p':
        case 'SD': return 'SD';
        default: return 'other';
    }
};

/**
 * Tri par score décroissant (stable). Les streams scorés passent devant ceux sans objet `laststream`,
 * qui gardent leur ordre d'origine.
 */
export const sortStreams = <T extends object>(streams: readonly T[]): T[] => {
    const scored: { stream: T; score: number; index: number }[] = [];
    const unscored: T[] = [];
    streams.forEach((stream, index) => {
        const info = getLaststream(stream);
        if (info) {
            scored.push({ stream, score: info.score, index });
        } else {
            unscored.push(stream);
        }
    });
    scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));
    return [...scored.map(({ stream }) => stream), ...unscored];
};

/** Regroupe les streams par qualité, dans l'ordre 2160p, 1080p, 720p, SD, other. Les groupes vides sont omis. */
export const groupByQuality = <T extends object>(streams: readonly T[]): QualityGroup<T>[] => {
    const buckets = new Map<QualityGroupKey, T[]>();
    streams.forEach((stream) => {
        const key = getQualityGroupKey(stream);
        const bucket = buckets.get(key);
        if (bucket) {
            bucket.push(stream);
        } else {
            buckets.set(key, [stream]);
        }
    });
    return QUALITY_GROUP_ORDER
        .filter((key) => buckets.has(key))
        .map((key) => ({ key, streams: buckets.get(key) ?? [] }));
};

/** Vrai si le stream propose la langue demandée (VF) ou du multi-audio. Un flag serveur `languageFallback` l'annule. */
export const matchesLanguage = (info: LastStreamInfo, lang: LastStreamLang): boolean => {
    if (info.languageFallback === true) return false;
    return info.languages.includes(lang) || info.languages.includes('multi');
};

/**
 * Combine débit réseau (navigator.connection.downlink, Mbps) et débit mesuré : le plus faible des deux
 * quand les deux existent, sinon celui qui existe, sinon null.
 */
export const combineBandwidthKbps = (networkKbps: number | null, probeKbps: number | null): number | null => {
    if (networkKbps !== null && probeKbps !== null) return Math.min(networkKbps, probeKbps);
    return networkKbps ?? probeKbps;
};

const now = (): number => (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();

const readNetworkKbps = (): number | null => {
    try {
        const connection = (globalThis.navigator as { connection?: { downlink?: unknown } } | undefined)?.connection;
        const downlink = connection?.downlink;
        return typeof downlink === 'number' && Number.isFinite(downlink) && downlink > 0 ? downlink * 1000 : null;
    } catch {
        return null;
    }
};

const readCachedBandwidth = (): number | null => {
    if (memoryBandwidth && memoryBandwidth.expiresAt > Date.now()) return memoryBandwidth.kbps;
    try {
        const raw = globalThis.sessionStorage?.getItem(BANDWIDTH_STORAGE_KEY);
        if (!raw) return null;
        const entry = JSON.parse(raw) as Partial<BandwidthCacheEntry> | null;
        if (typeof entry?.kbps === 'number' && typeof entry.expiresAt === 'number' && entry.expiresAt > Date.now()) {
            memoryBandwidth = { kbps: entry.kbps, expiresAt: entry.expiresAt };
            return entry.kbps;
        }
    } catch {
        // Stockage indisponible : on mesure à nouveau.
    }
    return null;
};

const writeCachedBandwidth = (kbps: number): void => {
    const entry: BandwidthCacheEntry = { kbps, expiresAt: Date.now() + BANDWIDTH_CACHE_TTL_MS };
    memoryBandwidth = entry;
    try {
        globalThis.sessionStorage?.setItem(BANDWIDTH_STORAGE_KEY, JSON.stringify(entry));
    } catch {
        // Quota dépassé ou navigation privée : le cache mémoire suffit.
    }
};

/**
 * Débit d'une lecture brute de `url` : lit au plus BANDWIDTH_PROBE_BYTES (Range demandé, mais un serveur
 * qui ignore Range ne renvoie jamais plus), abandonne après BANDWIDTH_TIMEOUT_MS. Null si échec.
 */
const probeUrlKbps = async (url: string): Promise<number | null> => {
    if (typeof fetch !== 'function') return null;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), BANDWIDTH_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            headers: { Range: `bytes=0-${BANDWIDTH_PROBE_BYTES - 1}` },
            cache: 'no-store',
            signal: controller?.signal,
        });
        const reader = response.ok && response.body ? response.body.getReader() : null;
        if (!reader) return null;
        const startedAt = now();
        let received = 0;
        while (received < BANDWIDTH_PROBE_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value?.byteLength ?? 0;
        }
        const elapsedSeconds = (now() - startedAt) / 1000;
        await reader.cancel().catch(() => undefined);
        const bytes = Math.min(received, BANDWIDTH_PROBE_BYTES);
        if (bytes < BANDWIDTH_MIN_PROBE_BYTES || elapsedSeconds <= 0) return null;
        return (bytes * 8) / 1000 / elapsedSeconds;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
};

/**
 * Débit disponible en kbps, mis en cache 10 minutes (mémoire puis sessionStorage).
 * Combine navigator.connection.downlink et une mesure courte sur `url` (le stream choisi), à défaut sur
 * un petit fichier de l'application. Renvoie null si aucune estimation n'est possible.
 */
export const measureBandwidthKbps = async (url?: string | null): Promise<number | null> => {
    const cached = readCachedBandwidth();
    if (cached !== null) return cached;

    const networkKbps = readNetworkKbps();
    const probeKbps = await probeUrlKbps(url ?? BANDWIDTH_FALLBACK_PROBE_URL);
    const kbps = combineBandwidthKbps(networkKbps, probeKbps);
    if (kbps !== null) writeCachedBandwidth(kbps);
    return kbps;
};

/**
 * Choisit la source de lecture automatique : meilleur score parmi les streams scorés dont le débit estimé
 * tient dans 80 % de `bwKbps` (estBitrateKbps absent : accepté ; bwKbps null : pas de filtre de débit).
 * Préfère la langue demandée ; sinon renvoie la meilleure source avec languageFallback à true.
 * Renvoie null si aucune source ne convient (le drawer doit alors s'ouvrir).
 */
export const pickAutoplay = <T extends object>(
    streams: readonly T[],
    bwKbps: number | null,
    preferredLang: LastStreamLang = 'fr',
): AutoplayPick<T> | null => {
    const budgetKbps = bwKbps === null || !Number.isFinite(bwKbps)
        ? Infinity
        : Math.max(0, bwKbps) * BANDWIDTH_HEADROOM;

    const fitting: { stream: T; info: LastStreamInfo }[] = [];
    sortStreams(streams).forEach((stream) => {
        const info = getLaststream(stream);
        if (!info) return;
        if (info.estBitrateKbps !== null && info.estBitrateKbps > budgetKbps) return;
        fitting.push({ stream, info });
    });
    if (fitting.length === 0) return null;

    const preferred = fitting.find(({ info }) => matchesLanguage(info, preferredLang));
    if (preferred) return { stream: preferred.stream, languageFallback: false };
    return { stream: fitting[0].stream, languageFallback: true };
};
