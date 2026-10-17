// Copyright (C) 2017-2026 Smart code 203358507

import { getLaststream } from './stream';
import { getBandwidthSetting, type BandwidthSetting } from './prefs';
import type { LastStreamInfo, LastStreamLang } from './types';

// Fonctions pures de sélection des sources LastAddon : tri par score, regroupement par qualité,
// mesure du débit disponible et choix de la source de lecture automatique.

export type QualityGroupKey = '2160p' | '1080p' | '720p' | 'SD' | 'other';

export const QUALITY_GROUP_ORDER: readonly QualityGroupKey[] = ['2160p', '1080p', '720p', 'SD', 'other'];

export type QualityGroup<T> = {
    key: QualityGroupKey;
    streams: T[];
};

export type AutoplayFallbackReason = 'no-vf' | 'vf-too-heavy';

export type AutoplayPick<T> = {
    stream: T;
    languageFallback: boolean;
    // Présent seulement en repli VO : « aucune VF dans la liste » ou « une VF existe mais dépasse le débit ».
    fallbackReason?: AutoplayFallbackReason;
};

// Mesure de débit : un téléchargement d'au plus 8 Mo ou 3 s sur le CDN de test (CORS ouvert, vérifié).
export const BANDWIDTH_MEASURE_URL = 'https://speed.cloudflare.com/__down?bytes=8000000';
export const BANDWIDTH_MEASURE_BYTES = 8000000;
export const BANDWIDTH_MEASURE_MS = 3000;
// En dessous de cette taille, la mesure reflète surtout la latence : on la rejette.
export const BANDWIDTH_MIN_MEASURE_BYTES = 65536;
// Dernière mesure valable 24 h (localStorage).
export const BANDWIDTH_STORED_TTL_MS = 24 * 60 * 60 * 1000;
export const BANDWIDTH_STORAGE_KEY = 'laststream.bandwidth.measured';
// Marge : une source ne doit pas dépasser 80 % du débit retenu.
export const BANDWIDTH_HEADROOM = 0.8;
// Plus de 3 blocages de lecture en 60 s : le débit retenu baisse de 30 %.
export const BANDWIDTH_STALL_WINDOW_MS = 60 * 1000;
export const BANDWIDTH_STALL_LIMIT = 3;
export const BANDWIDTH_STALL_PENALTY = 0.7;

export type StoredBandwidth = {
    kbps: number;
    expiresAt: number;
};

/** Où trouver le débit : réglage manuel (sans mesure), dernière mesure encore valable, ou nouvelle mesure. */
export type BandwidthPlan =
    | { kind: 'manual', kbps: number }
    | { kind: 'stored', kbps: number }
    | { kind: 'measure' };

/** Décision pure : réglage fixe > mesure stockée valable > nouvelle mesure. */
export const planBandwidth = (
    setting: BandwidthSetting,
    stored: StoredBandwidth | null,
    now: number,
): BandwidthPlan => {
    if (setting !== 'auto') return { kind: 'manual', kbps: setting * 1000 };
    if (stored && Number.isFinite(stored.kbps) && stored.kbps > 0 && stored.expiresAt > now) {
        return { kind: 'stored', kbps: stored.kbps };
    }
    return { kind: 'measure' };
};

/**
 * Enregistre un blocage de lecture. Renvoie les horodatages encore utiles et `lower` quand le seuil est dépassé
 * (plus de BANDWIDTH_STALL_LIMIT blocages dans la fenêtre) ; la liste repart alors de zéro.
 */
export const registerStallEvent = (
    events: readonly number[],
    now: number,
): { events: number[], lower: boolean } => {
    const recent = [...events.filter((at) => now - at < BANDWIDTH_STALL_WINDOW_MS), now];
    if (recent.length > BANDWIDTH_STALL_LIMIT) return { events: [], lower: true };
    return { events: recent, lower: false };
};

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

