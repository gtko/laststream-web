// Copyright (C) 2017-2026 Smart code 203358507

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    autoSkipSegment,
    countdownRemaining,
    creditsSegmentOf,
    fetchSkipSegments,
    nextEpisodeCardVisible,
    parseSeriesTarget,
    segmentKeyOf,
    shouldAdvanceToNextEpisode,
    skipButtonSegment,
    type SkipSegment,
    type SkipSegmentKind,
} from 'stremio/common/lastAddon';
import { getSkipPref } from 'stremio/common/lastAddon/prefs';

export type SkipNextVideo = {
    title?: string,
    thumbnail?: string | null,
    season?: number,
    episode?: number,
};

type Options = {
    // Faux en EPG et sans flux de série : aucun segment n'est demandé.
    enabled: boolean,
    streamPath: { type?: string, id?: string } | null,
    time: number | null,
    nextVideo: SkipNextVideo | null,
    onSeek: (time: number) => void,
    onAdvance: () => void,
};

export type NextEpisodeCard = {
    countdown: number,
    nextVideo: SkipNextVideo,
};

/**
 * Sauts d'un épisode : bouton « Passer l'intro / le récap » (touche S), sauts automatiques selon les réglages,
 * carte « Épisode suivant » pendant le générique (compte à rebours, passage automatique).
 */
export const useSkipSegments = ({ enabled, streamPath, time, nextVideo, onSeek, onAdvance }: Options) => {
    const target = useMemo(() => (
        enabled && streamPath?.type === 'series' && typeof streamPath.id === 'string' ? parseSeriesTarget(streamPath.id) : null
    ), [enabled, streamPath?.type, streamPath?.id]);
    const targetKey = target ? `${target.imdbId}:${target.season}:${target.episode}` : '';

    const [segments, setSegments] = useState<SkipSegment[]>([]);
    const [watchingCredits, setWatchingCredits] = useState(false);
    const skippedRef = useRef(new Set<string>());
    const advancedRef = useRef(false);

    // Réglages lus une fois par épisode (pas à chaque mise à jour du temps de lecture).
    const autoKinds = useMemo(() => {
        const kinds = new Set<SkipSegmentKind>();
        if (getSkipPref('intro')) kinds.add('intro');
        if (getSkipPref('recap')) kinds.add('recap');
        return kinds;
    }, [targetKey]); // eslint-disable-line react-hooks/exhaustive-deps
    const autoNext = useMemo(() => getSkipPref('nextEpisode'), [targetKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setSegments([]);
        setWatchingCredits(false);
        skippedRef.current = new Set();
        advancedRef.current = false;
        if (!target) return undefined;
        let cancelled = false;
        fetchSkipSegments(target.imdbId, target.season, target.episode).then((list) => {
            if (!cancelled) setSegments(list);
        });
        return () => {
            cancelled = true;
        };
    }, [targetKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const currentTime = time ?? -1;
    const skipSegment = target !== null && currentTime >= 0 ? skipButtonSegment(segments, currentTime) : null;

    // Saut automatique : une fois par segment, dans son intervalle.
    useEffect(() => {
        if (target === null || currentTime < 0 || segments.length === 0 || autoKinds.size === 0) return;
        const segment = autoSkipSegment(segments, currentTime, autoKinds, skippedRef.current);
        if (segment === null) return;
        skippedRef.current.add(segmentKeyOf(segment));
        onSeek(segment.end);
    }, [currentTime, segments, autoKinds, target, onSeek]);

    const skip = useCallback(() => {
        if (skipSegment !== null) {
            skippedRef.current.add(segmentKeyOf(skipSegment));
            onSeek(skipSegment.end);
        }
    }, [skipSegment, onSeek]);

    // Touche S : même effet que le bouton, uniquement quand il est affiché.
    const skipRef = useRef(skip);
    skipRef.current = skip;
    const hasSkipButton = skipSegment !== null;
    useEffect(() => {
        if (!hasSkipButton) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.key !== 's' && event.key !== 'S') || event.ctrlKey || event.metaKey || event.altKey) return;
            event.preventDefault();
            skipRef.current();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [hasSkipButton]);

    const credits = creditsSegmentOf(segments);
    const cardVisible = target !== null && autoNext && nextVideo !== null
        && nextEpisodeCardVisible(segments, currentTime, watchingCredits);

    useEffect(() => {
        if (!cardVisible || advancedRef.current) return;
        if (shouldAdvanceToNextEpisode(segments, currentTime, watchingCredits)) {
            advancedRef.current = true;
            onAdvance();
        }
    }, [cardVisible, segments, currentTime, watchingCredits, onAdvance]);

    const nextCard: NextEpisodeCard | null = cardVisible && credits !== null && nextVideo !== null
        ? { countdown: countdownRemaining(credits.start, currentTime), nextVideo }
        : null;

    return {
        skipSegment,
        onSkip: skip,
        nextCard,
        onWatchCredits: useCallback(() => setWatchingCredits(true), []),
    };
};
