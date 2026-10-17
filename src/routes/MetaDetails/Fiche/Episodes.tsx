// Copyright (C) 2017-2026 Smart code 203358507

import React, { useMemo } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import getMetaDetailsHref from 'stremio/common/getMetaDetailsHref';
import { navigateToRoute, toPath } from 'stremio-router';
import Section from './Section';
import styles from './styles.less';

// Saisons numérotées par ordre croissant, les « Bonus » (saison 0) en dernier.
const seasonOrder = (a: number, b: number): number => {
    if (a === 0) return 1;
    if (b === 0) return -1;
    return a - b;
};

type EpisodeItemProps = {
    video: Video;
    isResume: boolean;
};

const EpisodeItem = ({ video, isResume }: EpisodeItemProps) => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const href = getMetaDetailsHref(video.deepLinks);
    const released = video.released ? new Date(video.released) : null;
    const releasedLabel = released !== null && !Number.isNaN(released.getTime())
        ? released.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';
    const code = t('FICHE_EPISODE_CODE', { defaultValue: 'É{{number}}', number: video.episode ?? 0 });
    const title = `${code} · ${video.title ?? ''}`;
    const meta = [releasedLabel, video.runtime ?? '', video.upcoming ? t('FICHE_SOON', { defaultValue: 'Bientôt' }) : '']
        .filter((part) => part !== '')
        .join(' · ');
    const label = t('FICHE_PLAY_EPISODE', { defaultValue: 'Lire {{title}}', title });
    const className = classNames(styles['episode'], video.watched && styles['is-seen'], isResume && styles['is-next']);

    const body = (
        <>
            <span className={styles['episode-still']}>
                {video.thumbnail && <img src={video.thumbnail} alt="" loading="lazy" decoding="async" />}
            </span>
            <span className={styles['episode-title']}>
                {title}
                {isResume && <span className={styles['next-label']}>{t('FICHE_NEXT', { defaultValue: 'À suivre' })}</span>}
            </span>
            {meta !== '' && <span className={styles['episode-meta']}>{meta}</span>}
            {video.overview && <span className={styles['episode-overview']}>{video.overview}</span>}
        </>
    );

    if (href === null) {
        return (
            <li className={className}>
                <div className={styles['episode-link']} aria-label={label}>{body}</div>
            </li>
        );
    }

    return (
        <li className={className}>
            <a
                className={styles['episode-link']}
                href={href}
                aria-label={label}
                onClick={(event) => {
                    event.preventDefault();
                    navigateToRoute(navigate, location, toPath(href));
                }}
            >
                {body}
            </a>
        </li>
    );
};

type Props = {
    videos: Video[];
    season: number | null;
    onSeasonSelect: (season: number) => void;
    resumeVideoId: string | null;
};

const Episodes = ({ videos, season, onSeasonSelect, resumeVideoId }: Props) => {
    const { t } = useTranslation();
    const seasons = useMemo(() => {
        const numbers = new Set<number>();
        videos.forEach((video) => {
            if (typeof video.season === 'number') numbers.add(video.season);
        });
        return Array.from(numbers).sort(seasonOrder);
    }, [videos]);

    if (seasons.length === 0) return null;

    const resumeVideo = videos.find((video) => video.id === resumeVideoId);
    const fallbackSeason = resumeVideo?.season ?? seasons[0];
    const current = season !== null && seasons.includes(season) ? season : fallbackSeason;
    const episodes = videos
        .filter((video) => video.season === current)
        .sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0));

    return (
        <Section id="fiche-episodes" title={t('FICHE_EPISODES', { defaultValue: 'Épisodes' })}>
            <div className={styles['season-pills']} role="group" aria-label={t('SEASON', { defaultValue: 'Saison' })}>
                {seasons.map((number) => (
                    <button
                        key={number}
                        type="button"
                        className={styles['pill']}
                        aria-pressed={number === current}
                        onClick={() => onSeasonSelect(number)}
                    >
                        {number === 0
                            ? t('FICHE_BONUS', { defaultValue: 'Bonus' })
                            : t('FICHE_SEASON', { defaultValue: 'Saison {{number}}', number })}
                    </button>
                ))}
            </div>
            <ol className={styles['episode-row']}>
                {episodes.map((video) => (
                    <EpisodeItem key={video.id} video={video} isResume={video.id === resumeVideoId} />
                ))}
            </ol>
        </Section>
    );
};

export default Episodes;
