// Copyright (C) 2017-2026 Smart code 203358507

import { displayName, tmdbImage } from './format';
import type {
    FicheCollection,
    FicheExtra,
    FicheProviderGroup,
    FicheProviders,
    FicheTmdb,
    FicheTmdbCrew,
    FicheTmdbPerson,
    FicheTmdbPoster,
    ProviderKey,
    TmdbKind,
} from './types';

type TmdbImage = { file_path: string; iso_639_1: string | null; vote_average?: number };
type TmdbVideo = { key: string; name?: string; site: string; type: string; iso_639_1?: string | null; official?: boolean };
type TmdbCast = { id: number; name: string; character?: string; profile_path?: string | null };
type TmdbCrew = { id: number; name: string; job?: string };
type TmdbResult = { id: number; title?: string; name?: string; poster_path?: string | null; release_date?: string; first_air_date?: string };
type TmdbReleaseDate = { release_date?: string; type?: number; certification?: string };
type TmdbProvider = { provider_name: string; logo_path?: string | null; display_priority?: number };

export type TmdbDetails = {
    overview?: string;
    tagline?: string;
    status?: string;
    original_title?: string;
    original_name?: string;
    release_date?: string;
    first_air_date?: string;
    last_air_date?: string;
    runtime?: number;
    episode_run_time?: number[];
    last_episode_to_air?: { runtime?: number | null } | null;
    number_of_seasons?: number;
    number_of_episodes?: number;
    backdrop_path?: string | null;
    vote_average?: number;
    genres?: { name: string }[];
    original_language?: string;
    spoken_languages?: { iso_639_1: string }[];
    origin_country?: string[];
    production_countries?: { iso_3166_1: string }[];
    production_companies?: { name: string }[];
    networks?: { name: string }[];
    budget?: number;
    revenue?: number;
    created_by?: { id: number; name: string }[];
    belongs_to_collection?: { id: number; name: string } | null;
    images?: { logos?: TmdbImage[] };
    videos?: { results?: TmdbVideo[] };
    credits?: { cast?: TmdbCast[]; crew?: TmdbCrew[] };
    release_dates?: { results?: { iso_3166_1: string; release_dates?: TmdbReleaseDate[] }[] };
    content_ratings?: { results?: { iso_3166_1: string; rating?: string }[] };
    recommendations?: { results?: TmdbResult[] };
    similar?: { results?: TmdbResult[] };
};

export type TmdbCollection = { name?: string; parts?: TmdbResult[] };

export type TmdbWatchProviders = {
    results?: Record<string, {
        link?: string;
        flatrate?: TmdbProvider[];
        free?: TmdbProvider[];
        ads?: TmdbProvider[];
        rent?: TmdbProvider[];
        buy?: TmdbProvider[];
    }>;
};

const EXTRA_ORDER = new Map<string, number>([
    ['Trailer', 0],
    ['Teaser', 1],
    ['Featurette', 2],
    ['Behind the Scenes', 3],
    ['Clip', 4],
    ['Bloopers', 5],
    ['Opening Credits', 6],
]);

const PROVIDER_LIMITS: [ProviderKey, number][] = [['flatrate', 6], ['free', 4], ['rent', 4], ['buy', 4]];

const pickLogo = (logos: TmdbImage[] = []): string => {
    const rank = (logo: TmdbImage): number => {
        if (logo.iso_639_1 === 'fr') return 0;
        if (logo.iso_639_1 === 'en') return 1;
        return logo.iso_639_1 === null ? 2 : 3;
    };
    const svgFree = logos.filter((logo) => !/\.svg$/i.test(logo.file_path));
    const pool = (svgFree.length > 0 ? svgFree : logos)
        .slice()
        .sort((a, b) => rank(a) - rank(b) || (b.vote_average ?? 0) - (a.vote_average ?? 0));
    return pool.length > 0 ? tmdbImage('w500', pool[0].file_path) : '';
};

const pickTrailer = (videos: TmdbVideo[] = []): string => {
    const youtube = videos.filter((video) => video.site === 'YouTube' && video.key !== '');
    const trailers = youtube.filter((video) => video.type === 'Trailer');
    const pool = (trailers.length > 0 ? trailers : youtube.filter((video) => video.type === 'Teaser')).slice();
    const score = (video: TmdbVideo): number => (
        (video.iso_639_1 === 'fr' ? 0 : video.iso_639_1 === 'en' ? 1 : 2) + (video.official ? -0.5 : 0)
    );
    pool.sort((a, b) => score(a) - score(b));
    return pool.length > 0 ? pool[0].key : '';
};

const buildExtras = (videos: TmdbVideo[] = []): FicheExtra[] => videos
    .filter((video) => video.site === 'YouTube' && video.key !== '' && EXTRA_ORDER.has(video.type))
    .sort((a, b) => (
        (EXTRA_ORDER.get(a.type) ?? 0) - (EXTRA_ORDER.get(b.type) ?? 0) ||
        (a.iso_639_1 === 'fr' ? 0 : 1) - (b.iso_639_1 === 'fr' ? 0 : 1)
    ))
    .slice(0, 14)
    .map((video) => ({ key: video.key, type: video.type, name: video.name ?? '' }));

const frReleaseDate = (raw: TmdbDetails): string => {
    const fr = raw.release_dates?.results?.find((entry) => entry.iso_3166_1 === 'FR');
    const dates = (fr?.release_dates ?? []).filter((date) => date.release_date);
    const theatrical = dates.filter((date) => date.type === 3 || date.type === 2);
    const pool = (theatrical.length > 0 ? theatrical : dates).map((date) => (date.release_date ?? '').slice(0, 10)).sort();
    return pool[0] ?? '';
};

