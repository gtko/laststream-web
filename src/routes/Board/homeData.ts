// Copyright (C) 2017-2026 Smart code 203358507

import { useEffect, useRef, useState } from 'react';
import { recommend, tmdb, tvChannels } from 'stremio/common/lastAddon';
import type { QueryValue, RecommendEntry } from 'stremio/common/lastAddon';
import {
    dayDiff,
    getMediaDetail,
    mapTmdbItem,
    tomorrowIso,
} from 'stremio/components/MediaCenter';
import type { MediaDetail, MediaItem, TmdbRaw } from 'stremio/components/MediaCenter';

export type AsyncState<T> = {
    status: 'idle' | 'loading' | 'ready' | 'error',
    data: T | null,
};

/**
 * Charge `load` quand `key` change (null = désactivé). `load` est lu à chaque rendu sans relancer la requête,
 * ce qui évite de relancer les appels à chaque rendu tant que la clé ne change pas.
 */
export const useAsyncData = <T>(key: string | null, load: () => Promise<T>): AsyncState<T> => {
    const loadRef = useRef(load);
    const [state, setState] = useState<AsyncState<T>>({ status: 'loading', data: null });
    useEffect(() => {
        loadRef.current = load;
    });
    useEffect(() => {
        if (key === null) return undefined;
        let active = true;
        setState({ status: 'loading', data: null });
        loadRef.current().then(
            (data) => {
                if (active) setState({ status: 'ready', data });
            },
            () => {
                if (active) setState({ status: 'error', data: null });
            },
        );
        return () => {
            active = false;
        };
    }, [key]);
    return key === null ? { status: 'idle', data: null } : state;
};

type TmdbList = { results?: TmdbRaw[] };

const tmdbResults = async (path: string, params?: Record<string, QueryValue>): Promise<TmdbRaw[]> => {
    const json = await tmdb<TmdbList>(path, params);
    return (json.results ?? []).filter((raw) => raw.media_type !== 'person');
};

const trendingTop10Keys = (): Promise<Set<string>> => (
    tmdbResults('trending/all/day').then((list) => new Set(list.slice(0, 10).map((raw) => mapTmdbItem(raw).key)), () => new Set<string>())
);

/** Rangée TMDB (populaires, genre). Les titres du top du jour reçoivent le badge « Top ». */
export const loadTmdbRow = async (path: string, params: Record<string, QueryValue> | undefined, forcedType: 'movie' | 'tv'): Promise<MediaItem[]> => {
    const [raw, topKeys] = await Promise.all([tmdbResults(path, params), trendingTop10Keys()]);
    return raw.slice(0, 20).map((entry): MediaItem => {
        const item = mapTmdbItem(entry, forcedType);
        return topKeys.has(item.key) ? { ...item, badge: 'top' } : item;
    });
};

export const loadTop10 = async (): Promise<MediaItem[]> => {
    const raw = await tmdbResults('trending/all/day');
    return raw.slice(0, 10).map((entry): MediaItem => ({ ...mapTmdbItem(entry), badge: 'top' }));
};

/** Sorties à venir (films et séries) : seulement les dates futures, triées par date. */
export const loadUpcoming = async (): Promise<MediaItem[]> => {
    const tomorrow = tomorrowIso();
    const [movieUpcoming, movieDiscover, tvDiscover] = await Promise.allSettled([
        tmdbResults('movie/upcoming'),
        tmdbResults('discover/movie', { 'primary_release_date.gte': tomorrow, sort_by: 'popularity.desc' }),
        tmdbResults('discover/tv', { 'first_air_date.gte': tomorrow, sort_by: 'popularity.desc' }),
    ]);
    const values = (result: PromiseSettledResult<TmdbRaw[]>): TmdbRaw[] => (result.status === 'fulfilled' ? result.value : []);
    const out = new Map<string, MediaItem>();
    const add = (raw: TmdbRaw, type: 'movie' | 'tv', date: string | undefined) => {
        if (!raw.poster_path || !date || dayDiff(date) <= 0) return;
        const item: MediaItem = { ...mapTmdbItem(raw, type), badge: 'soon', upcomingDate: date };
        if (!out.has(item.key)) out.set(item.key, item);
    };
    values(movieUpcoming).forEach((raw) => add(raw, 'movie', raw.release_date));
    values(movieDiscover).forEach((raw) => add(raw, 'movie', raw.release_date));
    values(tvDiscover).forEach((raw) => add(raw, 'tv', raw.first_air_date));
    return Array.from(out.values())
        .sort((a, b) => (a.upcomingDate ?? '').localeCompare(b.upcomingDate ?? ''))
        .slice(0, 20);
};

const toEntry = (item: MediaItem): RecommendEntry => ({
    title: item.name,
    year: item.year ? Number(item.year) : null,
    type: item.type === 'tv' ? 'tv' : 'movie',
});

/** Recommandations IA à partir de l’historique de bibliothèque. La raison (`reason_fr`) sert de légende. */
export const loadRecommend = async (history: MediaItem[]): Promise<MediaItem[]> => {
    const json = await recommend({
        history: history.slice(0, 20).map(toEntry),
        liked: history.slice(0, 5).map(toEntry),
    });
    return (json.items ?? [])
        .map((raw) => mapTmdbItem(raw as unknown as TmdbRaw))
        .filter((item) => item.poster);
};

export const loadChannels = async (): Promise<MediaItem[]> => (await tvChannels())
    .slice(0, 20)
    .map((channel): MediaItem => ({
        key: `channel:${channel.id}`,
        type: 'channel',
        name: channel.name,
        poster: channel.logo || null,
        caption: channel.group || null,
        href: '#/tv-live',
    }));

export type HeroData = {
    item: MediaItem,
    detail: MediaDetail,
};

/** Mise en avant : premier titre tendance de la semaine dont le détail (fond, logo, bande-annonce) est disponible. */
export const loadHero = async (): Promise<HeroData | null> => {
    const candidates = (await tmdbResults('trending/all/week'))
        .filter((raw) => raw.backdrop_path)
        .slice(0, 3)
        .map((raw) => mapTmdbItem(raw));
    // Séquentiel : on s’arrête au premier candidat résolu, pour limiter les appels LastAddon (120/min/IP).
    for (const item of candidates) {
        const detail = await getMediaDetail(item);
        if (detail) return { item, detail };
    }
    return null;
};
