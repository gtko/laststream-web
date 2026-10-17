// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import Button from 'stremio/components/Button';
import { useLastAddon } from 'stremio/common/lastAddon';
import HoverPreview from './HoverPreview';
import { isRowDragging } from './dragState';
import { canHoverPreview, dayDiff, formatDayMonth } from './format';
import { openMediaItem } from './mediaDetail';
import type { MediaItem } from './types';
import styles from './styles.less';

const HOVER_OPEN_MS = 900;
const HOVER_CLOSE_MS = 250;

// Un seul aperçu ouvert à la fois : ouvrir une tuile ferme la précédente.
let closeOpenPreview: (() => void) | null = null;

export type TileProps = {
    item: MediaItem,
    variant?: 'poster' | 'landscape',
    rank?: number,
    imageFit?: 'cover' | 'contain',
    preview?: boolean,
    className?: string,
};

/**
 * Tuile média (affiche 2:3 ou 16:9) avec badges Top / Nouveau / Prochainement, progression et aperçu au survol.
 * Un clic ouvre la fiche : lien direct si connu, sinon résolution de l’identifiant IMDb à la demande.
 */
const Tile = ({ item, variant = 'poster', rank, imageFit = 'cover', preview = true, className }: TileProps) => {
    const { t } = useTranslation();
    const { configured } = useLastAddon();
    const navigate = useNavigate();
    const wrapRef = useRef<HTMLDivElement>(null);
    const mediaRef = useRef<HTMLSpanElement>(null);
    const openTimer = useRef<number | undefined>(undefined);
    const closeTimer = useRef<number | undefined>(undefined);
    const [noImage, setNoImage] = useState(false);
    const [anchor, setAnchor] = useState<DOMRect | null>(null);
    const landscape = variant === 'landscape';
    const image = landscape ? (item.backdrop ?? item.poster ?? null) : (item.poster ?? null);
    const href = item.href ?? null;
    const previewEnabled = preview && configured && item.type !== 'channel';

    const closePreview = useCallback(() => {
        window.clearTimeout(openTimer.current);
        window.clearTimeout(closeTimer.current);
        openTimer.current = undefined;
        closeTimer.current = undefined;
        setAnchor(null);
    }, []);

    useEffect(() => {
        if (anchor === null) return undefined;
        if (closeOpenPreview !== null) closeOpenPreview();
        closeOpenPreview = closePreview;
        return () => {
            if (closeOpenPreview === closePreview) closeOpenPreview = null;
        };
    }, [anchor, closePreview]);

    const onPointerEnter = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!previewEnabled || event.pointerType !== 'mouse' || !canHoverPreview()) return;
        window.clearTimeout(closeTimer.current);
        closeTimer.current = undefined;
        if (anchor !== null || openTimer.current !== undefined) return;
        openTimer.current = window.setTimeout(() => {
            openTimer.current = undefined;
            const media = mediaRef.current;
            if (!media || !media.isConnected || isRowDragging()) return;
            setAnchor(media.getBoundingClientRect());
        }, HOVER_OPEN_MS);
    };

    const onPointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== 'mouse') return;
        window.clearTimeout(openTimer.current);
        openTimer.current = undefined;
        if (anchor !== null && closeTimer.current === undefined) {
            closeTimer.current = window.setTimeout(closePreview, HOVER_CLOSE_MS);
        }
    };

    const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (href !== null) return;
        event.preventDefault();
        openMediaItem(item).then((target) => {
            if (target) navigate(target.slice(1));
        });
    };

    const countdownText = (days: number): string => {
        if (days <= 0) return t('MC_TODAY', { defaultValue: 'aujourd’hui' });
        if (days === 1) return t('MC_TOMORROW', { defaultValue: 'demain' });
        if (days < 61) return t('MC_IN_DAYS', { count: days, defaultValue: 'dans {{count}} jours' });
        return t('MC_IN_MONTHS', { count: Math.round(days / 30), defaultValue: 'dans {{count}} mois' });
    };

    let badge: React.ReactNode = null;
    if (item.badge === 'soon' && item.upcomingDate) {
        const date = formatDayMonth(item.upcomingDate);
        const days = dayDiff(item.upcomingDate);
        badge = (
            <>
                <span className={styles['tile-corner']} aria-hidden="true">
                    <span>{t('MC_BADGE_UPCOMING', { defaultValue: 'Prochainement' })}</span>
                </span>
                {date ? (
                    <span className={styles['tile-date']} aria-hidden="true">
                        <strong>{`${date.day} ${date.month}`}</strong>
                        <span>{countdownText(days)}</span>
                    </span>
                ) : null}
            </>
        );
    } else if (item.badge === 'new') {
        badge = (
            <span className={styles['tile-badge']}>
                {item.type === 'tv'
                    ? t('MC_BADGE_NEW_SERIES', { defaultValue: 'Nouvelle série' })
                    : t('MC_BADGE_NEW_MOVIE', { defaultValue: 'Nouveau film' })}
            </span>
        );
    } else if (item.badge === 'top') {
        badge = (
            <span className={styles['tile-ribbon']} aria-hidden="true">
                <b>{t('MC_BADGE_TOP', { defaultValue: 'Top' })}</b>
            </span>
        );
    }

    return (
        <div
            ref={wrapRef}
            className={classnames(
                styles['tile'],
                landscape && styles['tile-landscape'],
                rank !== undefined && styles['tile-ranked'],
                className,
            )}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
        >
            {rank !== undefined ? <span className={styles['tile-rank']} aria-hidden="true">{rank}</span> : null}
            <Button className={styles['tile-link']} href={href ?? undefined} title={item.name} onClick={onClick}>
                <span
                    ref={mediaRef}
                    className={classnames(
                        styles['tile-media'],
                        (image === null || noImage) && styles['no-img'],
                        imageFit === 'contain' && styles['tile-contain'],
                    )}
                >
                    {image !== null && !noImage ? (
                        <img src={image} alt="" loading="lazy" decoding="async" onError={() => setNoImage(true)} />
                    ) : null}
                    <span className={styles['tile-fallback']} aria-hidden="true">{item.name}</span>
                    {landscape ? <span className={styles['tile-shade']} aria-hidden="true" /> : null}
                    {badge}
                    {landscape ? <span className={styles['tile-title-land']}>{item.name}</span> : null}
                    {typeof item.progress === 'number' && item.progress > 0 ? (
                        <span className={styles['tile-progress']} aria-hidden="true">
                            <span style={{ width: `${Math.min(100, item.progress)}%` }} />
                        </span>
                    ) : null}
                </span>
                {landscape ? null : (
                    <>
                        <span className={styles['tile-title-poster']} aria-hidden="true">{item.name}</span>
                        {item.caption || item.year ? (
                            <span className={styles['tile-caption']} aria-hidden="true">{item.caption || item.year}</span>
                        ) : null}
                    </>
                )}
            </Button>
            {anchor !== null && previewEnabled ? (
                <HoverPreview item={item} anchor={anchor} onClose={closePreview} />
            ) : null}
        </div>
    );
};

export default Tile;
