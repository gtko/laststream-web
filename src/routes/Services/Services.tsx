// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import classNames from 'classnames';
import Icon from '@stremio/stremio-icons/react';
import { Button, Image, MainNavBars } from 'stremio/components';
import { useLastAddon } from 'stremio/common/lastAddon';
import { withCoreSuspender } from 'stremio/common';
import useGoBack from 'stremio/router/useGoBack';
import {
    catalogRows,
    loadCatalogRow,
    loadServices,
    metaDetailsPath,
} from './servicesData';
import type { CatalogItem, CatalogRowDef, CatalogType, StreamingService } from './servicesData';
import styles from './Services.less';

type ServicesState =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready', services: StreamingService[] };

const useStreamingServices = (enabled: boolean): ServicesState => {
    const [state, setState] = useState<ServicesState>({ status: 'loading' });

    useEffect(() => {
        if (!enabled) return undefined;

        let cancelled = false;
        setState({ status: 'loading' });
        loadServices()
            .then((services) => {
                if (!cancelled) setState({ status: 'ready', services });
            })
            .catch(() => {
                if (!cancelled) setState({ status: 'error' });
            });

        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return state;
};

const useOpenCatalogTitle = () => {
    const navigate = useNavigate();
    const [pending, setPending] = useState<string | null>(null);
    const [failed, setFailed] = useState<string | null>(null);

    const open = useCallback(async (item: CatalogItem) => {
        const key = `${item.type}:${item.tmdbId}`;
        setPending(key);
        setFailed(null);
        try {
            const path = await metaDetailsPath(item.type, item.tmdbId);
            if (path) {
                navigate(path);
            } else {
                setFailed(key);
            }
        } catch {
            setFailed(key);
        } finally {
            setPending(null);
        }
    }, [navigate]);

    return { open, pending, failed };
};

const LastAddonCta = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <div className={styles['cta']} role={'status'}>
            <h2 className={styles['cta-title']}>{t('LASTADDON_NOT_CONFIGURED_TITLE', { defaultValue: 'LastAddon n’est pas configuré' })}</h2>
            <p className={styles['cta-text']}>
                {t('LASTADDON_NOT_CONFIGURED_TEXT', { defaultValue: 'Renseigne l’adresse et la configuration LastAddon dans les réglages pour afficher cette page.' })}
            </p>
            <Button className={styles['cta-button']} onClick={() => navigate('/settings')}>
                {t('LASTADDON_OPEN_SETTINGS', { defaultValue: 'Ouvrir les réglages' })}
            </Button>
        </div>
    );
};

const CatalogCard = ({ item, pending, failed, onOpen }: {
    item: CatalogItem,
    pending: boolean,
    failed: boolean,
    onOpen: (item: CatalogItem) => void,
}) => {
    const { t } = useTranslation();
    const typeLabel = item.type === 'tv'
        ? t('MEDIA_TYPE_SERIES', { defaultValue: 'Série' })
        : t('MEDIA_TYPE_MOVIE', { defaultValue: 'Film' });

    return (
        <button
            type={'button'}
            className={classNames(styles['catalog-card'], { [styles['busy']]: pending })}
            title={item.name}
            aria-label={`${item.name}, ${typeLabel}`}
            aria-busy={pending}
            onClick={() => onOpen(item)}
        >
            <div className={styles['catalog-poster']}>
                <Image
                    className={styles['catalog-poster-image']}
                    src={item.poster ?? undefined}
                    alt={' '}
                    renderFallback={() => (
                        <div className={styles['catalog-poster-fallback']}>
                            <Icon name={item.type === 'tv' ? 'series' : 'movies'} />
                        </div>
                    )}
                />
            </div>
            <div className={styles['catalog-name']}>{item.name}</div>
            {failed ? <div className={styles['catalog-failed']}>{t('TITLE_UNAVAILABLE', { defaultValue: 'Fiche indisponible' })}</div> : null}
        </button>
    );
};

