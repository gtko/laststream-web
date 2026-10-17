// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import Icon from '@stremio/stremio-icons/react';
import { Button } from 'stremio/components';
import { hlsUrl } from 'stremio/common/lastAddon';
import type { TvChannel, TvEpgProgram } from 'stremio/common/lastAddon';
import { formatTime, nowNext, nowSeconds, progressPercent } from './tvEpg';
import styles from './TvLive.less';

const STALL_TIMEOUT_MS = 20000;
const BANNER_TIMEOUT_MS = 4000;
const DIRECT_FILE_PATTERN = /\.(mp4|webm|mkv|ts)(\?|$)/i;
const HLS_SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js';

type HlsInstance = {
    on: (event: string, listener: (...args: unknown[]) => void) => void,
    loadSource: (url: string) => void,
    attachMedia: (element: HTMLVideoElement) => void,
    destroy: () => void,
};

type HlsConstructor = {
    new (config?: Record<string, unknown>): HlsInstance,
    isSupported: () => boolean,
    Events: { ERROR: string, MANIFEST_PARSED: string },
};

type HlsWindow = Window & { Hls?: HlsConstructor };

let hlsLoader: Promise<HlsConstructor | null> | null = null;

// hls.js n'est pas une dépendance directe du projet : chargé à la demande, seulement si le navigateur ne lit pas HLS.
const loadHls = (): Promise<HlsConstructor | null> => {
    const existing = (window as HlsWindow).Hls;
    if (existing) return Promise.resolve(existing);

    if (!hlsLoader) {
        hlsLoader = new Promise<HlsConstructor | null>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = HLS_SCRIPT_URL;
            script.crossOrigin = 'anonymous';
            script.onload = () => resolve((window as HlsWindow).Hls ?? null);
            script.onerror = () => reject(new Error('hls.js unavailable'));
            document.head.appendChild(script);
        });
        hlsLoader.catch(() => {
            hlsLoader = null;
        });
    }
    return hlsLoader;
};

type Props = {
    channels: TvChannel[],
    index: number,
    programsOf: (channel: TvChannel) => TvEpgProgram[],
    onIndexChange: (index: number) => void,
    onClose: () => void,
    onPlayed: (channel: TvChannel) => void,
};

