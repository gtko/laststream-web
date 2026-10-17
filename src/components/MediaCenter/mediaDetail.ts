// Copyright (C) 2017-2026 Smart code 203358507

import { findByExternalId, imdbFromTmdb, mdblist, tmdb } from 'stremio/common/lastAddon';
import getMetaDetailsHref from 'stremio/common/getMetaDetailsHref';
import { addDays, dayDiff, tmdbImage, todayIso } from './format';
import type { MediaDetail, MediaItem, MediaType } from './types';

export type TmdbRaw = {
    id: number,
    media_type?: string,
    title?: string,
    name?: string,
    original_title?: string,
    original_name?: string,
    poster_path?: string | null,
    backdrop_path?: string | null,
    overview?: string | null,
    release_date?: string,
    first_air_date?: string,
    vote_average?: number,
    genre_ids?: number[],
    reason_fr?: string,
};

type TmdbVideo = { key?: string, site?: string, type?: string, iso_639_1?: string | null, official?: boolean };
type TmdbLogo = { file_path: string, iso_639_1?: string | null, vote_average?: number };
type TmdbProvider = { provider_name: string, logo_path?: string | null, display_priority?: number };

type TmdbDetailRaw = TmdbRaw & {
    runtime?: number | null,
    episode_run_time?: number[],
    number_of_seasons?: number,
    imdb_id?: string | null,
    genres?: { name: string }[],
    images?: { logos?: TmdbLogo[] },
    videos?: { results?: TmdbVideo[] },
    external_ids?: { imdb_id?: string | null },
    release_dates?: { results?: { iso_3166_1: string, release_dates: { certification?: string }[] }[] },
    content_ratings?: { results?: { iso_3166_1: string, rating?: string }[] },
    'watch/providers'?: { results?: Record<string, { flatrate?: TmdbProvider[] } | undefined> },
};

// Élément venu du cœur Stremio (bibliothèque, reprise) : `_id` est l’identifiant IMDb pour les titres du catalogue.
export type CoreMediaItem = {
    _id: string,
    name: string,
    type: string,
    poster?: string | null,
    progress?: number | null,
    state?: { lastWatched?: string | null } | null,
    deepLinks?: { metaDetailsVideos?: string | null, metaDetailsStreams?: string | null } | null,
};

const detailCache = new Map<string, Promise<MediaDetail | null>>();
const imdbCache = new Map<string, string>();

export const mapTmdbItem = (raw: TmdbRaw, forcedType?: 'movie' | 'tv'): MediaItem => {
    const type: 'movie' | 'tv' = (raw.media_type ?? forcedType ?? (raw.title !== undefined ? 'movie' : 'tv')) === 'tv' ? 'tv' : 'movie';
    const date = raw.release_date || raw.first_air_date || '';
    const days = date ? dayDiff(date) : NaN;
    return {
        key: `${type}:${raw.id}`,
        type,
        name: raw.title || raw.name || raw.original_title || raw.original_name || '',
        tmdbId: raw.id,
        year: date.slice(0, 4),
        poster: tmdbImage('w342', raw.poster_path),
        backdrop: tmdbImage('w780', raw.backdrop_path),
        vote: raw.vote_average && raw.vote_average > 0 ? raw.vote_average : null,
        caption: raw.reason_fr || null,
        badge: days <= 0 && days > -14 ? 'new' : null,
    };
};

export const mapCoreItem = (raw: CoreMediaItem): MediaItem => ({
    key: `${raw.type}:${raw._id}`,
    type: raw.type === 'series' ? 'tv' : 'movie',
    name: raw.name,
    imdbId: raw._id.startsWith('tt') ? raw._id : null,
    href: getMetaDetailsHref(raw.deepLinks, true),
    poster: raw.poster || null,
    progress: typeof raw.progress === 'number' ? raw.progress : null,
    lastWatched: typeof raw.state?.lastWatched === 'string' ? Date.parse(raw.state.lastWatched) || null : null,
});

export const metaDetailsHref = (type: MediaType, imdbId: string): string => (
    `#/metadetails/${type === 'tv' ? 'series' : 'movie'}/${imdbId}`
);

const pickLogo = (logos: TmdbLogo[] | undefined): string | null => {
    if (!logos || logos.length === 0) return null;
    const rank = (logo: TmdbLogo): number => (logo.iso_639_1 === 'fr' ? 0 : logo.iso_639_1 === 'en' ? 1 : logo.iso_639_1 === null ? 2 : 3);
    const png = logos.filter((logo) => !/\.svg$/i.test(logo.file_path));
    const pool = (png.length > 0 ? png : logos).slice().sort((a, b) => rank(a) - rank(b) || (b.vote_average ?? 0) - (a.vote_average ?? 0));
    return tmdbImage('w500', pool[0].file_path);
};

