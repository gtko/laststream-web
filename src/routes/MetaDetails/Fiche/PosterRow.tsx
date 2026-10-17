// Copyright (C) 2017-2026 Smart code 203358507

import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { imdbFromTmdb } from 'stremio/common/lastAddon';
import Section from './Section';
import type { FicheTmdbPoster, TmdbKind } from './types';
import styles from './styles.less';

// Les titres TMDB n'ont pas d'identifiant IMDb dans leur réponse : on le demande pour chaque affiche
// (mis en cache côté LastAddon). Sans identifiant, l'affiche reste visible sans lien.
const useImdbId = (kind: TmdbKind, tmdbId: number): string | null => {
    const [imdbId, setImdbId] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        imdbFromTmdb(kind, tmdbId)
            .then((id) => {
                if (active) setImdbId(id);
            })
            .catch(() => {
                // Affiche sans lien.
            });
        return () => {
            active = false;
        };
    }, [kind, tmdbId]);

    return imdbId;
};

const PosterTile = ({ item }: { item: FicheTmdbPoster }) => {
    const imdbId = useImdbId(item.kind, item.tmdbId);
    const content = (
        <>
            <span className={classNames(styles['poster'], item.poster === '' && styles['no-image'])}>
                {item.poster !== '' && <img src={item.poster} alt="" loading="lazy" decoding="async" />}
            </span>
            <span className={styles['poster-title']}>{item.title}</span>
            {item.year !== '' && <span className={styles['poster-year']}>{item.year}</span>}
        </>
    );

    return (
        <li className={styles['poster-item']}>
            {imdbId !== null ? (
                <a className={styles['poster-link']} href={`#/metadetails/${item.kind === 'tv' ? 'series' : 'movie'}/${imdbId}`}>
                    {content}
                </a>
            ) : (
                <span className={styles['poster-link']}>{content}</span>
            )}
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
