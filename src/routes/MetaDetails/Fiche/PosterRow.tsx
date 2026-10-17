// Copyright (C) 2017-2026 Smart code 203358507

import React, { useState } from 'react';
import classNames from 'classnames';
import { useNavigate } from 'react-router';
import { imdbFromTmdb } from 'stremio/common/lastAddon';
import Section from './Section';
import type { FicheTmdbPoster } from './types';
import styles from './styles.less';

type Status = 'idle' | 'loading' | 'missing';

// Les titres TMDB n'ont pas d'identifiant IMDb dans leur réponse. Il n'est demandé qu'au survol, au focus ou au clic
// (mis en cache côté LastAddon), jamais pour toutes les affiches de la rangée à l'ouverture de la fiche.
const PosterTile = ({ item }: { item: FicheTmdbPoster }) => {
    const navigate = useNavigate();
    const [imdbId, setImdbId] = useState<string | null>(null);
    const [status, setStatus] = useState<Status>('idle');

    const resolve = async (): Promise<string | null> => {
        if (imdbId !== null) return imdbId;
        setStatus('loading');
        try {
            const id = await imdbFromTmdb(item.kind, item.tmdbId);
            setImdbId(id);
            setStatus(id === null ? 'missing' : 'idle');
            return id;
        } catch {
            setStatus('idle');
            return null;
        }
    };

    const prefetch = () => {
        if (imdbId === null && status === 'idle') void resolve();
    };

    const open = () => {
        void resolve().then((id) => {
            if (id !== null) navigate(`/metadetails/${item.kind === 'tv' ? 'series' : 'movie'}/${id}`);
        });
    };

    return (
        <li className={styles['poster-item']}>
            <button
                type="button"
                className={styles['poster-link']}
                disabled={status === 'missing'}
                onClick={open}
                onMouseEnter={prefetch}
                onFocus={prefetch}
            >
                <span className={classNames(styles['poster'], item.poster === '' && styles['no-image'])}>
                    {item.poster !== '' && <img src={item.poster} alt="" loading="lazy" decoding="async" />}
                </span>
                <span className={styles['poster-title']}>{item.title}</span>
                {item.year !== '' && <span className={styles['poster-year']}>{item.year}</span>}
            </button>
        </li>
    );
};

type Props = {
    id: string;
    title: string;
    items: FicheTmdbPoster[];
};

const PosterRow = ({ id, title, items }: Props) => (
    <Section id={id} title={title}>
        <ul className={styles['row']}>
            {items.map((item) => (
                <PosterTile key={`${item.kind}:${item.tmdbId}`} item={item} />
            ))}
        </ul>
    </Section>
);

export default PosterRow;
