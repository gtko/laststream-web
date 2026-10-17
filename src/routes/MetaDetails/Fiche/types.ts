// Copyright (C) 2017-2026 Smart code 203358507

// Sous-ensemble du meta core (MetaDetails) utilisé par la fiche.
export type FicheMeta = {
    id: string;
    type: string;
    name: string;
    logo: string | null;
    background: string | null;
    poster: string | null;
    description: string | null;
    releaseInfo: string | null;
    runtime: string | null;
    trailerStreams: TrailerStream[];
    videos: Video[];
    deepLinks: MetaItemDeepLinks;
};

export type TmdbKind = 'movie' | 'tv';

export type FicheTmdbPerson = {
    id: number;
    name: string;
    role: string;
    photo: string;
};

export type FicheTmdbCrew = {
    id: number;
    name: string;
};

export type FicheTmdbPoster = {
    kind: TmdbKind;
    tmdbId: number;
    title: string;
    year: string;
    poster: string;
};

export type FicheExtra = {
    key: string;
    type: string;
    name: string;
};

export type ProviderKey = 'flatrate' | 'free' | 'rent' | 'buy';

export type FicheProviderGroup = {
    key: ProviderKey;
    items: { name: string; logo: string }[];
};

export type FicheProviders = {
    link: string;
    groups: FicheProviderGroup[];
};

export type FicheCollection = {
    name: string;
    parts: FicheTmdbPoster[];
};

export type FicheTmdb = {
    kind: TmdbKind;
    tagline: string;
    overview: string;
    original: string;
    year: string;
    genres: string[];
    minutes: number;
    cert: string;
    status: string;
    releaseDate: string;
    lastAir: string;
    seasonCount: number;
    episodeCount: number;
    backdrop: string;
    logo: string;
    trailerKey: string;
    vote: number;
    cast: FicheTmdbPerson[];
    directors: FicheTmdbCrew[];
    writers: FicheTmdbCrew[];
    countries: string[];
    originalLanguage: string;
    spokenLanguages: string[];
    studios: string[];
    budget: number;
    revenue: number;
    similar: FicheTmdbPoster[];
    extras: FicheExtra[];
};
