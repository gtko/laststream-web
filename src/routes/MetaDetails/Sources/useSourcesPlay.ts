// Copyright (C) 2017-2026 Smart code 203358507

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useToast from 'stremio/common/Toast/useToast';
import { getAutoplay } from 'stremio/common/lastAddon/prefs';
import {
    getStreamHttpUrl,
    measureBandwidthKbps,
    pickAutoplay,
    sortStreams,
} from 'stremio/common/lastAddon/sources';
import { getPlayerHref } from './getStreamHref';

export const STREAMS_TIMEOUT_MS = 8000;
const PREFERRED_LANG = 'fr';
const LANGUAGE_FALLBACK_TOAST_MS = 4000;

type CoreStreamEntries = MetaDetails['streams'];

/** Streams prêts de tous les addons, à plat. */
export const flattenReadyStreams = (entries: CoreStreamEntries): Stream[] => entries.flatMap(({ content }) => (
    content.type === 'Ready' ? content.content : []
));

/**
 * Épisode à lancer pour « Lecture » sur une série sans épisode choisi : l'épisode de reprise si présent,
 * sinon le premier non vu, sinon le premier. Les « Bonus » (saison 0) passent en dernier.
 */
export const pickPlayVideo = (videos: readonly Video[], resumeVideoId: string | null): Video | null => {
    const seasonKey = (video: Video): number => (video.season === 0 || video.season === undefined ? Number.MAX_SAFE_INTEGER : video.season);
    const ordered = videos
        .filter((video) => !video.upcoming)
        .sort((a, b) => (seasonKey(a) - seasonKey(b)) || ((a.episode ?? 0) - (b.episode ?? 0)));
    return ordered.find((video) => video.id === resumeVideoId)
        ?? ordered.find((video) => !video.watched)
        ?? ordered[0]
        ?? null;
};

type Options = {
    streams: CoreStreamEntries;
    hasStreamPath: boolean;
    externalPlayer: boolean;
    onStartStream: (stream: Stream) => void;
};

/**
 * Orchestration de « Lecture » : attend les streams (8 s au plus, sinon drawer), puis lance la source
 * choisie par lecture automatique (si activée et si une source tient le débit) ou ouvre le drawer.
 */
export const useSourcesPlay = ({ streams, hasStreamPath, externalPlayer, onStartStream }: Options) => {
    const { t } = useTranslation();
    const toast = useToast();
    const [pending, setPending] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const runRef = useRef<{ id: number } | null>(null);
    const decidedRef = useRef<number | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const counterRef = useRef(0);
    // Valeurs courantes pour les étapes asynchrones (mesure de débit) sans callbacks périmés.
    const latestRef = useRef({ externalPlayer, onStartStream, t, toast });
    latestRef.current = { externalPlayer, onStartStream, t, toast };

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const finish = useCallback(() => {
        runRef.current = null;
        clearTimer();
        setPending(false);
    }, [clearTimer]);

    const openDrawer = useCallback(() => {
        finish();
        setDrawerOpen(true);
    }, [finish]);

    const closeDrawer = useCallback(() => setDrawerOpen(false), []);

    const requestPlay = useCallback(() => {
        clearTimer();
        const id = ++counterRef.current;
        runRef.current = { id };
        setDrawerOpen(false);
        setPending(true);
        timerRef.current = setTimeout(() => {
            if (runRef.current?.id === id) openDrawer();
        }, STREAMS_TIMEOUT_MS);
    }, [clearTimer, openDrawer]);

    const settled = hasStreamPath && streams.length > 0 && streams.every(({ content }) => content.type !== 'Loading');

    useEffect(() => {
        const run = runRef.current;
        if (run === null || !settled || decidedRef.current === run.id) return;
        decidedRef.current = run.id;
        const isCurrent = () => runRef.current?.id === run.id;

        // Seules les sources ouvrables dans le lecteur intégré sont candidates.
        const candidates = flattenReadyStreams(streams).filter((stream) => getPlayerHref(stream) !== null);
        if (!getAutoplay() || latestRef.current.externalPlayer || candidates.length === 0) {
            openDrawer();
            return;
        }

        const best = sortStreams(candidates)[0];
        measureBandwidthKbps(getStreamHttpUrl(best)).then((bwKbps) => {
            if (!isCurrent()) return;
            const pick = pickAutoplay(candidates, bwKbps, PREFERRED_LANG);
            if (pick === null) {
                openDrawer();
                return;
            }
            finish();
            const current = latestRef.current;
            if (pick.languageFallback) {
                current.toast.show({
                    type: 'info',
                    title: current.t('SOURCES_VO_FALLBACK', { defaultValue: 'Pas de VF disponible, lecture en VO' }),
                    timeout: LANGUAGE_FALLBACK_TOAST_MS,
                });
            }
            current.onStartStream(pick.stream);
        });
    }, [pending, settled, streams, openDrawer, finish]);

    useEffect(() => () => {
        runRef.current = null;
        clearTimer();
    }, [clearTimer]);

    return { pending, drawerOpen, requestPlay, openDrawer, closeDrawer };
};
