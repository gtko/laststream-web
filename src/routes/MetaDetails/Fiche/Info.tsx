// Copyright (C) 2017-2026 Smart code 203358507

import React, { useState } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import Icon from '@stremio/stremio-icons/react';
import type { FicheData } from './useFicheData';
import { formatMinutes, formatDate, isFutureDate, ratingChips } from './format';
import Providers from './Providers';
import type { FicheMeta } from './types';
import styles from './styles.less';

const SYNOPSIS_CLAMP_LENGTH = 150;

type Props = {
    meta: FicheMeta;
    data: FicheData;
    inLibrary: boolean;
    onToggleLibrary: () => void;
    onPlay: () => void;
    onTrailer: (() => void) | null;
};

const Info = ({ meta, data, inLibrary, onToggleLibrary, onPlay, onTrailer }: Props) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const tmdb = data.tmdb;
    const logo = tmdb?.logo || meta.logo || '';
    const year = tmdb?.year || meta.releaseInfo || '';
    const certRaw = tmdb?.cert ?? '';
    let cert = certRaw;
    if (/^(U|TP|0)$/i.test(certRaw)) cert = t('FICHE_CERT_ALL', { defaultValue: 'Tous publics' });
    else if (/^\d+$/.test(certRaw)) cert = `-${certRaw}`;
    const genres = tmdb?.genres ?? [];
    const isTv = meta.type !== 'movie';
    const runtime = tmdb ? formatMinutes(tmdb.minutes) : (meta.runtime ?? '');
    const overview = tmdb?.overview || meta.description || '';
    const isClamped = overview.length > SYNOPSIS_CLAMP_LENGTH && !expanded;
    const upcoming = tmdb !== null && tmdb.kind === 'movie' && isFutureDate(tmdb.releaseDate);
    const chips = ratingChips(data.ratings, tmdb?.vote ?? 0);

    const seasonsLabel = (): string => {
        if (tmdb === null || tmdb.seasonCount === 0) return '';
        return t('FICHE_SEASONS', {
            defaultValue: '{{count}} saison',
            count: tmdb.seasonCount,
        });
    };

    return (
        <div className={styles['info']}>
            <h1 className={styles['title']} id="fiche-title" tabIndex={-1}>
                {logo !== '' ? <img className={styles['logo']} src={logo} alt={meta.name} /> : meta.name}
            </h1>

            <ul className={styles['meta']}>
                {year !== '' && <li>{year}</li>}
                {cert !== '' && (
                    <li>
                        <span className={styles['cert']} title={t('FICHE_CERT', { defaultValue: 'Classification France' })}>
                            {cert}
                        </span>
                    </li>
                )}
                {seasonsLabel() !== '' && <li>{seasonsLabel()}</li>}
                {!isTv && runtime !== '' && <li>{runtime}</li>}
                {genres.length > 0 && <li>{genres.slice(0, 3).join(' · ')}</li>}
            </ul>

            {upcoming && tmdb !== null && (
                <p className={styles['release']}>
                    <span>{t('FICHE_UPCOMING', { defaultValue: 'Prochainement' })}</span>
                    <strong>
                        {t('FICHE_RELEASE_ON', { defaultValue: 'Sortie le {{date}}', date: formatDate(tmdb.releaseDate) })}
                    </strong>
                </p>
            )}

            {chips.length > 0 && (
                <ul className={styles['rates']} aria-label={t('FICHE_RATINGS', { defaultValue: 'Notes' })}>
                    {chips.map((chip) => (
                        <li key={chip.key} className={styles['rate']}>
                            <span>{chip.label}</span>
                            <strong>{chip.value}</strong>
                        </li>
                    ))}
                </ul>
            )}

            <Providers providers={data.providers} />

            <div className={styles['synopsis']}>
                <p className={classNames(styles['overview'], isClamped && styles['is-clamped'])}>
                    {overview !== '' ? overview : t('FICHE_NO_SYNOPSIS', { defaultValue: 'Pas de synopsis disponible.' })}
                </p>
                {overview.length > SYNOPSIS_CLAMP_LENGTH && (
                    <button
                        type="button"
                        className={styles['link']}
                        aria-expanded={expanded}
                        onClick={() => setExpanded((value) => !value)}
                    >
                        {expanded ? t('FICHE_LESS', { defaultValue: 'Moins' }) : t('FICHE_MORE', { defaultValue: 'Plus' })}
                    </button>
                )}
            </div>

            {data.why !== '' && (
                <div className={styles['why']}>
                    <p className={styles['why-title']}>
                        {t('FICHE_WHY', { defaultValue: 'Pourquoi tu vas aimer' })}
                        <span className={styles['ai-tag']}>{t('FICHE_AI_TAG', { defaultValue: 'IA' })}</span>
                    </p>
                    <p className={styles['why-text']}>{data.why}</p>
                </div>
            )}

            <div className={styles['actions']}>
                <button type="button" className={classNames(styles['button'], styles['primary'])} onClick={onPlay}>
                    <Icon name="play" />
                    <span>{t('FICHE_PLAY', { defaultValue: 'Lecture' })}</span>
                </button>
                {onTrailer !== null && (
                    <button type="button" className={styles['button']} onClick={onTrailer}>
                        <Icon name="trailer" />
                        <span>{t('TRAILER', { defaultValue: 'Bande-annonce' })}</span>
                    </button>
                )}
                <button
                    type="button"
                    className={styles['round']}
                    aria-pressed={inLibrary}
                    aria-label={inLibrary
                        ? t('REMOVE_FROM_LIB', { defaultValue: 'Retirer de la bibliothèque' })
                        : t('ADD_TO_LIB', { defaultValue: 'Ajouter à la bibliothèque' })}
                    title={inLibrary
                        ? t('REMOVE_FROM_LIB', { defaultValue: 'Retirer de la bibliothèque' })
                        : t('ADD_TO_LIB', { defaultValue: 'Ajouter à la bibliothèque' })}
                    onClick={onToggleLibrary}
                >
                    <Icon name={inLibrary ? 'remove-from-library' : 'add-to-library'} />
                </button>
            </div>
        </div>
    );
};

export default Info;
