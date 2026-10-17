// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import classnames from 'classnames';
import styles from './styles.less';

const YOUTUBE_ORIGIN = 'https://www.youtube-nocookie.com';

// Pilotage du lecteur YouTube (API postMessage) : mute, unMute, playVideo.
const postCommand = (frame: HTMLIFrameElement | null, func: string): void => {
    try {
        frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), YOUTUBE_ORIGIN);
    } catch {
        // Iframe absente ou pas encore chargée : la commande est renvoyée au chargement.
    }
};

export const trailerSrc = (videoKey: string): string => {
    const params = new URLSearchParams({
        autoplay: '1',
        mute: '1',
        controls: '0',
        loop: '1',
        playlist: videoKey,
        modestbranding: '1',
        rel: '0',
        playsinline: '1',
        disablekb: '1',
        iv_load_policy: '3',
        enablejsapi: '1',
        origin: window.location.origin,
    });
    return `${YOUTUBE_ORIGIN}/embed/${encodeURIComponent(videoKey)}?${params.toString()}`;
};

// Couvre la boîte parente en 16:9 avec un léger débordement pour masquer les barres YouTube.
const fitCover = (box: HTMLElement, frame: HTMLIFrameElement): void => {
    const width = box.offsetWidth;
    const height = box.offsetHeight;
    if (!width || !height) return;
    const overscan = 1.12;
    let w = width * overscan;
    let h = (w * 9) / 16;
    if (h < height * overscan) {
        h = height * overscan;
        w = (h * 16) / 9;
    }
    frame.style.width = `${w}px`;
    frame.style.height = `${h}px`;
    frame.style.left = `${(width - w) / 2}px`;
    frame.style.top = `${(height - h) / 2}px`;
};

type Props = {
    videoKey: string,
    muted: boolean,
    title: string,
    className?: string,
};

/** Bande-annonce YouTube en fond (lecture automatique, sans son par défaut). Le son se règle avec `muted`. */
const TrailerPlayer = ({ videoKey, muted, title, className }: Props) => {
    const boxRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLIFrameElement>(null);
    const mutedRef = useRef(muted);
    const src = useMemo(() => trailerSrc(videoKey), [videoKey]);

    useEffect(() => {
        mutedRef.current = muted;
        postCommand(frameRef.current, muted ? 'mute' : 'unMute');
    }, [muted]);

    useEffect(() => {
        const box = boxRef.current;
        const frame = frameRef.current;
        if (!box || !frame || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(() => fitCover(box, frame));
        observer.observe(box);
        fitCover(box, frame);
        return () => observer.disconnect();
    }, []);

    const onLoad = useCallback(() => {
        postCommand(frameRef.current, mutedRef.current ? 'mute' : 'unMute');
        postCommand(frameRef.current, 'playVideo');
    }, []);

    return (
        <div ref={boxRef} className={classnames(styles['trailer'], className)} aria-hidden="true">
            <iframe ref={frameRef} title={title} tabIndex={-1} allow="autoplay; encrypted-media" src={src} onLoad={onLoad} />
        </div>
    );
};

export default TrailerPlayer;
