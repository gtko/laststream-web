// Copyright (C) 2017-2026 Smart code 203358507

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import Icon from '@stremio/stremio-icons/react';
import { Image } from 'stremio/components';
import { tmdbImage } from './personData';
import type { CreditKind, FilmEntry } from './personData';
import styles from './Person.less';

const PAGE_SIZE = 80;
const KIND_ORDER: CreditKind[] = ['actor', 'director', 'writer', 'producer'];

type Filter = 'all' | 'movie' | 'tv' | CreditKind;
type Sort = 'recent' | 'popular' | 'rating';

export const TitleCard = ({ entry, caption, pending, failed, onOpen }: {
    entry: FilmEntry,
    caption?: string,
    pending: boolean,
    failed: boolean,
    onOpen: (entry: FilmEntry) => void,
}) => {
    const { t } = useTranslation();
    const poster = tmdbImage('w342', entry.poster);
    const typeLabel = entry.type === 'tv'
        ? t('MEDIA_TYPE_SERIES', { defaultValue: 'Série' })
        : t('MEDIA_TYPE_MOVIE', { defaultValue: 'Film' });

    return (
        <button
            type={'button'}
            className={classNames(styles['title-card'], { [styles['busy']]: pending })}
            title={entry.name}
            aria-label={`${entry.name}, ${typeLabel}${failed ? ` (${t('TITLE_UNAVAILABLE', { defaultValue: 'fiche indisponible' })})` : ''}`}
            aria-busy={pending}
            onClick={() => onOpen(entry)}
        >
            <div className={styles['title-poster']}>
                <Image
                    className={styles['title-poster-image']}
                    src={poster ?? undefined}
                    alt={' '}
                    renderFallback={() => (
                        <div className={styles['title-poster-fallback']}>
                            <Icon name={entry.type === 'tv' ? 'series' : 'movies'} />
                        </div>
                    )}
                />
            </div>
            <div className={styles['title-name']}>{entry.name}</div>
            {caption ? <div className={styles['title-caption']}>{caption}</div> : null}
            {failed ? <div className={styles['title-failed']}>{t('TITLE_UNAVAILABLE', { defaultValue: 'Fiche indisponible' })}</div> : null}
        </button>
    );
};

type Props = {
    films: FilmEntry[],
    pendingKey: string | null,
    failedKey: string | null,
    onOpen: (entry: FilmEntry) => void,
};

