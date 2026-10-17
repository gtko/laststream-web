// Copyright (C) 2017-2026 Smart code 203358507

import { imdbFromTmdb } from 'stremio/common/lastAddon';

export type TmdbCredit = {
    id: number,
    media_type?: string,
    title?: string,
    name?: string,
    release_date?: string,
    first_air_date?: string,
    poster_path?: string | null,
    backdrop_path?: string | null,
    character?: string,
    job?: string,
    department?: string,
    genre_ids?: number[],
    popularity?: number,
    vote_count?: number,
    vote_average?: number,
    episode_count?: number,
};

export type TmdbPerson = {
    id: number,
    name: string,
    biography?: string,
    birthday?: string | null,
    deathday?: string | null,
    gender?: number,
    known_for_department?: string,
    place_of_birth?: string | null,
    profile_path?: string | null,
    external_ids?: {
        imdb_id?: string | null,
        instagram_id?: string | null,
        twitter_id?: string | null,
    },
    combined_credits?: {
        cast?: TmdbCredit[],
        crew?: TmdbCredit[],
    },
    images?: {
        profiles?: { file_path: string }[],
    },
};

export type CreditKind = 'actor' | 'director' | 'writer' | 'producer' | 'crew';

export type FilmEntry = {
    key: string,
    type: 'movie' | 'tv',
    tmdbId: number,
    name: string,
    date: string,
    poster: string | null,
    backdrop: string | null,
    kinds: Set<CreditKind>,
    jobs: Set<string>,
    character: string,
    episodes: number,
    self: boolean,
    noise: boolean,
    popularity: number,
    votes: number,
    rating: number,
};

const NOISE_GENRES = [10767, 10763];
const SELF_PATTERN = /\b(self|himself|herself|lui-même|elle-même|soi-même|archive|archives|footage|uncredited|non crédité)\b/i;
const WRITER_JOB = /^(Writer|Screenplay|Story|Creator|Novel|Characters|Teleplay)$/;

export const tmdbImage = (size: string, path?: string | null): string | null =>
    path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

/** Regroupe les crédits (acteur, équipe) par titre, comme la fiche personne du prototype. */
export const buildFilmography = (credits: TmdbPerson['combined_credits']): FilmEntry[] => {
    const entries = new Map<string, FilmEntry>();

    const entryFor = (credit: TmdbCredit): FilmEntry | null => {
        const type = credit.media_type;
        if (!credit.id || (type !== 'movie' && type !== 'tv')) return null;

        const key = `${type}:${credit.id}`;
        const existing = entries.get(key);
        if (existing) return existing;

        const entry: FilmEntry = {
            key,
            type,
            tmdbId: credit.id,
            name: credit.title ?? credit.name ?? '',
            date: credit.release_date || credit.first_air_date || '',
            poster: credit.poster_path ?? null,
            backdrop: credit.backdrop_path ?? null,
            kinds: new Set(),
            jobs: new Set(),
            character: '',
            episodes: 0,
            self: false,
            noise: (credit.genre_ids ?? []).some((genre) => NOISE_GENRES.includes(genre)),
            popularity: credit.popularity ?? 0,
            votes: credit.vote_count ?? 0,
            rating: credit.vote_average ?? 0,
        };
        entries.set(key, entry);
        return entry;
    };

    (credits?.cast ?? []).forEach((credit) => {
        const entry = entryFor(credit);
        if (!entry) return;
        entry.kinds.add('actor');
        if (!entry.character && credit.character) entry.character = credit.character;
        entry.episodes = Math.max(entry.episodes, credit.episode_count ?? 0);
        if (SELF_PATTERN.test(credit.character ?? '')) entry.self = true;
    });

    (credits?.crew ?? []).forEach((credit) => {
        const entry = entryFor(credit);
        if (!entry) return;
        const job = credit.job ?? '';
        if (job === 'Director') entry.kinds.add('director');
        else if (WRITER_JOB.test(job) || credit.department === 'Writing') entry.kinds.add('writer');
        else if (/Producer/.test(job) || credit.department === 'Production') entry.kinds.add('producer');
        else entry.kinds.add('crew');
        if (job) entry.jobs.add(job);
    });

    return Array.from(entries.values());
};

/** Vrai pour les crédits réels (hors talk-shows, actualités, apparitions « soi-même »). */
export const isRealCredit = (entry: FilmEntry): boolean => !entry.noise && !entry.self;

export const ageOf = (birth: string, end?: string | null): number => {
    const start = new Date(`${birth}T00:00:00`);
    const finish = end ? new Date(`${end}T00:00:00`) : new Date();
    let age = finish.getFullYear() - start.getFullYear();
    const monthDiff = finish.getMonth() - start.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && finish.getDate() < start.getDate())) age -= 1;
    return age;
};

/** Chemin de la fiche Stremio (#/metadetails) d'un titre TMDB, via son identifiant IMDb. Null si inconnu. */
export const metaDetailsPath = async (type: 'movie' | 'tv', tmdbId: number): Promise<string | null> => {
    const imdbId = await imdbFromTmdb(type, tmdbId);
    if (!imdbId) return null;
    return `/metadetails/${type === 'tv' ? 'series' : 'movie'}/${encodeURIComponent(imdbId)}`;
};
