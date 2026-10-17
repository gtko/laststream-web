// Copyright (C) 2017-2026 Smart code 203358507

import { DEV_PROTOTYPE_MODE, ltUrl, type QueryValue } from './config';
import { cachedRequest, requestJson } from './transport';
import type {
    AiTextContract,
    MdblistResponse,
    MdblistType,
    PersonWhyRequest,
    RecommendRequest,
    RecommendResponse,
    TextResponse,
    TmdbExternalIds,
    TmdbFindResponse,
    TmdbFindResult,
    TvChannel,
    TvEpgProgram,
    TvImportRequest,
    TvImportResponse,
    TvdbSeriesResponse,
    WhyRequest,
} from './types';

// Les GET sont mis en cache (TTL par défaut, voir transport.ts). Les POST d'IA le sont aussi, indexés par corps.
// Les imports de playlist ne le sont pas : ce sont des mutations.
const getCached = <T>(url: string, signal?: AbortSignal): Promise<T> => cachedRequest(url, () => requestJson<T>(url, { signal }));

const postCached = <T>(url: string, body: unknown): Promise<T> => cachedRequest(
    `POST ${url} ${JSON.stringify(body)}`,
    () => requestJson<T>(url, { method: 'POST', body }),
);

// Paramètres TMDB acceptés par le passthrough du serveur (liste blanche de lastaddon, src/lt/providers.ts).
const TMDB_PUBLIC_PARAMS: ReadonlySet<string> = new Set([
    'language',
    'region',
    'page',
    'query',
    'sort_by',
    'with_genres',
    'with_watch_providers',
    'watch_region',
    'with_watch_monetization_types',
    'append_to_response',
    'include_image_language',
    'primary_release_date.gte',
    'primary_release_date.lte',
    'first_air_date.gte',
    'first_air_date.lte',
    'air_date.gte',
    'air_date.lte',
    'vote_count.gte',
    'with_original_language',
    'include_adult',
]);

const warnedParams = new Set<string>();

/**
 * Ne garde que les paramètres TMDB de la liste blanche : le serveur ignore les autres. En dev, avertit une fois
 * par paramètre écarté, pour repérer un appel à corriger.
 */
export const sanitizeTmdbParams = (params: Record<string, QueryValue> = {}): Record<string, QueryValue> => {
    const kept: Record<string, QueryValue> = {};
    Object.entries(params).forEach(([key, value]) => {
        if (TMDB_PUBLIC_PARAMS.has(key)) {
            kept[key] = value;
        } else if (process.env.NODE_ENV !== 'production' && !warnedParams.has(key)) {
            warnedParams.add(key);
            console.warn(`[lastAddon] paramètre TMDB écarté (absent de la liste blanche) : ${key}`);
        }
    });
    return kept;
};

/** Passthrough TMDB : `path` est le chemin TMDB sans /3 (ex. `movie/550`, `search/movie`). */
export const tmdb = async <T = unknown>(path: string, params?: Record<string, QueryValue>, signal?: AbortSignal): Promise<T> =>
    getCached<T>(ltUrl(`tmdb/${path}`, sanitizeTmdbParams(params)), signal);

/** Notes MDBList. */
export const mdblist = async (type: MdblistType, id: string | number, signal?: AbortSignal): Promise<MdblistResponse> =>
    getCached<MdblistResponse>(ltUrl(`mdblist/${type}/${id}`), signal);

/** Saisons et statut d'une série (TVDB). */
export const tvdbSeries = async (id: string | number): Promise<TvdbSeriesResponse> =>
    getCached<TvdbSeriesResponse>(ltUrl(`tvdb/series/${id}`));

/** Recommandations IA à partir de l'historique et des titres aimés. */
export const recommend = async (request: RecommendRequest): Promise<RecommendResponse> =>
    postCached<RecommendResponse>(ltUrl('recommend'), request);

/**
 * Code court de langue (`fr`) pour les textes IA : langue d'interface du compte, sinon celle du navigateur.
 * Repli `fr`, défaut du serveur.
 */
export const aiLanguage = (interfaceLanguage?: string | null): string => {
    const short = [interfaceLanguage, globalThis.navigator?.language]
        .map((value) => value?.split('-')[0].toLowerCase() ?? '')
        .find((code) => /^[a-z]{2}$/.test(code));
    return short ?? 'fr';
};

// Corps des textes IA : {type, tmdbId, language} seulement. Les champs `legacy` ne partent qu'en DEV_PROTOTYPE_MODE.
const aiTextBody = (contract: AiTextContract, legacy?: object): unknown => (
    DEV_PROTOTYPE_MODE && legacy !== undefined ? { ...contract, ...legacy } : contract
);

/** « Pourquoi tu vas aimer » : texte court en français pour un titre TMDB (identifiant seul). */
export const why = async ({ legacy, ...contract }: WhyRequest): Promise<TextResponse> =>
    postCached<TextResponse>(ltUrl('why'), aiTextBody(contract, legacy));

/** « Pourquoi cette personne » : texte court pour une personne TMDB (identifiant seul). */
export const personWhy = async ({ legacy, ...contract }: PersonWhyRequest): Promise<TextResponse> =>
    postCached<TextResponse>(ltUrl('person-why'), aiTextBody(contract, legacy));

/** Chaînes TV (catalogue et playlists importées). */
export const tvChannels = async (): Promise<TvChannel[]> =>
    getCached<TvChannel[]>(ltUrl('tv/channels'));

/** Programme des chaînes `ids` entre `from` et `to` (secondes epoch). */
export const tvEpg = async (ids: string[], from: number, to: number): Promise<TvEpgProgram[]> =>
    getCached<TvEpgProgram[]>(ltUrl('tv/epg', { ids: ids.join(','), from, to }));

/** Importe une playlist M3U ou un compte Xtream. Non mis en cache. */
export const tvImport = async (body: TvImportRequest): Promise<TvImportResponse> =>
    requestJson<TvImportResponse>(ltUrl('tv/import'), { method: 'POST', body });

/**
 * URL de proxy HLS d'un flux `u`, signée par `sig` (champ `sig` du canal). Null sans signature : le serveur répond 403
 * à une URL non signée, on n'en construit donc jamais. Ne fait aucune requête réseau.
 */
export const hlsUrl = (u: string, sig: string | null | undefined): string | null => (
    sig ? ltUrl('tv/hls', { u, s: sig }) : null
);

/** Retrouve un film ou une série TMDB à partir d'un identifiant IMDb (`tt...`). Null si aucun résultat. */
export const findByExternalId = async (imdbId: string, signal?: AbortSignal): Promise<TmdbFindResult | null> => {
    const found = await tmdb<TmdbFindResponse>(`find/${imdbId}`, { external_source: 'imdb_id' }, signal);
    const movie = found.movie_results?.[0];
    if (movie) return { type: 'movie', tmdbId: movie.id };
    const show = found.tv_results?.[0];
    if (show) return { type: 'tv', tmdbId: show.id };
    return null;
};

/** Identifiant IMDb d'un film ou d'une série TMDB (external_ids). Null si inconnu. */
export const imdbFromTmdb = async (type: 'movie' | 'tv', id: string | number): Promise<string | null> => {
    const ids = await tmdb<TmdbExternalIds>(`${type}/${id}/external_ids`);
    return ids.imdb_id || null;
};
