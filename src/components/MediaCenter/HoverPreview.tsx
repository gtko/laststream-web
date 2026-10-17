// Copyright (C) 2017-2026 Smart code 203358507

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import RatingChips from './RatingChips';
import TrailerPlayer from './TrailerPlayer';
import { SoundIcon } from './icons';
import { certLabel, formatRuntime, prefersReducedMotion } from './format';
import { getMediaDetail, openMediaItem } from './mediaDetail';
import type { MediaDetail, MediaItem } from './types';
import styles from './styles.less';

const TRAILER_DELAY_MS = 350;
const CARD_MIN_WIDTH = 300;
const CARD_MAX_WIDTH = 480;

type Props = {
    item: MediaItem,
    anchor: DOMRect,
    onClose: () => void,
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

/** Aperçu 16:9 au survol d’une tuile : image, bande-annonce muette après un court délai, notes et actions. */
const HoverPreview = ({ item, anchor, onClose }: Props) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const cardRef = useRef<HTMLDivElement>(null);
    const [detail, setDetail] = useState<MediaDetail | null>(null);
    const [trailerReady, setTrailerReady] = useState(false);
    const [muted, setMuted] = useState(true);
    const [shown, setShown] = useState(false);
    const width = Math.round(clamp(anchor.width * 1.5, CARD_MIN_WIDTH, CARD_MAX_WIDTH));
    const trailer = detail?.trailer ?? null;

    useEffect(() => {
        let active = true;
        getMediaDetail(item).then((result) => {
            if (active) setDetail(result);
        });
        return () => {
            active = false;
        };
    }, [item]);

    useEffect(() => {
        if (trailer === null || prefersReducedMotion()) return undefined;
        const timer = window.setTimeout(() => setTrailerReady(true), TRAILER_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [trailer]);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => setShown(true));
        return () => window.cancelAnimationFrame(frame);
    }, []);

    // Position centrée sur la vignette, ramenée dans la fenêtre.
    useLayoutEffect(() => {
        const card = cardRef.current;
        if (!card) return;
        const left = clamp(anchor.left + anchor.width / 2 - width / 2, 12, window.innerWidth - width - 12);
        const top = clamp(anchor.top + anchor.height / 2 - card.offsetHeight / 2, 12, window.innerHeight - card.offsetHeight - 12);
        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
    }, [anchor, width, detail]);

    useEffect(() => {
        const onPointerDown = (event: PointerEvent) => {
            if (cardRef.current?.contains(event.target as Node)) return;
            onClose();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        const onScroll = () => onClose();
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('scroll', onScroll, true);
        };
    }, [onClose]);

    const openDetails = () => {
        onClose();
        openMediaItem(item).then((href) => {
            if (href) navigate(href.slice(1));
        });
    };

    const backdrop = detail?.backdrop ?? item.backdrop ?? item.poster ?? null;
    const meta: string[] = [];
    if (item.year) meta.push(item.year);
    if (detail?.cert) meta.push(certLabel(detail.cert));
    if (detail && item.type === 'tv' && detail.seasons > 0) {
        const seasonsLabel = detail.seasons > 1
            ? t('MC_SEASONS_MANY', { defaultValue: 'saisons' })
            : t('MC_SEASON_ONE', { defaultValue: 'saison' });
        meta.push(`${detail.seasons} ${seasonsLabel}`);
    } else if (detail && detail.minutes > 0) {
        meta.push(formatRuntime(detail.minutes));
    }
    if (detail && detail.genres.length > 0) meta.push(detail.genres.slice(0, 3).join(' · '));

    return createPortal(
        <div
            ref={cardRef}
            className={classnames(styles['hover-card'], shown && styles['is-on'])}
            style={{ width }}
            role="dialog"
            aria-label={item.name}
        >
            <div className={styles['hover-media']}>
                {backdrop ? <img src={backdrop} alt="" decoding="async" /> : null}
                {trailer !== null && trailerReady ? (
                    <TrailerPlayer
                        key={trailer}
                        videoKey={trailer}
                        muted={muted}
                        title={t('MC_TRAILER_PREVIEW', { defaultValue: 'Aperçu vidéo sans son' })}
                    />
                ) : null}
            </div>
            <div className={styles['hover-body']}>
                {detail?.logo ? (
                    <img className={styles['hover-logo']} src={detail.logo} alt={item.name} />
                ) : (
                    <span className={styles['hover-name']}>{item.name}</span>
                )}
                <RatingChips
                    ratings={detail?.ratings ?? null}
                    fallbackTmdb={item.vote ? Math.round(item.vote * 10) : null}
                    compact
                />
                {meta.length > 0 ? <p className={styles['hover-meta']}>{meta.join(' · ')}</p> : null}
                <div className={styles['hover-actions']}>
                    {trailer !== null ? (
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
                    <button type="button" className={classnames(styles['mc-btn'], styles['mc-btn-ghost'])} onClick={openDetails}>
                        {t('MC_MORE_INFO', { defaultValue: 'Plus d’infos' })}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default HoverPreview;
