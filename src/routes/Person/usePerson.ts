// Copyright (C) 2017-2026 Smart code 203358507

import { useEffect, useState } from 'react';
import { aiLanguage, personWhy, tmdb } from 'stremio/common/lastAddon';
import useProfile from 'stremio/common/useProfile';
import type { TmdbPerson } from './personData';

export type PersonState =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready', person: TmdbPerson };

const PERSON_PARAMS = { append_to_response: 'combined_credits,images,external_ids' };

const loadPerson = async (id: string): Promise<TmdbPerson> => {
    const person = await tmdb<TmdbPerson>(`person/${id}`, PERSON_PARAMS);
    if (!person.biography) {
        try {
            const english = await tmdb<TmdbPerson>(`person/${id}`, { language: 'en-US' });
            person.biography = english.biography ?? '';
        } catch {
            // Biographie absente dans les deux langues : la section reste masquée.
        }
    }
    return person;
};

export const usePerson = (id: string, enabled: boolean): PersonState => {
    const [state, setState] = useState<PersonState>({ status: 'loading' });

    useEffect(() => {
        if (!enabled) return undefined;
        if (!/^\d+$/.test(id)) {
            setState({ status: 'error' });
            return undefined;
        }

        let cancelled = false;
        setState({ status: 'loading' });
        loadPerson(id)
            .then((person) => {
                if (!cancelled) setState({ status: 'ready', person });
            })
            .catch(() => {
                if (!cancelled) setState({ status: 'error' });
            });

        return () => {
            cancelled = true;
        };
    }, [id, enabled]);

    return state;
};

/**
 * « En deux mots » généré par LastAddon, à partir de l'identifiant TMDB de la personne (le serveur lit le nom et les
 * titres sur TMDB). Null tant que rien n'est disponible ou en cas d'erreur.
 */
export const usePersonWhy = (personId: number, name: string, knownFor: string[], enabled: boolean): string | null => {
    const profile = useProfile();
    const language = aiLanguage(profile.settings?.interfaceLanguage);
    const [text, setText] = useState<string | null>(null);
    const knownForKey = knownFor.join('|');

    useEffect(() => {
        if (!enabled || !name || personId <= 0) return undefined;

        let cancelled = false;
        personWhy({
            type: 'person',
            tmdbId: personId,
            language,
            legacy: { name, knownFor: knownForKey.split('|') },
        })
            .then((response) => {
                if (!cancelled) setText(response.text || null);
            })
            .catch(() => {
                if (!cancelled) setText(null);
            });

        return () => {
            cancelled = true;
        };
    }, [personId, name, knownForKey, enabled, language]);

    return text;
};
