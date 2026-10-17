// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Backdrop from './Backdrop';
import Cast from './Cast';
import Episodes from './Episodes';
import Extras from './Extras';
import Info from './Info';
import Infos from './Infos';
import PosterRow from './PosterRow';
import Section from './Section';
import TrailerModal from './TrailerModal';
import useFicheData from './useFicheData';
import { prefersReducedMotion } from './format';
import type { FicheMeta } from './types';
import styles from './styles.less';

export type FicheProps = {
    meta: FicheMeta;
    containerRef?: React.Ref<HTMLDivElement>;
    season: number | null;
    onSeasonSelect: (season: number) => void;
    resumeVideoId: string | null;
    inLibrary: boolean;
    onToggleLibrary: () => void;
    // Lecture : déclenché par le bouton « Lecture ». Lot 4 le branchera au lecteur.
    onPlay: () => void;
    // Liste des sources (StreamsList) quand un flux est sélectionné ; null sinon.
    sources?: React.ReactNode;
};

const Fiche = ({
    meta,
    containerRef,
    season,
    onSeasonSelect,
    resumeVideoId,
    inLibrary,
    onToggleLibrary,
    onPlay,
    sources = null,
}: FicheProps) => {
    const { t } = useTranslation();
    const data = useFicheData(meta);
    const [modalKey, setModalKey] = useState<string | null>(null);
    const sourcesRef = useRef<HTMLElement>(null);
    const scrollPending = useRef(false);
    const hasSources = sources !== null;

    const backdrop = data.tmdb?.backdrop || meta.background || '';
    const trailerKey = data.tmdb?.trailerKey || (meta.trailerStreams ?? [])[0]?.ytId || '';

    const scrollToSources = useCallback(() => {
        sourcesRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }, []);

    // Lecture : si les sources sont déjà affichées, on y descend ; sinon on les descendra à leur apparition.
    const handlePlay = useCallback(() => {
        if (hasSources) {
            scrollToSources();
        } else {
            scrollPending.current = true;
        }
        onPlay();
    }, [hasSources, onPlay, scrollToSources]);

    useEffect(() => {
        if (hasSources && scrollPending.current) {
            scrollPending.current = false;
            scrollToSources();
        }
    }, [hasSources, scrollToSources]);

    const openTrailer = useCallback((key: string) => setModalKey(key), []);
    const closeTrailer = useCallback(() => setModalKey(null), []);

    return (
        <div ref={containerRef} className={styles['fiche']} aria-busy={data.status === 'loading'}>
            <Backdrop imageSrc={backdrop !== '' ? backdrop : null} trailerKey={trailerKey !== '' ? trailerKey : null} />

            <section className={styles['first']} aria-label={t('FICHE_PRESENTATION', { defaultValue: 'Présentation' })}>
                <Info
                    meta={meta}
                    data={data}
                    inLibrary={inLibrary}
                    onToggleLibrary={onToggleLibrary}
                    onPlay={handlePlay}
                    onTrailer={trailerKey !== '' ? () => openTrailer(trailerKey) : null}
                />
            </section>

            <div className={styles['panels']}>
                {meta.type !== 'movie' && meta.videos.length > 0 && (
                    <Episodes
                        videos={meta.videos}
                        season={season}
                        onSeasonSelect={onSeasonSelect}
                        resumeVideoId={resumeVideoId}
                    />
                )}
                {hasSources && (
                    <Section id="fiche-sources" title={t('FICHE_SOURCES', { defaultValue: 'Sources' })} sectionRef={sourcesRef}>
                        <div className={styles['sources']}>{sources}</div>
                    </Section>
                )}
                {data.tmdb !== null && data.tmdb.cast.length > 0 && <Cast people={data.tmdb.cast} />}
                {data.tmdb !== null && data.tmdb.extras.length > 0 && (
                    <Extras extras={data.tmdb.extras} onOpen={openTrailer} />
                )}
                {data.collection !== null && (
                    <PosterRow id="fiche-collection" title={data.collection.name} items={data.collection.parts} />
                )}
                {data.tmdb !== null && data.tmdb.similar.length > 0 && (
                    <PosterRow
                        id="fiche-similar"
                        title={t('FICHE_SIMILAR', { defaultValue: 'Similaires' })}
                        items={data.tmdb.similar}
                    />
                )}
                <Infos meta={meta} tmdb={data.tmdb} />
            </div>

            {modalKey !== null && <TrailerModal videoKey={modalKey} onClose={closeTrailer} />}
        </div>
    );
};

export default Fiche;