const TvPlayer = ({ channels, index, programsOf, onIndexChange, onClose, onPlayed }: Props) => {
    const { t, i18n } = useTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<HlsInstance | null>(null);
    const [failed, setFailed] = useState(false);
    const [bannerTimed, setBannerTimed] = useState(true);
    const [bannerSticky, setBannerSticky] = useState(false);
    const channel = channels[index];
    const count = channels.length;

    const onPlayedRef = useRef(onPlayed);
    useEffect(() => {
        onPlayedRef.current = onPlayed;
    }, [onPlayed]);

    // Bandeau d'information : affiché à chaque changement de chaîne, puis masqué après un délai.
    useEffect(() => {
        setBannerTimed(true);
        const timer = setTimeout(() => setBannerTimed(false), BANNER_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [index]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !channel) return undefined;

        let active = true;
        const play = () => {
            video.play().catch(() => undefined);
        };
        const fail = () => {
            if (!active) return;
            clearTimeout(stallTimer);
            setFailed(true);
        };
        const onPlaying = () => {
            clearTimeout(stallTimer);
            setFailed(false);
        };

        setFailed(false);
        onPlayedRef.current(channel);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('error', fail);
        const stallTimer = setTimeout(fail, STALL_TIMEOUT_MS);

        try {
            // Un canal sans signature n'est pas jouable : aucune URL proxy non signée n'est construite.
            const direct = DIRECT_FILE_PATTERN.test(channel.url);
            const src = channel.sig ? (direct ? channel.url : hlsUrl(channel.url, channel.sig)) : null;
            if (src === null) {
                fail();
            } else if (direct) {
                video.src = src;
                play();
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = src;
                play();
            } else {
                loadHls()
                    .then((Hls) => {
                        if (!active) return;
                        if (!Hls || !Hls.isSupported()) {
                            fail();
                            return;
                        }
                        const hls = new Hls({ maxBufferLength: 20 });
                        hlsRef.current = hls;
                        hls.on(Hls.Events.ERROR, (_event, data) => {
                            if ((data as { fatal?: boolean })?.fatal) fail();
                        });
                        hls.on(Hls.Events.MANIFEST_PARSED, play);
                        hls.loadSource(src);
                        hls.attachMedia(video);
                    })
                    .catch(fail);
            }
        } catch {
            fail();
        }

        return () => {
            active = false;
            clearTimeout(stallTimer);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('error', fail);
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            video.removeAttribute('src');
            video.load();
        };
    }, [channel]);

    const zap = useCallback((delta: number) => {
        if (count === 0) return;
        onIndexChange((index + delta + count) % count);
    }, [count, index, onIndexChange]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' || event.key === 'Backspace') {
                event.preventDefault();
                onClose();
            } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
                event.preventDefault();
                zap(-1);
            } else if (event.key === 'ArrowDown' || event.key === 'PageDown') {
                event.preventDefault();
                zap(1);
            } else if (event.key === 'i' || event.key === 'I') {
                setBannerSticky((value) => !value);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, zap]);

    if (!channel) return null;

    const now = nowSeconds();
    const { current, next } = nowNext(programsOf(channel), now);
    const bannerVisible = bannerTimed || bannerSticky;

    return (
        <div className={styles['tv-player']} role={'dialog'} aria-modal={'true'} aria-label={channel.name}>
            <video ref={videoRef} className={styles['tv-video']} controls autoPlay playsInline />

            <div className={classNames(styles['tv-banner'], { [styles['visible']]: bannerVisible })} aria-live={'polite'}>
                <div className={styles['tv-banner-logo']}>
                    {channel.logo ? <img src={channel.logo} alt={''} /> : <b>{channel.name.slice(0, 3)}</b>}
                </div>
                <div className={styles['tv-banner-text']}>
                    <span className={styles['tv-banner-channel']}>{channel.name}</span>
                    {
                        current ?
                            <React.Fragment>
                                <span className={styles['tv-banner-now']}>
                                    <strong>{t('TV_NOW', { defaultValue: 'En cours' })}</strong> {current.title} · {formatTime(current.start, i18n.language)} – {formatTime(current.stop, i18n.language)}
                                </span>
                                <span className={styles['progress']} aria-hidden={'true'}>
                                    <span style={{ width: `${progressPercent(current, now)}%` }} />
                                </span>
                            </React.Fragment>
                            :
                            <span className={styles['tv-banner-now']}>{t('TV_NO_PROGRAM', { defaultValue: 'Programme non communiqué' })}</span>
                    }
                    {
                        next ?
                            <span className={styles['tv-banner-next']}>
                                {t('TV_NEXT', { defaultValue: 'Ensuite' })} : {next.title} · {formatTime(next.start, i18n.language)}
                            </span>
                            : null
                    }
                </div>
            </div>

            <Button
                className={styles['tv-close']}
                title={t('TV_CLOSE_PLAYER', { defaultValue: 'Fermer le lecteur' })}
                onClick={onClose}
            >
                <Icon name={'close'} />
            </Button>

            {
                failed ?
                    <div className={styles['tv-error']} role={'alert'}>
                        <p>{t('TV_PLAY_ERROR', { defaultValue: 'Ce flux ne répond pas. Essaie la chaîne suivante.' })}</p>
                        <div className={styles['tv-error-actions']}>
                            <Button className={styles['tv-error-button']} onClick={() => zap(1)}>
                                {t('TV_NEXT_CHANNEL', { defaultValue: 'Chaîne suivante' })}
                            </Button>
                            <Button className={styles['tv-error-button']} onClick={onClose}>
                                {t('TV_CLOSE_PLAYER', { defaultValue: 'Fermer le lecteur' })}
                            </Button>
                        </div>
                    </div>
                    : null
            }
        </div>
    );
};

export default TvPlayer;
