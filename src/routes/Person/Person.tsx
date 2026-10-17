// Copyright (C) 2017-2026 Smart code 203358507

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import classNames from 'classnames';
import { Button, Image } from 'stremio/components';
import { useLastAddon } from 'stremio/common/lastAddon';
import useGoBack from 'stremio/router/useGoBack';
import { ageOf, buildFilmography, isRealCredit, tmdbImage } from './personData';
import type { CreditKind, FilmEntry, TmdbPerson } from './personData';
import { usePerson, usePersonWhy } from './usePerson';
import useOpenTitle from './useOpenTitle';
import PersonFilmography, { TitleCard } from './PersonFilmography';
import styles from './Person.less';

const KNOWN_LIMIT = 20;
const BIO_CLAMP = 380;

const DEPARTMENT_ROLES: Record<string, { key: string, male: string, female: string }> = {
    Acting: { key: 'PERSON_ROLE_ACTOR', male: 'Acteur', female: 'Actrice' },
    Directing: { key: 'PERSON_ROLE_DIRECTOR', male: 'Réalisateur', female: 'Réalisatrice' },
    Writing: { key: 'PERSON_ROLE_WRITER', male: 'Scénariste', female: 'Scénariste' },
    Production: { key: 'PERSON_ROLE_PRODUCER', male: 'Producteur', female: 'Productrice' },
};

const LastAddonCta = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <div className={styles['cta']} role={'status'}>
            <h2 className={styles['cta-title']}>{t('LASTADDON_NOT_CONFIGURED_TITLE', { defaultValue: 'LastAddon n’est pas configuré' })}</h2>
            <p className={styles['cta-text']}>
                {t('LASTADDON_NOT_CONFIGURED_TEXT', { defaultValue: 'Renseigne l’adresse et la configuration LastAddon dans les réglages pour afficher cette page.' })}
            </p>
            <Button className={styles['cta-button']} onClick={() => navigate('/settings')}>
                {t('LASTADDON_OPEN_SETTINGS', { defaultValue: 'Ouvrir les réglages' })}
            </Button>
        </div>
    );
};

type PersonViewProps = {
    person: TmdbPerson,
    films: FilmEntry[],
    language: string,
};

