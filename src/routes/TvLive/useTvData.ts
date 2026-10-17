// Copyright (C) 2017-2026 Smart code 203358507

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tvChannels, tvEpg, tvImport } from 'stremio/common/lastAddon';
import type { TvChannel, TvEpgProgram } from 'stremio/common/lastAddon';
import { readPlaylist } from './tvStorage';

const EPG_CHUNK_SIZE = 40;

export type LoadState = 'loading' | 'ready' | 'error';

/** Clé du programme TV d'une chaîne : l'identifiant de catalogue, ou l'identifiant EPG d'une playlist importée. */
export const epgKeyOf = (channel: TvChannel): string => (channel.source === 'user' ? channel.epgId : channel.id);

/** Catalogue LastAddon et playlist personnelle importée, fusionnés en une seule liste. */
export const useTvChannels = (enabled: boolean) => {
    const [catalog, setCatalog] = useState<TvChannel[]>([]);
    const [user, setUser] = useState<TvChannel[]>([]);
    const [catalogState, setCatalogState] = useState<LoadState>('loading');
    const [userError, setUserError] = useState(false);
    const [playlistVersion, setPlaylistVersion] = useState(0);

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        setCatalogState('loading');
        tvChannels()
            .then((channels) => {
                if (cancelled) return;
                setCatalog(channels);
                setCatalogState('ready');
            })
            .catch(() => {
                if (!cancelled) setCatalogState('error');
            });
        return () => {
            cancelled = true;
        };
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return undefined;
        const playlist = readPlaylist();
        if (!playlist) {
            setUser([]);
            setUserError(false);
            return undefined;
        }

        let cancelled = false;
        // Seul le résultat est gardé : la requête d'import (identifiants compris) n'est jamais journalisée.
        tvImport(playlist)
            .then((response) => {
                if (cancelled) return;
                setUser(response.channels ?? []);
                setUserError(false);
            })
            .catch(() => {
                if (cancelled) return;
                setUser([]);
                setUserError(true);
            });
        return () => {
            cancelled = true;
        };
    }, [enabled, playlistVersion]);

    const reloadPlaylist = useCallback(() => setPlaylistVersion((value) => value + 1), []);

    const channels = useMemo(() => [...catalog, ...user], [catalog, user]);

    return {
        channels,
        catalogState,
        userError,
        hasUserPlaylist: user.length > 0 || userError,
        reloadPlaylist,
    };
};

/** Programmes des chaînes demandées sur la fenêtre [from, from + hours[ (secondes epoch). */
export const useEpg = (channels: TvChannel[], from: number, hours: number) => {
    const [programs, setPrograms] = useState<Record<string, TvEpgProgram[]>>({});
    const requested = useRef(new Set<string>());
    const keys = Array.from(new Set(channels.map(epgKeyOf).filter((key) => key.length > 0)));
    const keysKey = keys.join(',');

    useEffect(() => {
        const missing = keysKey.split(',').filter((key) => key.length > 0 && !requested.current.has(key));
        if (missing.length === 0) return;
        missing.forEach((key) => requested.current.add(key));

        const to = from + hours * 3600;
        const chunks: string[][] = [];
        for (let index = 0; index < missing.length; index += EPG_CHUNK_SIZE) {
            chunks.push(missing.slice(index, index + EPG_CHUNK_SIZE));
        }

        Promise.all(chunks.map((ids) => tvEpg(ids, from, to)
            .then((list) => ({ ids, list }))
            .catch(() => ({ ids, list: [] as TvEpgProgram[] }))))
            .then((results) => {
                setPrograms((previous) => {
                    const next = { ...previous };
                    results.forEach(({ ids, list }) => {
                        ids.forEach((id) => {
                            next[id] = [];
                        });
                        list.forEach((program) => {
                            if (next[program.channelId]) next[program.channelId] = [...next[program.channelId], program];
                        });
                    });
                    return next;
                });
            });
    }, [keysKey, from, hours]);

    return programs;
};
