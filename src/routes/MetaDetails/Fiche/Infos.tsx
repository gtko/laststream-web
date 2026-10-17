// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatMoney } from './format';
import type { FicheTmdb, FicheTmdbCrew, FicheMeta } from './types';
import styles from './styles.less';

// Statuts TMDB (en anglais) : clé de traduction et repli français.
const STATUS_LABELS = new Map<string, [string, string]>([
    ['Released', ['FICHE_STATUS_RELEASED', 'Sorti']],
    ['Returning Series', ['FICHE_STATUS_RETURNING', 'En cours']],
    ['Ended', ['FICHE_STATUS_ENDED', 'Terminée']],
    ['Canceled', ['FICHE_STATUS_CANCELED', 'Annulée']],
    ['In Production', ['FICHE_STATUS_PRODUCTION', 'En production']],
    ['Post Production', ['FICHE_STATUS_POST', 'En postproduction']],
    ['Planned', ['FICHE_STATUS_PLANNED', 'Prévu']],
    ['Rumored', ['FICHE_STATUS_RUMORED', 'Rumeur']],
]);

const PersonLinks = ({ people }: { people: FicheTmdbCrew[] }) => (
    <>
        {people.map((person, index) => (
            <React.Fragment key={person.id}>
                {index > 0 && ', '}
                <a href={`#/person/${person.id}`}>{person.name}</a>
            </React.Fragment>
        ))}
    </>
);

type Props = {
    meta: FicheMeta;
    tmdb: FicheTmdb | null;
};

const Infos = ({ meta, tmdb }: Props) => {
    const { t } = useTranslation();
    const isTv = tmdb !== null && tmdb.kind === 'tv';
    const overview = tmdb?.overview || meta.description || '';

    const credits: [string, FicheTmdbCrew[]][] = [];
    if (tmdb !== null && tmdb.directors.length > 0) {
        credits.push([
            isTv ? t('FICHE_CREATOR', { defaultValue: 'Création' }) : t('FICHE_DIRECTOR', { defaultValue: 'Réalisation' }),
            tmdb.directors,
        ]);
    }
    if (tmdb !== null && tmdb.writers.length > 0) {
        credits.push([t('FICHE_WRITERS', { defaultValue: 'Scénario' }), tmdb.writers]);
    }

    const details: [string, string][] = [];
    if (tmdb !== null) {
        const statusEntry = STATUS_LABELS.get(tmdb.status);
        if (tmdb.original !== '' && tmdb.original !== meta.name) {
            details.push([t('FICHE_ORIGINAL_TITLE', { defaultValue: 'Titre original' }), tmdb.original]);
        }
        if (tmdb.countries.length > 0) {
            details.push([t('FICHE_COUNTRIES', { defaultValue: 'Pays' }), tmdb.countries.join(', ')]);
        }
        if (tmdb.originalLanguage !== '') {
            details.push([t('FICHE_ORIGINAL_LANGUAGE', { defaultValue: 'Langue originale' }), tmdb.originalLanguage]);
        }
        if (tmdb.spokenLanguages.length > 1) {
            details.push([t('FICHE_AUDIO_LANGUAGES', { defaultValue: 'Langues audio' }), tmdb.spokenLanguages.join(', ')]);
        }
        if (tmdb.studios.length > 0) {
            details.push([
                isTv ? t('FICHE_NETWORKS', { defaultValue: 'Chaînes' }) : t('FICHE_STUDIOS', { defaultValue: 'Studios' }),
                tmdb.studios.join(', '),
            ]);
        }
        if (!isTv && tmdb.budget > 0) {
            details.push([t('FICHE_BUDGET', { defaultValue: 'Budget' }), formatMoney(tmdb.budget)]);
        }
        if (!isTv && tmdb.revenue > 0) {
            details.push([t('FICHE_REVENUE', { defaultValue: 'Recettes' }), formatMoney(tmdb.revenue)]);
        }
        if (tmdb.releaseDate !== '') {
            details.push([
                isTv
                    ? t('FICHE_FIRST_AIR', { defaultValue: 'Première diffusion' })
                    : t('FICHE_RELEASE_FR', { defaultValue: 'Sortie en France' }),
                formatDate(tmdb.releaseDate),
            ]);
        }
        if (isTv && tmdb.lastAir !== '') {
            details.push([t('FICHE_LAST_AIR', { defaultValue: 'Dernière diffusion' }), formatDate(tmdb.lastAir)]);
        }
        if (statusEntry !== undefined) {
            details.push([t('FICHE_STATUS', { defaultValue: 'Statut' }), t(statusEntry[0], { defaultValue: statusEntry[1] })]);
        }
    }

    return (
        <section className={styles['infos']} id="fiche-infos" aria-labelledby="fiche-infos-title">
            <h2 className={styles['section-title']} id="fiche-infos-title">{t('FICHE_INFOS', { defaultValue: 'Infos' })}</h2>
            <div className={styles['infos-grid']}>
                <div>
                    <h3 className={styles['sub']}>{t('SUMMARY', { defaultValue: 'Résumé' })}</h3>
                    {tmdb?.tagline && <p className={styles['tagline']}>{tmdb.tagline}</p>}
                    <p className={styles['infos-overview']}>
                        {overview !== '' ? overview : t('FICHE_NO_SYNOPSIS', { defaultValue: 'Pas de synopsis disponible.' })}
                    </p>
                    {credits.length > 0 && (
                        <dl className={styles['credits']}>
                            {credits.map(([label, people]) => (
                                <div key={label}>
                                    <dt>{label}</dt>
                                    <dd><PersonLinks people={people} /></dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </div>
                {details.length > 0 && (
                    <div>
                        <h3 className={styles['sub']}>{t('FICHE_DETAILS', { defaultValue: 'Détails' })}</h3>
                        <dl className={styles['details']}>
                            {details.map(([label, value]) => (
                                <div key={label}>
                                    <dt>{label}</dt>
                                    <dd>{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                )}
            </div>
            {tmdb !== null && (
                <p className={styles['attribution']}>
                    {t('FICHE_ATTRIBUTION', { defaultValue: 'Disponibilités : JustWatch via TMDB' })}
                </p>
            )}
        </section>
    );
};

export default Infos;
