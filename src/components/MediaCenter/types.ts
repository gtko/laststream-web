// Copyright (C) 2017-2026 Smart code 203358507

import type { MdblistRatings } from 'stremio/common/lastAddon';

export type MediaType = 'movie' | 'tv' | 'channel';

export type MediaBadge = 'new' | 'soon' | 'top';

// Élément affichable par les tuiles et la mise en avant. `key` est unique (ex. `movie:550`, `tt0111161`).
export type MediaItem = {
    key: string,
    type: MediaType,
    name: string,
    tmdbId?: number | null,
    imdbId?: string | null,
    href?: string | null,
    year?: string,
    poster?: string | null,
    backdrop?: string | null,
    vote?: number | null,
    caption?: string | null,
    progress?: number | null,
    // Dernier visionnage (ms epoch) pour les titres de la bibliothèque.
    lastWatched?: number | null,
    upcomingDate?: string | null,
    badge?: MediaBadge | null,
};

export type MediaProvider = {
    name: string,
    logo: string,
};

// Détail chargé à la demande (TMDB + MDBList). Null quand le titre ne peut pas être résolu.
export type MediaDetail = {
    tmdbId: number,
    imdbId: string | null,
    name: string,
    overview: string,
    logo: string | null,
    backdrop: string | null,
    trailer: string | null,
    genres: string[],
    minutes: number,
    seasons: number,
    cert: string,
    tmdbVote: number | null,
    ratings: MdblistRatings | null,
    providers: MediaProvider[],
};