const pickTrailer = (videos: TmdbVideo[] | undefined): string | null => {
    const youtube = (videos ?? []).filter((video) => video.site === 'YouTube' && video.key);
    const trailers = youtube.filter((video) => video.type === 'Trailer');
    const pool = (trailers.length > 0 ? trailers : youtube.filter((video) => video.type === 'Teaser')).slice();
    const score = (video: TmdbVideo): number => (video.iso_639_1 === 'fr' ? 0 : video.iso_639_1 === 'en' ? 1 : 2) + (video.official ? -0.5 : 0);
    pool.sort((a, b) => score(a) - score(b));
    return pool[0]?.key ?? null;
};

const frCertification = (raw: TmdbDetailRaw, type: 'movie' | 'tv'): string => {
    if (type === 'movie') {
        const entry = raw.release_dates?.results?.find((result) => result.iso_3166_1 === 'FR');
        return entry?.release_dates.map((release) => release.certification).find(Boolean) ?? '';
    }
    const entry = raw.content_ratings?.results?.find((result) => result.iso_3166_1 === 'FR');
    return entry?.rating ?? '';
};

const frProviders = (raw: TmdbDetailRaw): MediaDetail['providers'] => (
    (raw['watch/providers']?.results?.FR?.flatrate ?? [])
        .filter((provider) => provider.logo_path)
        .sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
        .slice(0, 3)
        .map((provider) => ({ name: provider.provider_name, logo: tmdbImage('w92', provider.logo_path) ?? '' }))
);

const resolveTmdbId = async (item: MediaItem, signal?: AbortSignal): Promise<number | null> => {
    if (typeof item.tmdbId === 'number') return item.tmdbId;
    if (!item.imdbId) return null;
    const found = await findByExternalId(item.imdbId, signal);
    return found?.tmdbId ?? null;
};

const loadDetail = async (item: MediaItem, signal?: AbortSignal): Promise<MediaDetail | null> => {
    const tmdbId = await resolveTmdbId(item, signal);
    if (tmdbId === null) return null;
    const type: 'movie' | 'tv' = item.type === 'tv' ? 'tv' : 'movie';
    const append = type === 'tv'
        ? 'videos,images,external_ids,content_ratings,watch/providers'
        : 'videos,images,external_ids,release_dates,watch/providers';
    const raw = await tmdb<TmdbDetailRaw>(`${type}/${tmdbId}`, {
        append_to_response: append,
        include_image_language: 'fr,en,null',
    }, signal);
    let overview = raw.overview || '';
    if (!overview) {
        overview = await tmdb<{ overview?: string | null }>(`${type}/${tmdbId}`, { language: 'en-US' })
            .then((json) => json.overview ?? '', () => '');
    }
    const imdbId = raw.imdb_id || raw.external_ids?.imdb_id || null;
    if (imdbId) imdbCache.set(item.key, imdbId);
    const ratings = await mdblist(type, imdbId || tmdbId, signal).then((json) => json.ratings, () => null);
    return {
        tmdbId,
        imdbId,
        name: raw.title || raw.name || item.name,
        overview,
        logo: pickLogo(raw.images?.logos),
        backdrop: tmdbImage('w1280', raw.backdrop_path),
        trailer: pickTrailer(raw.videos?.results),
        genres: (raw.genres ?? []).map((genre) => genre.name),
        minutes: type === 'movie' ? Number(raw.runtime) || 0 : Number(raw.episode_run_time?.[0]) || 0,
        seasons: raw.number_of_seasons || 0,
        cert: frCertification(raw, type),
        tmdbVote: raw.vote_average && raw.vote_average > 0 ? raw.vote_average : null,
        ratings,
        providers: frProviders(raw),
    };
};

/**
 * Détail d’un titre (bande-annonce, logo, notes, fournisseurs). Mis en cache par `key`.
 * Requiert LastAddon configuré : sans configuration, renvoie null et le cache est vidé pour réessayer plus tard.
 * `signal` annule le chargement (aperçu quitté) : le résultat est alors null et rien n’est mis en cache.
 */
export const getMediaDetail = (item: MediaItem, signal?: AbortSignal): Promise<MediaDetail | null> => {
    if (item.type === 'channel') return Promise.resolve(null);
    const cached = detailCache.get(item.key);
    if (cached) return cached;
    const request = loadDetail(item, signal)
        .catch(() => null)
        .then((detail) => {
            if (detail === null) detailCache.delete(item.key);
            return detail;
        });
    detailCache.set(item.key, request);
    return request;
};

export const resolveImdbId = async (item: MediaItem): Promise<string | null> => {
    if (item.imdbId) return item.imdbId;
    const cached = imdbCache.get(item.key);
    if (cached) return cached;
    if (typeof item.tmdbId !== 'number' || item.type === 'channel') return null;
    const imdbId = await imdbFromTmdb(item.type, item.tmdbId).catch(() => null);
    if (imdbId) imdbCache.set(item.key, imdbId);
    return imdbId;
};

/** Lien « Plus d’infos » : href connu, sinon résolu via l’identifiant IMDb. Null si introuvable. */
export const openMediaItem = async (item: MediaItem): Promise<string | null> => {
    if (item.href) return item.href;
    if (item.type === 'channel') return null;
    const imdbId = await resolveImdbId(item);
    return imdbId ? metaDetailsHref(item.type, imdbId) : null;
};

export const tomorrowIso = (): string => addDays(todayIso(), 1);
