// Copyright (C) 2017-2026 Smart code 203358507

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { youtubeEmbedUrl } from './format';
import styles from './styles.less';

type Props = {
    videoKey: string;
    onClose: () => void;
};

// Lecture avec son d'une vidéo YouTube, par-dessus la fiche. Échap ou clic hors du cadre pour fermer.
const TrailerModal = ({ videoKey, onClose }: Props) => {
    const { t } = useTranslation();

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div className={styles['modal']} role="dialog" aria-modal="true" aria-label={t('TRAILER', { defaultValue: 'Bande-annonce' })} onClick={onClose}>
            <div className={styles['modal-video']} onClick={(event) => event.stopPropagation()}>
                <iframe
                    src={youtubeEmbedUrl(videoKey, false)}
                    title={t('TRAILER', { defaultValue: 'Bande-annonce' })}
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                />
            </div>
            <button
                type="button"
                className={styles['modal-close']}
                onClick={onClose}
                aria-label={t('CLOSE', { defaultValue: 'Fermer' })}
            >
                ×
            </button>
        </div>
    );
};

export default TrailerModal;
