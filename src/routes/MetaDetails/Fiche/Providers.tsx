// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FicheProviders, ProviderKey } from './types';
import styles from './styles.less';

const GROUP_LABELS: Record<ProviderKey, [string, string]> = {
    flatrate: ['FICHE_PROVIDERS_STREAMING', 'Disponible sur :'],
    free: ['FICHE_PROVIDERS_FREE', 'Gratuit'],
    rent: ['FICHE_PROVIDERS_RENT', 'Location'],
    buy: ['FICHE_PROVIDERS_BUY', 'Achat'],
};

type Props = {
    providers: FicheProviders | null;
};

const Providers = ({ providers }: Props) => {
    const { t } = useTranslation();

    if (providers === null) return null;

    if (providers.groups.length === 0) {
        return (
            <p className={styles['providers-none']}>
                {t('FICHE_PROVIDERS_NONE', { defaultValue: 'Pas disponible en streaming en France' })}
            </p>
        );
    }

    const content = providers.groups.map((group) => {
        const [key, fallback] = GROUP_LABELS[group.key];
        return (
            <div key={group.key} className={styles['provider-group']}>
                <span className={styles['provider-label']}>{t(key, { defaultValue: fallback })}</span>
                <span className={styles['provider-logos']}>
                    {group.items.map((item) => (
                        <img
                            key={item.name}
                            src={item.logo}
                            alt={item.name}
                            title={item.name}
                            width={36}
                            height={36}
                            loading="lazy"
                            decoding="async"
                        />
                    ))}
                </span>
            </div>
        );
    });

    if (providers.link === '') {
        return <div className={styles['providers']}>{content}</div>;
    }

    return (
        <a
            className={styles['providers']}
            href={providers.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('FICHE_PROVIDERS_LINK', {
                defaultValue: 'Où regarder en France (ouvre TMDB / JustWatch dans un nouvel onglet)',
            })}
        >
            {content}
        </a>
    );
};

export default Providers;
