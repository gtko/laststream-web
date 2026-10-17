// Copyright (C) 2017-2026 Smart code 203358507

import { imdbFromTmdb, tmdb } from 'stremio/common/lastAddon';
import type { QueryValue } from 'stremio/common/lastAddon';

export type ServiceDef = {
    slug: string,
    label: string,
    match: RegExp,
    canonical?: RegExp,
    color: string,
    outline?: boolean,
};

export type StreamingService = {
    slug: string,
    name: string,
    color: string,
    outline: boolean,
    ids: number[],
    logo: string | null,
};

export type CatalogType = 'movie' | 'tv';

export type CatalogRowDef = {
    key: string,
    defaultValue: string,
    params: Record<string, QueryValue>,
};

export type CatalogItem = {
    type: CatalogType,
    tmdbId: number,
    name: string,
    poster: string | null,
    date: string,
};

type ProviderResponse = {
    results?: { provider_id: number, provider_name: string, logo_path?: string | null, display_priority?: number }[],
};

type DiscoverResponse = {
    results?: {
        id: number,
        title?: string,
        name?: string,
        poster_path?: string | null,
        release_date?: string,
        first_air_date?: string,
    }[],
};

// Même découpage que le prototype (prototype-home) : nom du fournisseur TMDB -> service.
export const SERVICE_DEFS: ServiceDef[] = [
    { slug: 'netflix', label: 'Netflix', match: /^netflix/, color: '#E50914', canonical: /^netflix$/ },
    { slug: 'prime-video', label: 'Prime Video', match: /^(amazon )?prime video/, color: '#00A8E1', canonical: /^amazon prime video$/ },
    { slug: 'disney-plus', label: 'Disney+', match: /^disney/, color: '#113CCF', canonical: /^disney plus$/ },
    { slug: 'canal-plus', label: 'Canal+', match: /^canal\+/, color: '#000000', outline: true, canonical: /^canal\+$/ },
    { slug: 'apple-tv-plus', label: 'Apple TV+', match: /^apple tv/, color: '#1D1D1F', canonical: /^apple tv(\+| plus)$/ },
    { slug: 'max', label: 'Max', match: /^(hbo )?max\b/, color: '#002BE7', canonical: /^(max|hbo max)$/ },
    { slug: 'paramount-plus', label: 'Paramount+', match: /^paramount/, color: '#0064FF', canonical: /^paramount(\+| plus)$/ },
    { slug: 'crunchyroll', label: 'Crunchyroll', match: /^crunchyroll/, color: '#F47521', canonical: /^crunchyroll$/ },
    { slug: 'ocs', label: 'OCS', match: /^ocs/, color: '#17151f' },
    { slug: 'adn', label: 'ADN', match: /^(adn|animation digital)/, color: '#17151f' },
    { slug: 'france-tv', label: 'France TV', match: /^france[ .]?tv/, color: '#17151f' },
    { slug: 'arte', label: 'Arte', match: /^arte/, color: '#17151f' },
    { slug: 'mubi', label: 'MUBI', match: /^mubi/, color: '#17151f' },
    { slug: 'pluto-tv', label: 'Pluto TV', match: /^pluto/, color: '#17151f' },
    { slug: 'molotov', label: 'Molotov', match: /^molotov/, color: '#17151f' },
];

export const tmdbImage = (size: string, path?: string | null): string | null =>
    path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