const now = (): number => (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();

const readStoredBandwidth = (): StoredBandwidth | null => {
    try {
        const raw = globalThis.localStorage?.getItem(BANDWIDTH_STORAGE_KEY);
        if (!raw) return null;
        const entry = JSON.parse(raw) as Partial<StoredBandwidth> | null;
        if (typeof entry?.kbps === 'number' && typeof entry.expiresAt === 'number') {
            return { kbps: entry.kbps, expiresAt: entry.expiresAt };
        }
    } catch {
        // Entrée illisible ou stockage indisponible : aucune mesure connue.
    }
    return null;
};

const writeStoredBandwidth = (entry: StoredBandwidth): void => {
    try {
        globalThis.localStorage?.setItem(BANDWIDTH_STORAGE_KEY, JSON.stringify(entry));
    } catch {
        // Quota dépassé ou navigation privée : la mesure sera refaite à la prochaine lecture.
    }
};

/**
 * Télécharge au plus BANDWIDTH_MEASURE_BYTES en BANDWIDTH_MEASURE_MS (flux lu morceau par morceau, puis annulé).
 * Renvoie le débit en kbps, ou null si trop peu d'octets ont été reçus ou si le téléchargement a échoué.
 */
const measureDownloadKbps = async (): Promise<number | null> => {
    if (typeof fetch !== 'function') return null;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), BANDWIDTH_MEASURE_MS);
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let received = 0;
    const startedAt = now();
    try {
        const response = await fetch(BANDWIDTH_MEASURE_URL, { cache: 'no-store', signal: controller?.signal });
        if (!response.ok || !response.body) return null;
        reader = response.body.getReader();
        while (received < BANDWIDTH_MEASURE_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value?.byteLength ?? 0;
        }
    } catch {
        // Délai dépassé ou réseau coupé : on garde ce qui a été reçu avant.
    } finally {
        clearTimeout(timer);
        await reader?.cancel().catch(() => undefined);
        controller?.abort();
    }
    const elapsedSeconds = (now() - startedAt) / 1000;
    const bytes = Math.min(received, BANDWIDTH_MEASURE_BYTES);
    if (bytes < BANDWIDTH_MIN_MEASURE_BYTES || elapsedSeconds <= 0) return null;
    return (bytes * 8) / 1000 / elapsedSeconds;
};

const measureAndStore = async (): Promise<number | null> => {
    const kbps = await measureDownloadKbps();
    if (kbps !== null) writeStoredBandwidth({ kbps, expiresAt: Date.now() + BANDWIDTH_STORED_TTL_MS });
    return kbps;
};

/**
 * « Tester ma connexion » : mesure maintenant, quel que soit le réglage, et garde le résultat 24 h.
 * Renvoie le débit en kbps, ou null si la mesure a échoué.
 */
export const testBandwidthKbps = (): Promise<number | null> => measureAndStore();

/**
 * Débit retenu pour le choix de la source : réglage fixe (Mb/s), sinon dernière mesure valable (24 h), sinon une
 * nouvelle mesure. Renvoie null si rien n'est connu : aucun filtre de débit n'est alors appliqué.
 */
export const measureBandwidthKbps = async (): Promise<number | null> => {
    const plan = planBandwidth(getBandwidthSetting(), readStoredBandwidth(), Date.now());
    if (plan.kind === 'manual' || plan.kind === 'stored') return plan.kbps;
    return measureAndStore();
};

/**
 * Appelé à chaque blocage de lecture (événement « buffering » du lecteur). Au-delà du seuil, la mesure stockée
 * baisse de 30 % : le choix de source devient plus prudent. Sans mesure stockée, rien à faire.
 */
let stallEvents: number[] = [];
export const reportBufferingStall = (at: number = Date.now()): void => {
    const result = registerStallEvent(stallEvents, at);
    stallEvents = result.events;
    if (!result.lower) return;
    const stored = readStoredBandwidth();
    if (stored) writeStoredBandwidth({ kbps: stored.kbps * BANDWIDTH_STALL_PENALTY, expiresAt: stored.expiresAt });
};

/**
 * Choisit la source de lecture automatique : meilleur score parmi les streams scorés dont le débit estimé
 * tient dans 80 % de `bwKbps` (estBitrateKbps absent : accepté ; bwKbps null : pas de filtre de débit).
 * Une VF qui tient le débit est préférée, même en qualité inférieure. Sinon : repli VO, avec la raison
 * « no-vf » si aucune source de toute la liste n'est en VF, « vf-too-heavy » si une VF existe mais dépasse le débit.
 * Renvoie null si aucune source ne tient le débit (le drawer doit alors s'ouvrir).
 */
export const pickAutoplay = <T extends object>(
    streams: readonly T[],
    bwKbps: number | null,
    preferredLang: LastStreamLang = 'fr',
): AutoplayPick<T> | null => {
    const budgetKbps = bwKbps === null || !Number.isFinite(bwKbps)
        ? Infinity
        : Math.max(0, bwKbps) * BANDWIDTH_HEADROOM;

    const scored: { stream: T; info: LastStreamInfo }[] = [];
    sortStreams(streams).forEach((stream) => {
        const info = getLaststream(stream);
        if (info) scored.push({ stream, info });
    });
    const fitting = scored.filter(({ info }) => info.estBitrateKbps === null || info.estBitrateKbps <= budgetKbps);
    if (fitting.length === 0) return null;

    const preferred = fitting.find(({ info }) => matchesLanguage(info, preferredLang));
    if (preferred) return { stream: preferred.stream, languageFallback: false };

    const anyPreferredInFullList = scored.some(({ info }) => matchesLanguage(info, preferredLang));
    return {
        stream: fitting[0].stream,
        languageFallback: true,
        fallbackReason: anyPreferredInFullList ? 'vf-too-heavy' : 'no-vf',
    };
};
