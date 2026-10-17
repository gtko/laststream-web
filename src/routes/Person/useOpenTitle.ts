// Copyright (C) 2017-2026 Smart code 203358507

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { metaDetailsPath } from './personData';

/** Ouvre la fiche Stremio d'un titre TMDB (résolution IMDb à la demande, pas en masse). */
const useOpenTitle = () => {
    const navigate = useNavigate();
    const [pending, setPending] = useState<string | null>(null);
    const [failed, setFailed] = useState<string | null>(null);

    const open = useCallback(async (type: 'movie' | 'tv', tmdbId: number) => {
        const key = `${type}:${tmdbId}`;
        setPending(key);
        setFailed(null);
        try {
            const path = await metaDetailsPath(type, tmdbId);
            if (path) {
                navigate(path);
            } else {
                setFailed(key);
            }
        } catch {
            setFailed(key);
        } finally {
            setPending(null);
        }
    }, [navigate]);

    return { open, pending, failed };
};

export default useOpenTitle;