const PersonView = ({ person, films, language }: PersonViewProps) => {
    const { t } = useTranslation();
    const { open, pending, failed } = useOpenTitle();
    const [bioExpanded, setBioExpanded] = React.useState(false);

    const real = useMemo(() => films.filter(isRealCredit), [films]);
    const known = useMemo(
        () => real.slice().sort((a, b) => b.votes - a.votes).slice(0, KNOWN_LIMIT),
        [real],
    );
    const backdrop = useMemo(
        () => films.filter((film) => film.backdrop).sort((a, b) => b.popularity - a.popularity)[0],
        [films],
    );
    const knownNames = useMemo(() => known.slice(0, 8).map((film) => film.name), [known]);
    const why = usePersonWhy(person.id, person.name, knownNames, knownNames.length > 0);

    const birthYear = person.birthday ? Number(person.birthday.slice(0, 4)) : 1880;
    const currentYear = new Date().getFullYear();
    const years = real
        .map((film) => Number((film.date || '').slice(0, 4)))
        .filter((year) => year > birthYear && year <= currentYear);
    const filmCount = real.filter((film) => film.type === 'movie').length;
    const seriesCount = real.filter((film) => film.type === 'tv').length;
    const rated = known.filter((film) => film.rating > 0);
    const averageRating = rated.length ? rated.reduce((sum, film) => sum + film.rating, 0) / rated.length : 0;

    const roles = useMemo(() => {
        const female = person.gender === 1;
        const labels: string[] = [];
        const department = person.known_for_department ? DEPARTMENT_ROLES[person.known_for_department] : undefined;
        if (department) {
            labels.push(t(female ? `${department.key}_FEMALE` : department.key, { defaultValue: female ? department.female : department.male }));
        }
        const count = (kind: CreditKind) => films.filter((film) => film.kinds.has(kind)).length;
        if (count('director') >= 1) {
            labels.push(female
                ? t('PERSON_ROLE_DIRECTRESS', { defaultValue: 'Réalisatrice' })
                : t('PERSON_ROLE_DIRECTOR', { defaultValue: 'Réalisateur' }));
        }
        if (count('writer') >= 2) labels.push(t('PERSON_ROLE_WRITER', { defaultValue: 'Scénariste' }));
        if (count('producer') >= 2) {
            labels.push(female
                ? t('PERSON_ROLE_PRODUCERESS', { defaultValue: 'Productrice' })
                : t('PERSON_ROLE_PRODUCER', { defaultValue: 'Producteur' }));
        }
        return Array.from(new Set(labels)).join(' · ');
    }, [films, person.gender, person.known_for_department, t]);

    const life = useMemo(() => {
        if (!person.birthday) return person.place_of_birth ?? '';
        const dateFormat: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
        const born = new Date(`${person.birthday}T00:00:00`).toLocaleDateString(language, dateFormat);
        const age = ageOf(person.birthday, person.deathday);
        const text = person.deathday
            ? t('PERSON_LIFE_DIED', {
                defaultValue: 'Né le {{born}} · mort le {{died}} ({{age}} ans)',
                born,
                died: new Date(`${person.deathday}T00:00:00`).toLocaleDateString(language, dateFormat),
                age,
            })
            : t('PERSON_LIFE_BORN', { defaultValue: 'Né le {{born}} ({{age}} ans)', born, age });
        return person.place_of_birth ? `${text} · ${person.place_of_birth}` : text;
    }, [language, person.birthday, person.deathday, person.place_of_birth, t]);

    const externalIds = person.external_ids ?? {};
    const photos = (person.images?.profiles ?? []).slice(0, 20);
    const bio = (person.biography ?? '').trim();
    const backdropSrc = tmdbImage('w1280', backdrop?.backdrop);
    const portraitSrc = tmdbImage('w342', person.profile_path);

    const stats: { value: string, label: string }[] = [
        { value: String(filmCount), label: t('PERSON_STAT_MOVIES', { defaultValue: 'film(s)' }) },
        { value: String(seriesCount), label: t('PERSON_STAT_SERIES', { defaultValue: 'série(s)' }) },
    ];
    if (years.length) {
        stats.push({
            value: `${Math.min(...years)} – ${Math.max(...years)}`,
            label: t('PERSON_STAT_YEARS', { defaultValue: 'années d’activité' }),
        });
    }
    if (averageRating > 0) {
        stats.push({
            value: `★ ${averageRating.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
            label: t('PERSON_STAT_RATING', { defaultValue: 'note moyenne des plus connus' }),
        });
    }

    return (
        <article className={styles['person-page']} aria-labelledby={'person-title'}>
            <header className={styles['person-head']}>
                <div className={classNames(styles['person-backdrop'], { [styles['no-image']]: !backdropSrc })} aria-hidden={'true'}>
                    {backdropSrc ? <img src={backdropSrc} alt={''} decoding={'async'} /> : null}
                </div>
                <div className={styles['person-scrim']} aria-hidden={'true'} />
                <div className={styles['person-inner']}>
                    <div className={classNames(styles['person-portrait'], { [styles['no-image']]: !portraitSrc })}>
                        {
                            portraitSrc ?
                                <img src={portraitSrc} alt={person.name} decoding={'async'} />
                                :
                                <span aria-hidden={'true'}>{(person.name || '?').slice(0, 1)}</span>
                        }
                    </div>
                    <div className={styles['person-info']}>
                        <h1 id={'person-title'} className={styles['person-name']} tabIndex={-1}>{person.name}</h1>
                        {roles ? <p className={styles['person-roles']}>{roles}</p> : null}
                        {life ? <p className={styles['person-life']}>{life}</p> : null}
                        {
                            externalIds.imdb_id || externalIds.instagram_id || externalIds.twitter_id ?
                                <div className={styles['person-links']}>
                                    {
                                        externalIds.imdb_id ?
                                            <a className={styles['imdb-link']} href={`https://www.imdb.com/name/${encodeURIComponent(externalIds.imdb_id)}`} target={'_blank'} rel={'noopener noreferrer'} aria-label={t('PERSON_LINK_IMDB', { defaultValue: 'IMDb (nouvel onglet)' })}>{t('PERSON_LINK_IMDB_LABEL', { defaultValue: 'IMDb' })}</a>
                                            : null
                                    }
                                    {
                                        externalIds.instagram_id ?
                                            <a href={`https://www.instagram.com/${encodeURIComponent(externalIds.instagram_id)}`} target={'_blank'} rel={'noopener noreferrer'} aria-label={t('PERSON_LINK_INSTAGRAM', { defaultValue: 'Instagram (nouvel onglet)' })}>{t('PERSON_LINK_INSTAGRAM_LABEL', { defaultValue: 'Instagram' })}</a>
                                            : null
                                    }
                                    {
                                        externalIds.twitter_id ?
                                            <a href={`https://x.com/${encodeURIComponent(externalIds.twitter_id)}`} target={'_blank'} rel={'noopener noreferrer'} aria-label={t('PERSON_LINK_X', { defaultValue: 'X (nouvel onglet)' })}>X</a>
                                            : null
                                    }
                                </div>
                                : null
                        }
                        {
                            bio ?
                                <div className={styles['person-bio-wrap']}>
                                    <p className={classNames(styles['person-bio'], { [styles['clamped']]: bio.length > BIO_CLAMP && !bioExpanded })}>{bio}</p>
                                    {
                                        bio.length > BIO_CLAMP ?
                                            <button type={'button'} className={styles['link-button']} aria-expanded={bioExpanded} onClick={() => setBioExpanded((value) => !value)}>
                                                {bioExpanded ?
                                                    t('PERSON_BIO_LESS', { defaultValue: 'Réduire' })
                                                    :
                                                    t('PERSON_BIO_MORE', { defaultValue: 'Lire la suite' })}
                                            </button>
                                            : null
                                    }
                                </div>
                                : null
                        }
                        {
                            why ?
                                <div className={styles['why']}>
                                    <p className={styles['why-head']}>
                                        {t('PERSON_WHY_TITLE', { defaultValue: 'En deux mots' })}
                                        <span className={styles['ai-tag']}>{t('AI_TAG', { defaultValue: 'IA' })}</span>
                                    </p>
                                    <p className={styles['why-text']}>{why}</p>
                                </div>
                                : null
                        }
                    </div>
                </div>
            </header>

            <ul className={styles['person-stats']} aria-label={t('PERSON_STATS', { defaultValue: 'Statistiques' })}>
                {stats.map(({ value, label }) => (
                    <li key={label}><strong>{value}</strong><span>{label}</span></li>
                ))}
            </ul>

            {
                known.length > 0 ?
                    <section className={styles['row-section']} aria-labelledby={'person-known-title'}>
                        <h2 id={'person-known-title'} className={styles['section-title']}>
                            {t('PERSON_KNOWN_TITLE', { defaultValue: 'Les plus connus' })}
                        </h2>
                        <div className={styles['row']}>
                            {known.map((film) => (
                                <TitleCard
                                    key={film.key}
                                    entry={film}
                                    caption={film.character || String(film.date.slice(0, 4))}
                                    pending={pending === `${film.type}:${film.tmdbId}`}
                                    failed={failed === `${film.type}:${film.tmdbId}`}
                                    onOpen={(entry) => open(entry.type, entry.tmdbId)}
                                />
                            ))}
                        </div>
                    </section>
                    : null
            }

            {
                photos.length > 0 ?
                    <section className={styles['row-section']} aria-labelledby={'person-photos-title'}>
                        <h2 id={'person-photos-title'} className={styles['section-title']}>
                            {t('PERSON_PHOTOS', { defaultValue: 'Photos' })}
                        </h2>
                        <div className={styles['row']}>
                            {photos.map((photo) => (
                                <div key={photo.file_path} className={styles['photo']}>
                                    <Image src={tmdbImage('w342', photo.file_path) ?? undefined} alt={person.name} />
                                </div>
                            ))}
                        </div>
                    </section>
                    : null
            }

            <PersonFilmography
                films={films}
                pendingKey={pending}
                failedKey={failed}
                onOpen={(entry) => open(entry.type, entry.tmdbId)}
            />
        </article>
    );
};

const Person = () => {
    const { t, i18n } = useTranslation();
    const { id = '' } = useParams();
    const goBack = useGoBack();
    const { configured } = useLastAddon();
    const state = usePerson(id, configured);

    const films = useMemo(
        () => (state.status === 'ready' ? buildFilmography(state.person.combined_credits) : []),
        [state],
    );

    return (
        <div className={styles['person-container']}>
            <div className={styles['person-topbar']}>
                <Button className={styles['back-button']} onClick={goBack}>
                    {t('PERSON_BACK', { defaultValue: 'Retour' })}
                </Button>
            </div>
            {
                !configured ?
                    <LastAddonCta />
                    : state.status === 'loading' ?
                        <div className={styles['loading']} aria-busy={'true'} role={'status'}>
                            {t('PERSON_LOADING', { defaultValue: 'Chargement…' })}
                        </div>
                        : state.status === 'error' ?
                            <div className={styles['error']} role={'alert'}>
                                {t('PERSON_ERROR', { defaultValue: 'Cette fiche personne n’a pas pu être chargée.' })}
                            </div>
                            :
                            <PersonView person={state.person} films={films} language={i18n.language} />
            }
        </div>
    );
};

export default Person;