type CatalogRowProps = {
    providerIds: number[],
    type: CatalogType,
    row: CatalogRowDef,
    pendingKey: string | null,
    failedKey: string | null,
    onOpen: (item: CatalogItem) => void,
};

// Chargement paresseux : une rangée n'interroge TMDB qu'en approchant de l'écran.
const CatalogRow = ({ providerIds, type, row, pendingKey, failedKey, onOpen }: CatalogRowProps) => {
    const { t } = useTranslation();
    const sectionRef = useRef<HTMLElement>(null);
    const [visible, setVisible] = useState(false);
    const [items, setItems] = useState<CatalogItem[] | null>(null);
    const [failed, setFailed] = useState(false);
    const providerIdsKey = providerIds.join('|');

    useEffect(() => {
        const element = sectionRef.current;
        if (!element || visible) return undefined;
        if (typeof IntersectionObserver === 'undefined') {
            setVisible(true);
            return undefined;
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '300px 0px' });
        observer.observe(element);

        return () => observer.disconnect();
    }, [visible]);

    useEffect(() => {
        if (!visible) return undefined;

        let cancelled = false;
        loadCatalogRow(providerIdsKey.split('|').map(Number), type, row)
            .then((result) => {
                if (!cancelled) setItems(result);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });

        return () => {
            cancelled = true;
        };
    }, [visible, type, row, providerIdsKey]);

    if (items && items.length === 0) return null;

    return (
        <section ref={sectionRef} className={styles['row-section']} aria-label={t(row.key, { defaultValue: row.defaultValue })}>
            <h2 className={styles['section-title']}>{t(row.key, { defaultValue: row.defaultValue })}</h2>
            <div className={styles['row']}>
                {
                    failed ?
                        <p className={styles['row-message']} role={'status'}>
                            {t('SERVICE_ROW_ERROR', { defaultValue: 'Cette rangée n’a pas pu être chargée.' })}
                        </p>
                        : items === null ?
                            Array.from({ length: 6 }, (_, index) => <div key={index} className={styles['catalog-skeleton']} />)
                            :
                            items.map((item) => (
                                <CatalogCard
                                    key={`${item.type}:${item.tmdbId}`}
                                    item={item}
                                    pending={pendingKey === `${item.type}:${item.tmdbId}`}
                                    failed={failedKey === `${item.type}:${item.tmdbId}`}
                                    onOpen={onOpen}
                                />
                            ))
                }
            </div>
        </section>
    );
};

const ServicesIndex = () => {
    const { t } = useTranslation();
    const { configured } = useLastAddon();
    const state = useStreamingServices(configured);

    const renderContent = () => {
        if (!configured) return <LastAddonCta />;
        if (state.status === 'loading') {
            return <p className={styles['message']} role={'status'} aria-busy={'true'}>{t('SERVICES_LOADING', { defaultValue: 'Chargement…' })}</p>;
        }
        if (state.status === 'error') {
            return (
                <p className={styles['message']} role={'alert'}>
                    {t('SERVICES_ERROR', { defaultValue: 'Les services de streaming n’ont pas pu être chargés.' })}
                </p>
            );
        }
        return (
            <div className={styles['services-grid']}>
                {state.services.map((service) => (
                    <Button
                        key={service.slug}
                        className={classNames(styles['service-tile'], { [styles['outline']]: service.outline })}
                        href={`#/service/${encodeURIComponent(service.slug)}`}
                        title={service.name}
                    >
                        <span className={styles['service-tile-inner']} style={{ '--svc': service.color } as React.CSSProperties}>
                            {
                                service.logo ?
                                    <img src={service.logo} alt={service.name} loading={'lazy'} decoding={'async'} />
                                    :
                                    <span className={styles['service-name']}>{service.name}</span>
                            }
                        </span>
                    </Button>
                ))}
            </div>
        );
    };

    return (
        <article className={styles['services-page']} aria-labelledby={'services-title'}>
            <header className={styles['page-head']}>
                <p className={styles['eyebrow']}>{t('SERVICES_EYEBROW', { defaultValue: 'Disponibles en France' })}</p>
                <h1 id={'services-title'} className={styles['page-title']}>
                    {t('SERVICES_TITLE', { defaultValue: 'Services de streaming' })}
                </h1>
            </header>
            {renderContent()}
        </article>
    );
};

