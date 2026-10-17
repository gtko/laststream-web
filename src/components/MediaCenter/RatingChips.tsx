// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import type { MdblistRatings } from 'stremio/common/lastAddon';
import styles from './styles.less';

type Props = {
    ratings: MdblistRatings | null,
    fallbackTmdb?: number | null,
    compact?: boolean,
};

// Noms de marque des sources : non traduits.
const IMDB_BADGE = 'IMDb';
const TMDB_BADGE = 'TMDB';

const percent = (value: number): string => `${Math.round(value)} %`;

const TomatoIcon = ({ value }: { value: number }) => (
    <svg className={styles['ri']} viewBox="0 0 24 24" aria-hidden="true">
        {value >= 60 ? (
            <>
                <circle cx="12" cy="14" r="8.6" fill="#FA320A" />
                <path d="M12 7.2c-.9-2.3-3.1-3-4.9-2 1.2.2 2 .9 2.4 1.9-1.5-.5-3.1-.1-4 1 2.2.4 3.6.2 4.5-.6.5.9 1.1 1 2 1zM12 7.2c.9-2.3 3.1-3 4.9-2-1.2.2-2 .9-2.4 1.9 1.5-.5 3.1-.1 4 1-2.2.4-3.6.2-4.5-.6z" fill="#0AC855" />
            </>
        ) : (
            <path fill="#0AC855" d="M12 2.5c1.6 0 2.1 2.1 3.3 2.8 1.5.8 4-.2 4.6 1.5.6 1.6-1.5 2.8-1.5 4.4s2.3 3.1 1.3 4.6c-1 1.5-3.5.3-4.6 1.4-1.1 1.1-.5 3.7-2.3 4.1-1.7.4-2.6-1.8-4.2-2.3-1.6-.5-4 .8-4.9-.8-.8-1.6 1.2-3.1 1.1-4.7-.1-1.6-2.3-2.7-1.5-4.2.8-1.5 3.2-.5 4.5-1.5 1.2-.9 1-3.4 3.2-4.3z" />
        )}
    </svg>
);

const PopcornIcon = ({ value }: { value: number }) => (
    <svg className={styles['ri']} viewBox="0 0 24 24" aria-hidden="true">
        {value >= 60 ? (
            <>
                <circle cx="8" cy="8.5" r="2.8" fill="#FFF1C9" />
                <circle cx="12" cy="6.5" r="3.2" fill="#FFE8A3" />
                <circle cx="16" cy="8.5" r="2.8" fill="#FFF1C9" />
                <path d="M5.5 10h13l-1.6 11.5H7.1z" fill="#FA320A" />
                <path d="M10 10l.5 11.5M14 10l-.5 11.5" stroke="#fff" strokeWidth="1.3" />
            </>
        ) : (
            <>
                <g transform="rotate(-32 12 14)">
                    <path d="M5.5 10h13l-1.6 11.5H7.1z" fill="#0AC855" />
                    <path d="M10 10l.5 11.5M14 10l-.5 11.5" stroke="#0c0b11" strokeOpacity=".35" strokeWidth="1.3" />
                </g>
                <circle cx="19" cy="18.5" r="1.6" fill="#B8F5CF" />
                <circle cx="16.5" cy="21" r="1.3" fill="#B8F5CF" />
            </>
        )}
    </svg>
);

const LetterboxdIcon = () => (
    <svg className={classnames(styles['ri'], styles['ri-wide'])} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="6.5" cy="12" r="5.5" fill="#FF8000" />
        <circle cx="17.5" cy="12" r="5.5" fill="#40BCF4" />
        <circle cx="12" cy="12" r="5.5" fill="#00E054" />
        <path d="M12 7.6a5.5 5.5 0 0 1 0 8.8 5.5 5.5 0 0 1 0-8.8z" fill="#fff" fillOpacity=".92" />
    </svg>
);

const TraktIcon = () => (
    <svg className={styles['ri']} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.5" fill="#ED1C24" />
        <path d="M7.2 12.2l3.1 3.1 6.5-6.5M10.3 15.3L7 12M12.9 8.4l-3 3" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const RatingChips = ({ ratings, fallbackTmdb, compact = false }: Props) => {
    const { t } = useTranslation();
    const r = ratings ?? null;
    const chips: React.ReactNode[] = [];
    const add = (key: string, label: string, icon: React.ReactNode, score: string) => {
        chips.push(
            <li key={key} className={classnames(styles['rate'], compact && styles['rate-compact'])} title={label}>
                <span className={styles['sr-only']}>{label} : </span>
                {icon}
                {score ? <strong>{score}</strong> : null}
            </li>
        );
    };
    if (r?.imdb !== null && r?.imdb !== undefined) {
        add('imdb', IMDB_BADGE, <span className={classnames(styles['rb'], styles['rb-imdb'])} aria-hidden="true">{IMDB_BADGE}</span>, r.imdb.toFixed(1));
    }
    if (r?.rottentomatoes !== null && r?.rottentomatoes !== undefined) {
        add('rt', 'Rotten Tomatoes', <TomatoIcon value={r.rottentomatoes} />, percent(r.rottentomatoes));
    }
    if (!compact && r?.rottentomatoes_audience !== null && r?.rottentomatoes_audience !== undefined) {
        add('rt-audience', 'Rotten Tomatoes, public', <PopcornIcon value={r.rottentomatoes_audience} />, percent(r.rottentomatoes_audience));
    }
    if (!compact && r?.metacritic !== null && r?.metacritic !== undefined) {
        const value = Math.round(r.metacritic);
        const tone = value >= 61 ? styles['mc-g'] : value >= 40 ? styles['mc-y'] : styles['mc-r'];
        add('metacritic', 'Metacritic', <span className={classnames(styles['rb-mc'], tone)} aria-hidden="true">{value}</span>, '');
    }
    if (!compact && r?.letterboxd !== null && r?.letterboxd !== undefined) {
        add('letterboxd', 'Letterboxd', <LetterboxdIcon />, r.letterboxd.toFixed(1));
    }
    const tmdbScore = r?.tmdb ?? fallbackTmdb ?? null;
    if ((!compact || chips.length === 0) && tmdbScore !== null) {
        add('tmdb', TMDB_BADGE, <span className={classnames(styles['rb'], styles['rb-tmdb'])} aria-hidden="true">{TMDB_BADGE}</span>, percent(tmdbScore));
    }
    if (!compact && r?.trakt !== null && r?.trakt !== undefined) {
        add('trakt', 'Trakt', <TraktIcon />, percent(r.trakt));
    }
    if (chips.length === 0) return null;
    return (
        <ul className={styles['rates']} aria-label={t('MC_RATINGS', { defaultValue: 'Notes' })}>
            {chips}
        </ul>
    );
};

export default RatingChips;
