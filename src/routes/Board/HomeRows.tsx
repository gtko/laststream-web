// Copyright (C) 2017-2026 Smart code 203358507

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useModelState } from 'stremio/common';
import Button from 'stremio/components/Button';
import { Hero, Row, Tile, mapCoreItem } from 'stremio/components/MediaCenter';
import type { CoreMediaItem, MediaItem } from 'stremio/components/MediaCenter';
import useContinueWatchingPreview from './useContinueWatchingPreview';
import {
    loadChannels,
    loadHero,
    loadRecommend,
    loadTmdbRow,
    loadTop10,
    loadUpcoming,
    useAsyncData,
} from './homeData';
import styles from './styles.less';

const LIBRARY_ACTION = {
    action: 'Load',
    args: {
        model: 'LibraryWithFilters',
        args: { request: { type: null, sort: undefined } },
    },
};

const SERVICES = [
    { slug: 'netflix', label: 'Netflix', color: '#E50914' },
    { slug: 'prime-video', label: 'Prime Video', color: '#00A8E1' },
    { slug: 'disney-plus', label: 'Disney+', color: '#113CCF' },
    { slug: 'canal-plus', label: 'Canal+', color: '#000000' },
    { slug: 'apple-tv-plus', label: 'Apple TV+', color: '#1D1D1F' },
    { slug: 'max', label: 'Max', color: '#002BE7' },
    { slug: 'paramount-plus', label: 'Paramount+', color: '#0064FF' },
    { slug: 'crunchyroll', label: 'Crunchyroll', color: '#F47521' },
];

/** Bibliothèque Stremio (cœur, sans LastAddon). Vide tant que rien n’est chargé. */
export const useCoreLibrary = (): MediaItem[] => {
    const library = useModelState({ model: 'library', action: LIBRARY_ACTION }) as { catalog?: CoreMediaItem[] } | null;
    return useMemo(() => (library?.catalog ?? []).slice(0, 30).map(mapCoreItem), [library]);
};

/** Reprendre la lecture (cœur, sans LastAddon). */
const useCoreContinueWatching = (): MediaItem[] => {
    const preview = useContinueWatchingPreview() as { items?: CoreMediaItem[] } | null;
    return useMemo(() => (preview?.items ?? []).slice(0, 20).map(mapCoreItem), [preview]);
};

/** Appel à configurer LastAddon : affiché à la place de la mise en avant quand il manque. */
export const ConfigCta = () => {
    const { t } = useTranslation();
    return (
        <section className={styles['cta-card']} aria-labelledby="board-cta-title">
            <h2 id="board-cta-title" className={styles['cta-title']}>
                {t('MC_CTA_TITLE', { defaultValue: 'Active l’accueil complet' })}
            </h2>
            <p className={styles['cta-text']}>
                {t('MC_CTA_TEXT', { defaultValue: 'Connecte LastAddon dans les réglages pour afficher la mise en avant, les notes, les recommandations et les chaînes en direct.' })}
            </p>
            <Button className={styles['cta-button']} href="#/settings" title={t('MC_CTA_BUTTON', { defaultValue: 'Ouvrir les réglages' })}>
                {t('MC_CTA_BUTTON', { defaultValue: 'Ouvrir les réglages' })}
            </Button>
        </section>
    );
};

export const HomeHero = () => {
    const { t } = useTranslation();
    const state = useAsyncData('hero', loadHero);
    if (state.status === 'error' || (state.status === 'ready' && state.data === null)) return null;
    const data = state.data;
    return (
        <Hero
            key={data?.item.key ?? 'hero-loading'}
            item={data?.item ?? null}
            detail={data?.detail ?? null}
            eyebrow={t('MC_HERO_EYEBROW', { defaultValue: 'Tendance cette semaine' })}
        />
    );
};

export const ContinueRow = () => {
    const { t } = useTranslation();
    const items = useCoreContinueWatching();
    if (items.length === 0) return null;
    return (
        <Row title={t('MC_ROW_CONTINUE', { defaultValue: 'Reprendre la lecture' })}>
            {items.map((item) => <Tile key={item.key} item={item} variant="landscape" />)}
        </Row>
    );
};

export const LibraryRow = ({ items }: { items: MediaItem[] }) => {
    const { t } = useTranslation();
    if (items.length === 0) return null;
    return (
        <Row title={t('MC_ROW_LIBRARY', { defaultValue: 'Ma bibliothèque' })} seeAll={{ href: '#/library', label: t('MC_SEE_ALL', { defaultValue: 'Tout voir' }) }}>
            {items.map((item) => <Tile key={item.key} item={item} />)}
        </Row>
    );
};

export const AiRow = ({ history }: { history: MediaItem[] }) => {
    const { t } = useTranslation();
    const key = history.length > 0 ? `ai:${history.slice(0, 20).map((item) => item.key).join(',')}` : null;
    const state = useAsyncData(key, () => loadRecommend(history));
    if (key === null) return null;
    if (state.status === 'error' || (state.status === 'ready' && (state.data ?? []).length === 0)) return null;
    return (
        <Row
            title={t('MC_ROW_AI', { defaultValue: 'Recommandé pour toi par l’IA' })}
            loading={state.status === 'loading'}
        >
            {(state.data ?? []).map((item) => <Tile key={item.key} item={item} />)}
        </Row>
    );
};

export const Top10Row = () => {
    const { t } = useTranslation();
    const state = useAsyncData('top10', loadTop10);
    return (
        <Row
            title={t('MC_ROW_TOP10', { defaultValue: 'Top 10 aujourd’hui' })}
            loading={state.status === 'loading'}
            error={state.status === 'error'}
            empty={state.status === 'ready' && (state.data ?? []).length === 0}
        >
            {(state.data ?? []).map((item, index) => <Tile key={item.key} item={item} rank={index + 1} />)}
        </Row>
    );
};