const ServiceDetail = ({ slug }: { slug: string }) => {
    const { t } = useTranslation();
    const goBack = useGoBack();
    const { configured } = useLastAddon();
    const state = useStreamingServices(configured);
    const [type, setType] = useState<CatalogType>('movie');
    const { open, pending, failed } = useOpenCatalogTitle();

    const service = useMemo(
        () => (state.status === 'ready' ? state.services.find((candidate) => candidate.slug === slug) : undefined),
        [state, slug],
    );
    const rows = useMemo(() => catalogRows(type), [type]);

    if (!configured) return <LastAddonCta />;
    if (state.status === 'loading') {
        return <p className={styles['message']} role={'status'} aria-busy={'true'}>{t('SERVICES_LOADING', { defaultValue: 'Chargement…' })}</p>;
    }
    if (state.status === 'error') {
        return (
            <p className={styles['message']} role={'alert'}>
                {t('SERVICES_ERROR', { defaultValue: 'Les services de streaming n’ont pas pu être chargés.' })}
            </p>
        );
    }
    if (!service) {
        return (
            <div className={styles['message']} role={'alert'}>
                <p>{t('SERVICE_NOT_FOUND', { defaultValue: 'Service introuvable.' })}</p>
                <Button className={styles['back-button']} onClick={goBack}>{t('SERVICE_BACK', { defaultValue: 'Retour' })}</Button>
            </div>
        );
    }

    return (
        <article className={styles['services-page']} aria-labelledby={'service-title'}>
            <header className={styles['service-head']} style={{ '--svc': service.color } as React.CSSProperties}>
                {service.logo ? <img className={styles['service-logo']} src={service.logo} alt={''} /> : null}
                <div className={styles['service-head-text']}>
                    <p className={styles['eyebrow']}>{t('SERVICES_TITLE', { defaultValue: 'Services de streaming' })}</p>
                    <h1 id={'service-title'} className={styles['page-title']} tabIndex={-1}>
                        {t('SERVICE_AVAILABLE_ON', { defaultValue: 'Disponible sur {{name}}', name: service.name })}
                    </h1>
                    <div className={styles['pills']} role={'group'} aria-label={t('SERVICE_TYPE_LABEL', { defaultValue: 'Type de contenu' })}>
                        <button
                            type={'button'}
                            className={classNames(styles['pill'], { [styles['selected']]: type === 'movie' })}
                            aria-pressed={type === 'movie'}
                            onClick={() => setType('movie')}
                        >
                            {t('PERSON_FILTER_MOVIES', { defaultValue: 'Films' })}
                        </button>
                        <button
                            type={'button'}
                            className={classNames(styles['pill'], { [styles['selected']]: type === 'tv' })}
                            aria-pressed={type === 'tv'}
                            onClick={() => setType('tv')}
                        >
                            {t('PERSON_FILTER_SERIES', { defaultValue: 'Séries' })}
                        </button>
                    </div>
                </div>
            </header>
            <div className={styles['rows']}>
                {rows.map((row) => (
                    <CatalogRow
                        key={`${service.slug}:${type}:${row.key}`}
                        providerIds={service.ids}
                        type={type}
                        row={row}
                        pendingKey={pending}
                        failedKey={failed}
                        onOpen={open}
                    />
                ))}
            </div>
        </article>
    );
};

const Services = () => {
    const { slug } = useParams();

    return (
        <MainNavBars className={styles['services-container']} route={'services'}>
            <div className={classNames(styles['services-content'], 'animation-fade-in')}>
                {slug ? <ServiceDetail slug={slug} /> : <ServicesIndex />}
            </div>
        </MainNavBars>
    );
};

const ServicesFallback = () => (
    <MainNavBars className={styles['services-container']} route={'services'} />
);

export default withCoreSuspender(Services, ServicesFallback);
