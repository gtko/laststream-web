// Copyright (C) 2017-2026 Smart code 203358507

import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { prefersReducedMotion, youtubeEmbedUrl } from './format';
import styles from './styles.less';

const VIDEO_DELAY_MS = 1500;

type Props = {
    imageSrc: string | null;
    trailerKey: string | null;
};

// Fond plein écran fixe : l'image d'abord, puis la bande-annonce muette en YouTube par-dessus.
const Backdrop = ({ imageSrc, trailerKey }: Props) => {
    const videoAllowed = trailerKey !== null && !prefersReducedMotion();
    const [videoOn, setVideoOn] = useState(false);

    useEffect(() => {
        if (!videoAllowed) return undefined;
        const timer = window.setTimeout(() => setVideoOn(true), VIDEO_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [videoAllowed]);

    return (
        <div className={styles['backdrop']} aria-hidden="true">
            {imageSrc !== null && imageSrc !== '' && (
                <img className={styles['backdrop-image']} src={imageSrc} alt="" decoding="async" />
            )}
            {videoAllowed && trailerKey !== null && (
                <div className={classNames(styles['backdrop-video'], videoOn && styles['is-on'])}>
                    <iframe src={youtubeEmbedUrl(trailerKey, true)} tabIndex={-1} allow="autoplay; encrypted-media" />
                </div>
            )}
            <div className={styles['backdrop-scrim']} />
        </div>
    );
};

export default Backdrop;