const frCertification = (raw: TmdbDetails, kind: TmdbKind): string => {
    if (kind === 'movie') {
        const fr = raw.release_dates?.results?.find((entry) => entry.iso_3166_1 === 'FR');
        return fr?.release_dates?.map((date) => date.certification).find(Boolean) ?? '';
    }
    return raw.content_ratings?.results?.find((entry) => entry.iso_3166_1 === 'FR')?.rating ?? '';
};

const uniquePeople = (list: { id: number; name: string }[], limit: number): FicheTmdbCrew[] => {
    const seen = new Set<number>();
    return list
        .filter((person) => {
            if (seen.has(person.id)) return false;
            seen.add(person.id);
            return true;
        })
        .slice(0, limit)
        .map((person) => ({ id: person.id, name: person.name }));
};

const toPoster = (kind: TmdbKind, result: TmdbResult): FicheTmdbPoster => ({
    kind,
    tmdbId: result.id,
    title: result.title ?? result.name ?? '',
    year: (result.release_date ?? result.first_air_date ?? '').slice(0, 4),
    poster: tmdbImage('w342', result.poster_path),
});

export const buildFicheTmdb = (kind: TmdbKind, raw: TmdbDetails): FicheTmdb => {
    const isTv = kind === 'tv';
    const crew = raw.credits?.crew ?? [];
    const productionCountries = raw.production_countries ?? [];
    const recommendations = raw.recommendations?.results ?? [];
    const similar = raw.similar?.results ?? [];
    const spokenCodes = Array.from(new Set([raw.original_language ?? '', ...(raw.spoken_languages ?? []).map((lang) => lang.iso_639_1)]))
        .filter((code) => code !== '');
    const studios = (isTv ? raw.networks : raw.production_companies) ?? [];
    return {
        kind,
        tagline: raw.tagline ?? '',
        overview: raw.overview ?? '',
        original: raw.original_title ?? raw.original_name ?? '',
        year: (raw.release_date ?? raw.first_air_date ?? '').slice(0, 4),
        genres: (raw.genres ?? []).map((genre) => genre.name),
        minutes: isTv
            ? Number(raw.episode_run_time?.[0]) || Number(raw.last_episode_to_air?.runtime) || 0
            : Number(raw.runtime) || 0,
        cert: frCertification(raw, kind),
        status: raw.status ?? '',
        releaseDate: isTv ? (raw.first_air_date ?? '') : (frReleaseDate(raw) || raw.release_date || ''),
        lastAir: isTv ? (raw.last_air_date ?? '') : '',
        seasonCount: raw.number_of_seasons ?? 0,
        episodeCount: raw.number_of_episodes ?? 0,
        backdrop: tmdbImage('original', raw.backdrop_path),
        logo: pickLogo(raw.images?.logos),
        trailerKey: pickTrailer(raw.videos?.results),
        vote: raw.vote_average ?? 0,
        cast: (raw.credits?.cast ?? []).slice(0, 15).map((person): FicheTmdbPerson => ({
            id: person.id,
            name: person.name,
            role: person.character ?? '',
            photo: tmdbImage('w185', person.profile_path),
        })),
        directors: isTv
            ? uniquePeople(raw.created_by ?? [], Infinity)
            : uniquePeople(crew.filter((person) => person.job === 'Director'), Infinity),
        writers: isTv
            ? []
            : uniquePeople(crew.filter((person) => ['Screenplay', 'Writer', 'Story'].includes(person.job ?? '')), 3),
        countries: productionCountries.length > 0
            ? productionCountries.map((country) => displayName('region', country.iso_3166_1))
            : (raw.origin_country ?? []).map((country) => displayName('region', country)),
        originalLanguage: raw.original_language ? displayName('language', raw.original_language) : '',
        spokenLanguages: spokenCodes.map((code) => displayName('language', code)),
        studios: studios.map((studio) => studio.name).slice(0, 5),
        budget: raw.budget ?? 0,
        revenue: raw.revenue ?? 0,
        similar: (recommendations.length > 0 ? recommendations : similar)
            .filter((result) => result.poster_path)
            .slice(0, 12)
            .map((result) => toPoster(kind, result)),
        extras: buildExtras(raw.videos?.results),
    };
};

export const buildProviders = (response: TmdbWatchProviders): FicheProviders => {
    const fr = response.results?.FR ?? {};
    const toItems = (list: TmdbProvider[] = []): { name: string; logo: string }[] => list
        .slice()
        .sort((a, b) => (a.display_priority || 99) - (b.display_priority || 99))
        .filter((provider) => provider.logo_path)
        .map((provider) => ({ name: provider.provider_name, logo: tmdbImage('w92', provider.logo_path) }));
    const sources: Record<ProviderKey, { name: string; logo: string }[]> = {
        flatrate: toItems(fr.flatrate),
        free: toItems([...(fr.free ?? []), ...(fr.ads ?? [])]),
        rent: toItems(fr.rent),
        buy: toItems(fr.buy),
    };
    const seen = new Set<string>();
    const groups: FicheProviderGroup[] = PROVIDER_LIMITS
        .map(([key, limit]) => {
            const items = sources[key].filter((item) => !seen.has(item.name)).slice(0, limit);
            items.forEach((item) => seen.add(item.name));
            return { key, items };
        })
        .filter((group) => group.items.length > 0);
    return { link: fr.link ?? '', groups };
};

export const buildCollection = (raw: TmdbCollection): FicheCollection => ({
    name: raw.name ?? '',
    parts: (raw.parts ?? [])
        .filter((part) => part.poster_path)
        .sort((a, b) => String(a.release_date || '9999').localeCompare(String(b.release_date || '9999')))
        .map((part) => toPoster('movie', part)),
});
