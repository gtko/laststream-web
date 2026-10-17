// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Image } from 'stremio/components';
import type { SkipSegment } from 'stremio/common/lastAddon';
import { NEXT_EPISODE_COUNTDOWN_S } from 'stremio/common/lastAddon';
import type { NextEpisodeCard } from './useSkipSegments';
import styles from './SkipOverlay.less';

type Props = {
    skipSegment: SkipSegment | null,
    onSkip: () => void,
    nextCard: NextEpisodeCard | null,
    onWatchCredits: () => void,
    onPlayNext: () => void,
};

const RING_RADIUS = 18;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

// Bouton « Passer » et carte « Épisode suivant », superposés au lecteur (coin bas-droit).
const SkipOverlay = ({ skipSegment, onSkip, nextCard, onWatchCredits, onPlayNext }: Props) => {
    const { t } = useTranslation();

    if (nextCard !== null) {
        const { countdown, nextVideo } = nextCard;
        const title = nextVideo.title ?? '';
        const episodeLabel = typeof nextVideo.season === 'number' && typeof nextVideo.episode === 'number'
            ? `S${nextVideo.season}E${nextVideo.episode}`
            : null;
        const progress = countdown / NEXT_EPISODE_COUNTDOWN_S;
        return (
            <div className={styles['next-card']} role={'dialog'} aria-label={t('SKIP_NEXT_EPISODE', { defaultValue: 'Épisode suivant' })}>
                <div className={styles['next-still']}>
                    {nextVideo.thumbnail ? <Image src={nextVideo.thumbnail} alt={title} /> : null}
                </div>
                <div className={styles['next-text']}>
                    <span className={styles['next-label']}>{t('SKIP_NEXT_EPISODE', { defaultValue: 'Épisode suivant' })}</span>
                    <span className={styles['next-title']}>{episodeLabel ? `${episodeLabel} · ${title}` : title}</span>
                    <div className={styles['next-actions']}>
                        <button type={'button'} className={styles['skip-pill']} onClick={onPlayNext}>
                            {t('SKIP_PLAY_NEXT', { defaultValue: 'Lire maintenant' })}
                        </button>
                        <button type={'button'} className={styles['skip-pill-ghost']} onClick={onWatchCredits}>
                            {t('SKIP_WATCH_CREDITS', { defaultValue: 'Regarder le générique' })}
                        </button>
                    </div>
                </div>
                <svg className={styles['ring']} viewBox={'0 0 44 44'} aria-label={String(countdown)} role={'img'}>
                    <circle cx={22} cy={22} r={RING_RADIUS} className={styles['ring-track']} />
                    <circle
                        cx={22}
                        cy={22}
                        r={RING_RADIUS}
                        className={styles['ring-progress']}
                        strokeDasharray={RING_LENGTH}
                        strokeDashoffset={RING_LENGTH * (1 - progress)}
                    />
                    <text x={22} y={22} className={styles['ring-text']}>{countdown}</text>
                </svg>
            </div>
        );
    }

    if (skipSegment !== null) {
        const label = skipSegment.kind === 'recap'
            ? t('SKIP_RECAP', { defaultValue: 'Passer le récap' })
            : t('SKIP_INTRO', { defaultValue: 'Passer l’intro' });
        return (
            <Button className={styles['skip-button']} title={label} onClick={onSkip}>
                {label}
            </Button>
        );
    }

    return null;
};

export default SkipOverlay;
