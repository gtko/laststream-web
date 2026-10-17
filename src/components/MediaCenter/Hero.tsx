// Copyright (C) 2017-2026 Smart code 203358507

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import { useRouteActive } from 'stremio/common/useRouteFocused';
import RatingChips from './RatingChips';
import TrailerPlayer from './TrailerPlayer';
import { SoundIcon, InfoIcon, PlayIcon } from './icons';
import { certLabel, formatRuntime, prefersReducedMotion } from './format';
import { openMediaItem } from './mediaDetail';
import type { MediaDetail, MediaItem } from './types';
import styles from './styles.less';

// Délai d’inactivité (titre visible à moitié) avant la bande-annonce muette de la mise en avant.
const HERO_IDLE_MS = 4000;

type Props = {
    item: MediaItem | null,
    detail: MediaDetail | null,
    eyebrow: string,
    className?: string,
};

/** Mise en avant plein écran : image de fond, bande-annonce muette après une pause, notes et actions. */
const Hero = ({ item, detail, eyebrow, className }: Props) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const routeActive = useRouteActive();
    const sectionRef = useRef<HTMLElement>(null);
    const [visible, setVisible] = useState(false);
    const [trailerOn, setTrailerOn] = useState(false);
    const [muted, setMuted] = useState(true);
    const trailer = detail?.trailer ?? null;
    const idle = visible && routeActive && trailer !== null && !prefersReducedMotion();

    useEffect(() => {
        const node = sectionRef.current;
        if (!node || typeof IntersectionObserver === 'undefined') return undefined;
        const observer = new IntersectionObserver(([entry]) => setVisible(entry.intersectionRatio >= 0.5), { threshold: [0, 0.5] });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!idle) {
            setTrailerOn(false);
            return undefined;
        }
        const timer = window.setTimeout(() => setTrailerOn(true), HERO_IDLE_MS);
        return () => window.clearTimeout(timer);
    }, [idle]);

    const openDetails = () => {
        if (!item) return;
        openMediaItem(item).then((href) => {
            if (href) navigate(href.slice(1));
        });
    };

    const playTrailerWithSound = () => {
        setMuted(false);
        setTrailerOn(true);
    };

    const backdrop = detail?.backdrop ?? item?.backdrop ?? null;
    const title = detail?.name || item?.name || '';
    const meta: string[] = [];
    if (item?.year) meta.push(item.year);
    if (detail?.genres.length) meta.push(detail.genres.slice(0, 3).join(' · '));
    if (detail && item?.type === 'tv' && detail.seasons > 0) {
        const seasonsLabel = detail.seasons > 1
            ? t('MC_SEASONS_MANY', { defaultValue: 'saisons' })
            : t('MC_SEASON_ONE', { defaultValue: 'saison' });
        meta.push(`${detail.seasons} ${seasonsLabel}`);
    } else if (detail?.minutes) {
        meta.push(formatRuntime(detail.minutes));
    }

    return (
        <section ref={sectionRef} className={classnames(styles['hero'], item === null && styles['is-loading'], className)} aria-label={eyebrow}>
            <div className={styles['hero-bg']}>
                {backdrop ? <img src={backdrop} alt="" decoding="async" /> : null}
                {trailerOn && trailer !== null ? (
                    <TrailerPlayer
                        key={trailer}
                        videoKey={trailer}
                        muted={muted}
                        title={t('MC_TRAILER_HERO', { defaultValue: 'Bande-annonce en arrière-plan' })}
                    />
                ) : null}
            </div>
            <div className={styles['hero-scrim']} aria-hidden="true" />
            {item ? (
                <div className={styles['hero-content']}>
                    <span className={styles['hero-eyebrow']}>{eyebrow}</span>
                    <h1 className={styles['hero-title']}>
                        {detail?.logo ? (
                            <img className={styles['hero-logo']} src={detail.logo} alt={title} />
                        ) : (
                            <span>{title}</span>
                        )}
                    </h1>
                    {meta.length > 0 ? (
                        <ul className={styles['hero-meta']}>
                            {meta.map((entry, index) => <li key={index}>{entry}</li>)}
                            {detail?.cert ? <li className={styles['hero-cert']}>{certLabel(detail.cert)}</li> : null}
                        </ul>
                    ) : null}
                    <RatingChips ratings={detail?.ratings ?? null} fallbackTmdb={detail?.tmdbVote ? Math.round(detail.tmdbVote * 10) : null} />
                    {detail && detail.providers.length > 0 ? (
                        <div className={styles['hero-providers']} aria-label={t('MC_WHERE_TO_WATCH', { defaultValue: 'Disponible en streaming en France' })}>
                            {detail.providers.map((provider) => (
                                <img key={provider.name} src={provider.logo} alt={provider.name} title={provider.name} width={32} height={32} />
                            ))}
                        </div>
                    ) : null}
                    {detail?.overview ? <p className={styles['hero-overview']}>{detail.overview}</p> : null}
                    <div className={styles['hero-actions']}>
                        <button
                            type="button"
                            className={classnames(styles['mc-btn'], styles['mc-btn-primary'])}
                            disabled={trailer === null}
                            title={trailer === null ? t('MC_TRAILER_UNAVAILABLE', { defaultValue: 'Bande-annonce indisponible' }) : undefined}
                            onClick={playTrailerWithSound}
                        >
                            <PlayIcon />
                            <span>{t('MC_TRAILER', { defaultValue: 'Bande-annonce' })}</span>
                        </button>
                        <button type="button" className={classnames(styles['mc-btn'], styles['mc-btn-ghost'])} onClick={openDetails}>
                            <InfoIcon />
                            <span>{t('MC_MORE_INFO', { defaultValue: 'Plus d’infos' })}</span>
                        </button>
                        {trailerOn && trailer !== null ? (
                            <button
                                type="button"
                                className={classnames(styles['mc-round'], !muted && styles['is-on'])}
                                aria-pressed={!muted}
                                aria-label={muted
                                    ? t('MC_SOUND_ON', { defaultValue: 'Activer le son' })
                                    : t('MC_SOUND_OFF', { defaultValue: 'Couper le son' })}
                                onClick={() => setMuted((value) => !value)}
                            >
                                <SoundIcon muted={muted} />
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </section>
    );
};

export default Hero;
