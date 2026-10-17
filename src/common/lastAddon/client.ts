// Copyright (C) 2017-2026 Smart code 203358507

import { ltUrl, type QueryValue } from './config';
import { cachedRequest, requestJson } from './transport';
import type {
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
const getCached = <T>(url: string): Promise<T> => cachedRequest(url, () => requestJson<T>(url));

const postCached = <T>(url: string, body: unknown): Promise<T> => cachedRequest(
    `POST ${url} ${JSON.stringify(body)}`,
    () => requestJson<T>(url, { method: 'POST', body }),
);

/** Passthrough TMDB : `path` est le chemin TMDB sans /3 (ex. `movie/550`, `search/movie`). */
export const tmdb = async <T = unknown>(path: string, params?: Record<string, QueryValue>): Promise<T> =>
    getCached<T>(ltUrl(`tmdb/${path}`, params));

/** Notes MDBList. */
export const mdblist = async (type: MdblistType, id: string | number): Promise<MdblistResponse> =>
    getCached<MdblistResponse>(ltUrl(`mdblist/${type}/${id}`));

/** Saisons et statut d'une série (TVDB). */
export const tvdbSeries = async (id: string | number): Promise<TvdbSeriesResponse> =>
    getCached<TvdbSeriesResponse>(ltUrl(`tvdb/series/${id}`));

/** Recommandations IA à partir de l'historique et des titres aimés. */
export const recommend = async (request: RecommendRequest): Promise<RecommendResponse> =>
    postCached<RecommendResponse>(ltUrl('recommend'), request);

/** « Pourquoi tu vas aimer » : texte court en français pour un titre. */
export const why = async (request: WhyRequest): Promise<TextResponse> =>
    postCached<TextResponse>(ltUrl('why'), request);

/** « Pourquoi cette personne » : texte court à partir du nom et des titres connus. */
export const personWhy = async (request: PersonWhyRequest): Promise<TextResponse> =>
    postCached<TextResponse>(ltUrl('person-why'), request);

/** Chaînes TV (catalogue et playlists importées). */
export const tvChannels = async (): Promise<TvChannel[]> =>
    getCached<TvChannel[]>(ltUrl('tv/channels'));

/** Programme des chaînes `ids` entre `from` et `to` (secondes epoch). */
export const tvEpg = async (ids: string[], from: number, to: number): Promise<TvEpgProgram[]> =>
    getCached<TvEpgProgram[]>(ltUrl('tv/epg', { ids: ids.join(','), from, to }));

/** Importe une playlist M3U ou un compte Xtream. Non mis en cache. */
export const tvImport = async (body: TvImportRequest): Promise<TvImportResponse> =>
    requestJson<TvImportResponse>(ltUrl('tv/import'), { method: 'POST', body });

/** URL de proxy HLS pour un flux `u`. Ne fait aucune requête réseau. */
export const hlsUrl = (u: string): string => ltUrl('tv/hls', { u });

/** Retrouve un film ou une série TMDB à partir d'un identifiant IMDb (`tt...`). Null si aucun résultat. */
export const findByExternalId = async (imdbId: string): Promise<TmdbFindResult | null> => {
    const found = await tmdb<TmdbFindResponse>(`find/${imdbId}`, { external_source: 'imdb_id' });
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
