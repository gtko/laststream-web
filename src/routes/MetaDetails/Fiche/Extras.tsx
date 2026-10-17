// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import { useTranslation } from 'react-i18next';
import Section from './Section';
import type { FicheExtra } from './types';
import styles from './styles.less';

// Libellés des types de vidéos TMDB : clé de traduction et repli français.
const EXTRA_LABELS = new Map<string, [string, string]>([
    ['Trailer', ['TRAILER', 'Bande-annonce']],
    ['Teaser', ['FICHE_EXTRA_TEASER', 'Teaser']],
    ['Featurette', ['FICHE_EXTRA_FEATURETTE', 'Featurette']],
    ['Behind the Scenes', ['FICHE_EXTRA_BEHIND', 'Making-of']],
    ['Clip', ['FICHE_EXTRA_CLIP', 'Extrait']],
    ['Bloopers', ['FICHE_EXTRA_BLOOPERS', 'Bêtisier']],
    ['Opening Credits', ['FICHE_EXTRA_CREDITS', 'Générique']],
]);

type Props = {
    extras: FicheExtra[];
    onOpen: (key: string) => void;
};

const Extras = ({ extras, onOpen }: Props) => {
    const { t } = useTranslation();
    return (
        <Section id="fiche-extras" title={t('FICHE_EXTRAS', { defaultValue: 'Bonus' })}>
            <ul className={styles['row']}>
                {extras.map((extra) => {
                    const [key, fallback] = EXTRA_LABELS.get(extra.type) ?? ['', extra.type];
                    const label = key !== '' ? t(key, { defaultValue: fallback }) : fallback;
                    return (
                        <li key={extra.key}>
                            <button
                                type="button"
                                className={styles['extra']}
                                onClick={() => onOpen(extra.key)}
                                aria-label={`${label} : ${extra.name}`}
                            >
                                <span className={styles['extra-thumb']}>
                                    <img
                                        src={`https://img.youtube.com/vi/${encodeURIComponent(extra.key)}/hqdefault.jpg`}
                                        alt=""
                                        loading="lazy"
                                        decoding="async"
                                    />
                                </span>
                                <span className={styles['extra-type']}>{label}</span>
                                <span className={styles['extra-name']}>{extra.name}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </Section>
    );
};

export default Extras;
