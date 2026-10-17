// Copyright (C) 2017-2026 Smart code 203358507

import { useEffect, useState } from 'react';
import { findByExternalId, mdblist, tmdb, why } from 'stremio/common/lastAddon';
import type { MdblistRatings } from 'stremio/common/lastAddon';
import { buildCollection, buildFicheTmdb, buildProviders } from './model';
import type { TmdbCollection, TmdbDetails, TmdbWatchProviders } from './model';
import type { FicheCollection, FicheMeta, FicheProviders, FicheTmdb, TmdbKind } from './types';

export type FicheData = {
    status: 'loading' | 'ready' | 'unavailable';
    tmdb: FicheTmdb | null;
    providers: FicheProviders | null;
    ratings: MdblistRatings | null;
    why: string;
    collection: FicheCollection | null;
};

const LOADING: FicheData = { status: 'loading', tmdb: null, providers: null, ratings: null, why: '', collection: null };
const UNAVAILABLE: FicheData = { ...LOADING, status: 'unavailable' };

const IMDB_ID = /^tt\d+$/;

const DETAIL_APPEND: Record<TmdbKind, string> = {
    movie: 'videos,images,credits,release_dates,recommendations,similar',
    tv: 'videos,images,credits,content_ratings,recommendations,similar',
};

export const imdbIdOf = (id: string): string | null => (IMDB_ID.test(id) ? id : null);

// Données LastAddon (TMDB, MDBList, IA) pour la fiche. Chaque morceau arrive à son rythme : un échec
// masque seulement sa section. Sans identifiant IMDb ou sans réponse de TMDB, le statut vaut `unavailable`.
const useFicheData = (meta: FicheMeta): FicheData => {
    const imdbId = imdbIdOf(meta.id);
    const { name, description } = meta;
    const [data, setData] = useState<FicheData>(imdbId === null ? UNAVAILABLE : LOADING);

    useEffect(() => {
        if (imdbId === null) {
            setData(UNAVAILABLE);
            return undefined;
        }

        let active = true;
        const patch = (next: Partial<FicheData>): void => {
            if (active) setData((previous) => ({ ...previous, ...next }));
        };

        const load = async (): Promise<void> => {
            setData(LOADING);
            const found = await findByExternalId(imdbId).catch(() => null);
            if (!active) return;
            if (found === null) {
                patch({ status: 'unavailable' });
                return;
            }

            const kind = found.type;
            const raw = await tmdb<TmdbDetails>(`${kind}/${found.tmdbId}`, {
                append_to_response: DETAIL_APPEND[kind],
                include_image_language: 'fr,en,null',
                include_video_language: 'fr,en,null',
            }).catch(() => null);
            if (!active) return;
            if (raw === null) {
                patch({ status: 'unavailable' });
                return;
            }

            const model = buildFicheTmdb(kind, raw);
            patch({ status: 'ready', tmdb: model });

            void tmdb<TmdbWatchProviders>(`${kind}/${found.tmdbId}/watch/providers`)
                .then((response) => patch({ providers: buildProviders(response) }))
                .catch(() => {
                    // Section « Disponible sur » masquée.
                });

            void mdblist(kind === 'tv' ? 'tv' : 'movie', imdbId)
                .then((response) => patch({ ratings: response.ratings ?? null }))
                .catch(() => {
                    // Chips de notes masqués.
                });

            void why({
                title: name,
                year: model.year,
                overview: model.overview || description || '',
                genres: model.genres,
            })
                .then((response) => patch({ why: response.text ?? '' }))
                .catch(() => {
                    // Texte « Pourquoi tu vas aimer » masqué.
                });

            if (raw.belongs_to_collection) {
                void tmdb<TmdbCollection>(`collection/${raw.belongs_to_collection.id}`)
                    .then((response) => {
                        const collection = buildCollection(response);
                        if (collection.parts.length >= 2) patch({ collection });
                    })
                    .catch(() => {
                        // Section « Collection » masquée.
                    });
            }
        };

        void load();
        return () => {
            active = false;
        };
    }, [imdbId, name, description]);

    return data;
};

export default useFicheData;
