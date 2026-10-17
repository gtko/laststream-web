// Copyright (C) 2017-2026 Smart code 203358507

import type { MdblistRatings } from 'stremio/common/lastAddon';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';
const NBSP = ' ';

export const tmdbImage = (size: string, path?: string | null): string => (
    path ? `${TMDB_IMAGE_BASE}${size}${path}` : ''
);

export const prefersReducedMotion = (): boolean => (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

export const formatMinutes = (minutes: number): string => {
    if (minutes <= 0) return '';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
};

export const formatDate = (iso: string): string => {
    if (iso === '') return '';
    const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime())
        ? iso
        : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const formatMoney = (amount: number): string => (
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
);

export const displayName = (type: 'region' | 'language', code: string): string => {
    try {
        return new Intl.DisplayNames(['fr'], { type }).of(code) || code;
    } catch {
        // Code inconnu ou API absente : on garde le code brut.
        return code;
    }
};

const todayIso = (): string => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const isFutureDate = (iso: string): boolean => iso !== '' && iso.slice(0, 10) > todayIso();

export const youtubeEmbedUrl = (key: string, muted: boolean): string => {
    const params: Record<string, string> = { autoplay: '1', rel: '0', playsinline: '1', modestbranding: '1' };
    if (muted) Object.assign(params, { mute: '1', controls: '0', loop: '1', playlist: key });
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?${new URLSearchParams(params).toString()}`;
};

export type RatingChip = { key: string; label: string; value: string };

const formatDecimal = (value: number): string => value.toFixed(1).replace('.', ',');
const formatPercent = (value: number): string => `${Math.round(value)}${NBSP}%`;

export const ratingChips = (ratings: MdblistRatings | null, tmdbVote: number): RatingChip[] => {
    const chips: RatingChip[] = [];
    if (ratings !== null && typeof ratings.imdb === 'number') {
        chips.push({ key: 'imdb', label: 'IMDb', value: formatDecimal(ratings.imdb) });
    }
    if (ratings !== null && typeof ratings.rottentomatoes === 'number') {
        chips.push({ key: 'rt', label: 'Rotten Tomatoes', value: formatPercent(ratings.rottentomatoes) });
    }
    if (ratings !== null && typeof ratings.rottentomatoes_audience === 'number') {
        chips.push({ key: 'rta', label: 'Public RT', value: formatPercent(ratings.rottentomatoes_audience) });
    }
    if (ratings !== null && typeof ratings.metacritic === 'number') {
        chips.push({ key: 'mc', label: 'Metacritic', value: String(Math.round(ratings.metacritic)) });
    }
    if (ratings !== null && typeof ratings.letterboxd === 'number') {
        chips.push({ key: 'lb', label: 'Letterboxd', value: formatDecimal(ratings.letterboxd) });
    }
    const tmdb = ratings !== null && typeof ratings.tmdb === 'number' ? ratings.tmdb : tmdbVote * 10;
    if (tmdb > 0) chips.push({ key: 'tmdb', label: 'TMDB', value: formatPercent(tmdb) });
    if (ratings !== null && typeof ratings.trakt === 'number') {
        chips.push({ key: 'trakt', label: 'Trakt', value: formatPercent(ratings.trakt) });
    }
    return chips;
};