export const loadServices = async (): Promise<StreamingService[]> => {
    const responses = await Promise.allSettled([
        tmdb<ProviderResponse>('watch/providers/movie', { watch_region: 'FR' }),
        tmdb<ProviderResponse>('watch/providers/tv', { watch_region: 'FR' }),
    ]);

    const providers = new Map<number, NonNullable<ProviderResponse['results']>[number]>();
    responses.forEach((response) => {
        if (response.status !== 'fulfilled') return;
        (response.value.results ?? []).forEach((provider) => {
            if (!providers.has(provider.provider_id)) providers.set(provider.provider_id, provider);
        });
    });
    if (providers.size === 0) throw new Error('streaming services unavailable');

    const all = Array.from(providers.values());
    const services: StreamingService[] = [];
    SERVICE_DEFS.forEach((def) => {
        const found = all
            .filter((provider) => def.match.test(provider.provider_name.toLowerCase()))
            .sort((a, b) => (a.display_priority || 999) - (b.display_priority || 999));
        if (found.length === 0) return;

        const withLogo = found.filter((provider) => provider.logo_path);
        const logoProvider = (def.canonical && withLogo.find((provider) => def.canonical!.test(provider.provider_name.toLowerCase())))
            || withLogo.slice().sort((a, b) => a.provider_name.length - b.provider_name.length)[0];

        services.push({
            slug: def.slug,
            name: def.label,
            color: def.color,
            outline: !!def.outline,
            ids: found.map((provider) => provider.provider_id),
            logo: tmdbImage('w154', logoProvider?.logo_path),
        });
    });
    return services;
};

const GENRE_ROWS: [key: string, defaultValue: string, movie: number, tv: number | string | null][] = [
    ['SERVICE_GENRE_ACTION', 'Action', 28, 10759],
    ['SERVICE_GENRE_COMEDY', 'Comédie', 35, 35],
    ['SERVICE_GENRE_DRAMA', 'Drame', 18, 18],
    ['SERVICE_GENRE_SCIFI', 'Science-fiction', 878, 10765],
    ['SERVICE_GENRE_THRILLER', 'Thriller', 53, '80|9648'],
    ['SERVICE_GENRE_ANIMATION', 'Animation', 16, 16],
    ['SERVICE_GENRE_DOCUMENTARY', 'Documentaire', 99, 99],
    ['SERVICE_GENRE_FAMILY', 'Famille', 10751, 10751],
    ['SERVICE_GENRE_HORROR', 'Horreur', 27, null],
    ['SERVICE_GENRE_ROMANCE', 'Romance', 10749, null],
];

export const catalogRows = (type: CatalogType): CatalogRowDef[] => {
    const isTv = type === 'tv';
    const dateKey = isTv ? 'first_air_date' : 'primary_release_date';
    const today = new Date().toISOString().slice(0, 10);
    const rows: CatalogRowDef[] = [
        { key: 'SERVICE_ROW_TOP', defaultValue: 'Top du moment', params: { sort_by: 'popularity.desc' } },
        { key: 'SERVICE_ROW_NEW', defaultValue: 'Nouveautés', params: { sort_by: `${dateKey}.desc`, [`${dateKey}.lte`]: today } },
        { key: 'SERVICE_ROW_RATED', defaultValue: 'Les mieux notés', params: { sort_by: 'vote_average.desc', 'vote_count.gte': '300' } },
    ];
    GENRE_ROWS.forEach(([key, defaultValue, movieGenre, tvGenre]) => {
        const genre = isTv ? tvGenre : movieGenre;
        if (genre === null) return;
        rows.push({ key, defaultValue, params: { sort_by: 'popularity.desc', with_genres: String(genre) } });
    });
    return rows;
};

export const loadCatalogRow = async (
    providerIds: number[],
    type: CatalogType,
    row: CatalogRowDef,
): Promise<CatalogItem[]> => {
    const response = await tmdb<DiscoverResponse>(`discover/${type}`, {
        watch_region: 'FR',
        with_watch_providers: providerIds.join('|'),
        with_watch_monetization_types: 'flatrate|free|ads',
        'vote_count.gte': type === 'tv' ? '35' : '50',
        include_adult: 'false',
        ...row.params,
    });

    return (response.results ?? [])
        .filter((item) => item.poster_path)
        .map((item) => ({
            type,
            tmdbId: item.id,
            name: item.title ?? item.name ?? '',
            poster: tmdbImage('w342', item.poster_path),
            date: item.release_date || item.first_air_date || '',
        }));
};

/** Chemin de la fiche Stremio d'un titre TMDB (résolution IMDb à la demande). */
export const metaDetailsPath = async (type: CatalogType, tmdbId: number): Promise<string | null> => {
    const imdbId = await imdbFromTmdb(type, tmdbId);
    if (!imdbId) return null;
    return `/metadetails/${type === 'tv' ? 'series' : 'movie'}/${encodeURIComponent(imdbId)}`;
};
