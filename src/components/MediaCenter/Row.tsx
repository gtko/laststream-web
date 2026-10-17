// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import Button from 'stremio/components/Button';
import { setRowDragging } from './dragState';
import { prefersReducedMotion } from './format';
import { ChevronIcon } from './icons';
import styles from './styles.less';

const DRAG_THRESHOLD_PX = 6;
const SKELETON_COUNT = 6;

export type RowProps = {
    title: string,
    children?: React.ReactNode,
    seeAll?: { href: string, label: string } | null,
    loading?: boolean,
    error?: boolean,
    empty?: boolean,
    landscape?: boolean,
    className?: string,
};

type ScrollerProps = {
    children?: React.ReactNode,
};

/**
 * Défilement horizontal d’une rangée : glisser à la souris (pointer events), flèches au survol.
 * La molette verticale n’est jamais interceptée, et le tactile garde son défilement natif.
 */
const RowScroller = ({ children }: ScrollerProps) => {
    const { t } = useTranslation();
    const scrollerRef = useRef<HTMLDivElement>(null);
    const drag = useRef<{ x: number, left: number, moved: boolean } | null>(null);
    const suppressClick = useRef(false);
    const [canPrev, setCanPrev] = useState(false);
    const [canNext, setCanNext] = useState(false);
    const [dragging, setDragging] = useState(false);

    const updateArrows = useCallback(() => {
        const node = scrollerRef.current;
        if (!node) return;
        const max = node.scrollWidth - node.clientWidth;
        setCanPrev(node.scrollLeft > 2);
        setCanNext(max > 2 && node.scrollLeft < max - 2);
    }, []);

    useEffect(() => {
        const node = scrollerRef.current;
        if (!node) return undefined;
        updateArrows();
        const onMove = (event: PointerEvent) => {
            const state = drag.current;
            const element = scrollerRef.current;
            if (!state || !element) return;
            const dx = event.clientX - state.x;
            if (!state.moved && Math.abs(dx) > DRAG_THRESHOLD_PX) {
                state.moved = true;
                setRowDragging(true);
                setDragging(true);
            }
            if (state.moved) {
                element.scrollLeft = state.left - dx;
                event.preventDefault();
            }
        };
        const onUp = () => {
            const state = drag.current;
            drag.current = null;
            if (!state) return;
            if (state.moved) {
                suppressClick.current = true;
                window.setTimeout(() => {
                    suppressClick.current = false;
                }, 0);
            }
            setRowDragging(false);
            setDragging(false);
        };
        const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateArrows);
        resizeObserver?.observe(node);
        const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(updateArrows);
        mutationObserver?.observe(node, { childList: true });
        node.addEventListener('scroll', updateArrows, { passive: true });
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            resizeObserver?.disconnect();
            mutationObserver?.disconnect();
            node.removeEventListener('scroll', updateArrows);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [updateArrows]);

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        const node = scrollerRef.current;
        if (!node || event.pointerType !== 'mouse' || event.button !== 0) return;
        if (node.scrollWidth <= node.clientWidth + 2) return;
        drag.current = { x: event.clientX, left: node.scrollLeft, moved: false };
    };

    const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
        if (suppressClick.current) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    const page = (direction: 1 | -1) => {
        const node = scrollerRef.current;
        if (!node) return;
        node.scrollBy({ left: direction * node.clientWidth * 0.85, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    };

    return (
        <div className={styles['row-wrap']}>
            {canPrev ? (
                <button
                    type="button"
                    className={classnames(styles['row-arrow'], styles['row-arrow-prev'])}
                    tabIndex={-1}
                    aria-label={t('MC_SCROLL_LEFT', { defaultValue: 'Faire défiler vers la gauche' })}
                    onClick={() => page(-1)}
                >
                    <ChevronIcon />
                </button>
            ) : null}
            <div
                ref={scrollerRef}
                className={classnames(styles['row'], dragging && styles['is-dragging'])}
                onPointerDown={onPointerDown}
                onClickCapture={onClickCapture}
                onDragStart={(event) => event.preventDefault()}
            >
                {children}
            </div>
            {canNext ? (
                <button
                    type="button"
                    className={classnames(styles['row-arrow'], styles['row-arrow-next'])}
                    tabIndex={-1}
                    aria-label={t('MC_SCROLL_RIGHT', { defaultValue: 'Faire défiler vers la droite' })}
                    onClick={() => page(1)}
                >
                    <ChevronIcon />
                </button>
            ) : null}
        </div>
    );
};

/** Rangée titrée de tuiles. Gère l’état chargement, erreur et vide. */
const Row = ({ title, children, seeAll, loading = false, error = false, empty = false, landscape = false, className }: RowProps) => {
    const { t } = useTranslation();
    const headingId = useId();
    let body: React.ReactNode;
    if (error) {
        body = (
            <p className={styles['row-message']} role="status">
                {t('MC_ROW_ERROR', { defaultValue: 'Cette rangée n’a pas pu être chargée.' })}
            </p>
        );
    } else if (loading) {
        body = (
            <div className={styles['row-wrap']}>
                <div className={styles['row']} aria-busy="true">
                    {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                        <span
                            key={index}
                            className={classnames(styles['row-skeleton'], landscape && styles['row-skeleton-landscape'])}
                            aria-hidden="true"
                        />
                    ))}
                </div>
            </div>
        );
    } else if (empty) {
        body = (
            <p className={styles['row-message']}>
                {t('MC_ROW_EMPTY', { defaultValue: 'Aucun contenu pour le moment.' })}
            </p>
        );
    } else {
        body = <RowScroller>{children}</RowScroller>;
    }
    return (
        <section className={classnames(styles['row-section'], className)} aria-labelledby={headingId}>
            <div className={styles['row-head']}>
                <h2 id={headingId} className={styles['row-title']}>{title}</h2>
                {seeAll ? (
                    <Button className={styles['row-see-all']} href={seeAll.href} title={seeAll.label}>
                        {seeAll.label}
                    </Button>
                ) : null}
            </div>
            {body}
        </section>
    );
};

export default Row;