export const UpcomingRow = () => {
    const { t } = useTranslation();
    const state = useAsyncData('upcoming', loadUpcoming);
    if (state.status === 'error' || (state.status === 'ready' && (state.data ?? []).length === 0)) return null;
    return (
        <Row
            title={t('MC_ROW_UPCOMING', { defaultValue: 'Prochainement' })}
            loading={state.status === 'loading'}
            landscape
        >
            {(state.data ?? []).map((item) => <Tile key={item.key} item={item} variant="landscape" />)}
        </Row>
    );
};

export const LiveRow = () => {
    const { t } = useTranslation();
    const state = useAsyncData('live', loadChannels);
    if (state.status === 'error' || (state.status === 'ready' && (state.data ?? []).length === 0)) return null;
    return (
        <Row
            title={t('MC_ROW_LIVE', { defaultValue: 'En direct' })}
            seeAll={{ href: '#/tv-live', label: t('MC_SEE_ALL', { defaultValue: 'Tout voir' }) }}
            loading={state.status === 'loading'}
            landscape
        >
            {(state.data ?? []).map((item) => (
                <Tile key={item.key} item={item} variant="landscape" imageFit="contain" preview={false} />
            ))}
        </Row>
    );
};

type TmdbRowProps = {
    id: string,
    title: string,
    path: string,
    params?: Record<string, string>,
    forcedType: 'movie' | 'tv',
};

export const TmdbRow = ({ id, title, path, params, forcedType }: TmdbRowProps) => {
    const state = useAsyncData(id, () => loadTmdbRow(path, params, forcedType));
    return (
        <Row
            title={title}
            loading={state.status === 'loading'}
            error={state.status === 'error'}
            empty={state.status === 'ready' && (state.data ?? []).length === 0}
        >
            {(state.data ?? []).map((item) => <Tile key={item.key} item={item} />)}
        </Row>
    );
};

export const ServicesRow = () => {
    const { t } = useTranslation();
    return (
        <Row title={t('MC_ROW_SERVICES', { defaultValue: 'Services de streaming' })} seeAll={{ href: '#/services', label: t('MC_SEE_ALL', { defaultValue: 'Tout voir' }) }}>
            {SERVICES.map((service) => (
                <Button
                    key={service.slug}
                    className={styles['service-tile']}
                    href="#/services"
                    title={service.label}
                    style={{ '--service-color': service.color } as React.CSSProperties}
                >
                    <span className={styles['service-name']}>{service.label}</span>
                </Button>
            ))}
        </Row>
    );
};

// Marge de déclenchement : une rangée se charge un peu avant d’entrer dans le champ.
const LAZY_ROOT_MARGIN = '400px 0px';

/** Vrai dès que l’élément approche de la fenêtre, puis reste vrai (pas de rechargement en remontant). */
const useNearViewport = (ref: React.RefObject<HTMLDivElement>): boolean => {
    const [near, setNear] = useState(typeof IntersectionObserver === 'undefined');
    useEffect(() => {
        const node = ref.current;
        if (near || !node) return undefined;
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            setNear(true);
            observer.disconnect();
        }, { rootMargin: LAZY_ROOT_MARGIN });
        observer.observe(node);
        return () => observer.disconnect();
    }, [near, ref]);
    return near;
};

/**
 * Rangée LastAddon montée seulement quand elle approche de l’écran : aucune requête pour les rangées hors champ
 * (LastAddon limite à 120 requêtes GET/min/IP). Hors champ, le conteneur reste à hauteur nulle.
 */
const LazyRow = ({ children }: { children: React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);
    const near = useNearViewport(ref);
    return <div ref={ref}>{near ? children : null}</div>;
};

/** Ensemble des rangées de l’accueil, dans l’ordre : core d’abord, puis LastAddon (si configuré), puis services. */
export const HomeRows = ({ configured }: { configured: boolean }) => {
    const { t } = useTranslation();
    const library = useCoreLibrary();
    return (
        <>
            {configured ? <HomeHero /> : <ConfigCta />}
            <ContinueRow />
            <LibraryRow items={library} />
            {configured && library.length > 0 ? <LazyRow><AiRow history={library} /></LazyRow> : null}
            {configured ? <LazyRow><Top10Row /></LazyRow> : null}
            {configured ? <LazyRow><UpcomingRow /></LazyRow> : null}
            {configured ? <LazyRow><LiveRow /></LazyRow> : null}
            {configured ? (
                <>
                    <LazyRow>
                        <TmdbRow id="films" title={t('MC_ROW_FILMS', { defaultValue: 'Films populaires' })} path="movie/popular" forcedType="movie" />
                    </LazyRow>
                    <LazyRow>
                        <TmdbRow id="series" title={t('MC_ROW_SERIES', { defaultValue: 'Séries populaires' })} path="tv/popular" forcedType="tv" />
                    </LazyRow>
                    <LazyRow>
                        <TmdbRow
                            id="action"
                            title={t('MC_ROW_ACTION', { defaultValue: 'Action' })}
                            path="discover/movie"
                            params={{ with_genres: '28', sort_by: 'popularity.desc' }}
                            forcedType="movie"
                        />
                    </LazyRow>
                    <LazyRow>
                        <TmdbRow
                            id="comedy"
                            title={t('MC_ROW_COMEDY', { defaultValue: 'Comédie' })}
                            path="discover/movie"
                            params={{ with_genres: '35', sort_by: 'popularity.desc' }}
                            forcedType="movie"
                        />
                    </LazyRow>
                </>
            ) : null}
            <ServicesRow />
        </>
    );
};
