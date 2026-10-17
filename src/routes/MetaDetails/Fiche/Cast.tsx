// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import Section from './Section';
import type { FicheTmdbPerson } from './types';
import styles from './styles.less';

type Props = {
    people: FicheTmdbPerson[];
};

const Cast = ({ people }: Props) => {
    const { t } = useTranslation();
    return (
        <Section id="fiche-cast" title={t('FICHE_CAST', { defaultValue: 'Casting' })}>
            <ul className={styles['row']}>
                {people.map((person) => (
                    <li key={person.id}>
                        <a className={styles['person']} href={`#/person/${person.id}`}>
                            <span className={classNames(styles['person-photo'], person.photo === '' && styles['no-image'])}>
                                {person.photo !== '' && <img src={person.photo} alt="" loading="lazy" decoding="async" />}
                            </span>
                            <span className={styles['person-name']}>{person.name}</span>
                            {person.role !== '' && <span className={styles['person-role']}>{person.role}</span>}
                        </a>
                    </li>
                ))}
            </ul>
        </Section>
    );
};

export default Cast;