const PersonFilmography = ({ films, pendingKey, failedKey, onOpen }: Props) => {
    const { t, i18n } = useTranslation();
    const [filter, setFilter] = useState<Filter>('all');
    const [sort, setSort] = useState<Sort>('recent');
    const [limit, setLimit] = useState(PAGE_SIZE);

    const kindLabels: Record<CreditKind, string> = {
        actor: t('PERSON_ROLE_ACTING', { defaultValue: 'Acteur' }),
        director: t('PERSON_ROLE_DIRECTING', { defaultValue: 'Réalisation' }),
        writer: t('PERSON_ROLE_WRITING', { defaultValue: 'Scénario' }),
        producer: t('PERSON_ROLE_PRODUCTION', { defaultValue: 'Production' }),
        crew: t('PERSON_ROLE_CREW', { defaultValue: 'Équipe' }),
    };

    const availableKinds = useMemo(
        () => KIND_ORDER.filter((kind) => films.some((film) => film.kinds.has(kind))),
        [films],
    );

    const rows = useMemo(() => {
        let list = films.slice();
        if (filter === 'movie' || filter === 'tv') {
            list = list.filter((film) => film.type === filter);
        } else if (filter !== 'all') {
            list = list.filter((film) => film.kinds.has(filter));
        }

        if (sort === 'popular') list.sort((a, b) => b.popularity - a.popularity);
        else if (sort === 'rating') list.sort((a, b) => (b.votes >= 10 ? b.rating : 0) - (a.votes >= 10 ? a.rating : 0));
        else list.sort((a, b) => (b.date || '9999').localeCompare(a.date || '9999'));

        return list;
    }, [films, filter, sort]);

    const shown = rows.slice(0, limit);
    const filters: { id: Filter, label: string }[] = [
        { id: 'all', label: t('PERSON_FILTER_ALL', { defaultValue: 'Tout' }) },
        { id: 'movie', label: t('PERSON_FILTER_MOVIES', { defaultValue: 'Films' }) },
        { id: 'tv', label: t('PERSON_FILTER_SERIES', { defaultValue: 'Séries' }) },
        ...availableKinds.map((kind) => ({ id: kind, label: kindLabels[kind] })),
    ];
    const sorts: { id: Sort, label: string }[] = [
        { id: 'recent', label: t('PERSON_SORT_RECENT', { defaultValue: 'Récent' }) },
        { id: 'popular', label: t('PERSON_SORT_POPULAR', { defaultValue: 'Populaire' }) },
        { id: 'rating', label: t('PERSON_SORT_RATING', { defaultValue: 'Note' }) },
    ];

    const roleOf = (film: FilmEntry): string => {
        if (film.kinds.has('actor') && film.character) return film.character;
        const jobs = Array.from(film.jobs).slice(0, 2).join(', ');
        if (jobs) return jobs;
        return Array.from(film.kinds).map((kind) => kindLabels[kind]).join(', ');
    };

    return (
        <section className={styles['filmography']} aria-labelledby={'person-filmography-title'}>
            <h2 id={'person-filmography-title'} className={styles['section-title']}>
                {t('PERSON_FILMOGRAPHY', { defaultValue: 'Filmographie complète' })}
            </h2>
            <div className={styles['filmography-controls']}>
                <div className={styles['pills']} role={'group'} aria-label={t('PERSON_FILTER_LABEL', { defaultValue: 'Filtrer' })}>
                    {filters.map(({ id, label }) => (
                        <button
                            key={id}
                            type={'button'}
                            className={classNames(styles['pill'], { [styles['selected']]: filter === id })}
                            aria-pressed={filter === id}
                            onClick={() => { setFilter(id); setLimit(PAGE_SIZE); }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className={styles['pills']} role={'group'} aria-label={t('PERSON_SORT_LABEL', { defaultValue: 'Trier' })}>
                    {sorts.map(({ id, label }) => (
                        <button
                            key={id}
                            type={'button'}
                            className={classNames(styles['pill'], { [styles['selected']]: sort === id })}
                            aria-pressed={sort === id}
                            onClick={() => setSort(id)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            <ul className={styles['filmography-list']}>
                {
                    shown.length > 0 ?
                        shown.map((film) => {
                            const key = `${film.type}:${film.tmdbId}`;
                            return (
                                <li key={film.key}>
                                    <button
                                        type={'button'}
                                        className={classNames(styles['filmography-row'], { [styles['busy']]: pendingKey === key })}
                                        aria-busy={pendingKey === key}
                                        onClick={() => onOpen(film)}
                                    >
                                        <span className={styles['row-year']}>{film.date ? film.date.slice(0, 4) : '—'}</span>
                                        <span className={styles['row-thumb']}>
                                            {film.poster ? <img src={tmdbImage('w185', film.poster) ?? undefined} alt={''} loading={'lazy'} decoding={'async'} /> : null}
                                        </span>
                                        <span className={styles['row-title']}>
                                            <strong>{film.name}</strong>
                                            <em>{film.type === 'tv' ? t('MEDIA_TYPE_SERIES', { defaultValue: 'Série' }) : t('MEDIA_TYPE_MOVIE', { defaultValue: 'Film' })}</em>
                                            {failedKey === key ? <em className={styles['row-failed']}>{t('TITLE_UNAVAILABLE', { defaultValue: 'Fiche indisponible' })}</em> : null}
                                        </span>
                                        <span className={styles['row-role']}>{roleOf(film)}</span>
                                        <span className={styles['row-rating']}>{film.rating > 0 ? `★ ${film.rating.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : ''}</span>
                                    </button>
                                </li>
                            );
                        })
                        :
                        <li className={styles['empty']}>{t('PERSON_FILMOGRAPHY_EMPTY', { defaultValue: 'Aucun crédit dans ce filtre.' })}</li>
                }
            </ul>
            {
                rows.length > shown.length ?
                    <button type={'button'} className={styles['more']} onClick={() => setLimit((value) => value + PAGE_SIZE)}>
                        {t('PERSON_SHOW_MORE', { defaultValue: 'Afficher plus ({{count}})', count: rows.length - shown.length })}
                    </button>
                    :
                    null
            }
        </section>
    );
};

export default PersonFilmography;
