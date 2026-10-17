// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import Icon from '@stremio/stremio-icons/react';
import { useLibraryStats, useTranslate, withCoreSuspender } from 'stremio/common';
import { ICON_FOR_TYPE } from 'stremio/common/CONSTANTS';
import { Button, Image, MainNavBars } from 'stremio/components';
import styles from './Stats.less';

const MS_PER_HOUR = 60 * 60 * 1000;

const formatHours = (ms: number, language: string): string => {
    const hours = Math.round((ms / MS_PER_HOUR) * 10) / 10;
    return hours.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

const formatCount = (count: number, language: string): string => count.toLocaleString(language);

type SummaryCardProps = {
    value: string,
    label: string,
    hero?: boolean,
};

const SummaryCard = ({ value, label, hero = false }: SummaryCardProps) => (
    <div className={classNames(styles['stat-card'], { [styles['hero']]: hero })}>
        <div className={styles['stat-value']}>{value}</div>
        <div className={styles['stat-label']}>{label}</div>
    </div>
);

type TopItemProps = {
    item: LibraryStatsTopItem,
    language: string,
};

const TopItem = ({ item, language }: TopItemProps) => {
    const { t } = useTranslation();
    const { stringWithPrefix } = useTranslate();
    // Same `#/detail/{type}/{id}` shape as the core deep links used by library items.
    const href = `#/detail/${encodeURIComponent(item.type)}/${encodeURIComponent(item.id)}`;
    const renderPosterFallback = () => (
        <Icon className={styles['top-poster-icon']} name={ICON_FOR_TYPE.get(item.type) ?? 'movies'} />
    );

    return (
        <Button className={styles['top-item']} href={href} title={item.name}>
            <div className={styles['top-poster']}>
                <Image
                    className={styles['top-poster-image']}
                    src={item.poster ?? undefined}
                    alt={' '}
                    renderFallback={renderPosterFallback}
                />
            </div>
            <div className={styles['top-info']}>
                <div className={styles['top-name']}>{item.name}</div>
                <div className={styles['top-type']}>{stringWithPrefix(item.type, 'TYPE_')}</div>
                <div className={styles['top-hours']}>
                    {t('STATS_TOP_ITEM_HOURS', { defaultValue: '{{hours}} h watched', hours: formatHours(item.overallTimeWatchedMs, language) })}
                </div>
            </div>
        </Button>
    );
};

type ActivityChartProps = {
    days: LibraryStatsDailyActivity[],
};

const ActivityChart = ({ days }: ActivityChartProps) => {
    const { t } = useTranslation();
    const max = days.reduce((result, { count }) => Math.max(result, count), 0);

    return (
        <div className={styles['activity-chart']} role={'group'} aria-label={t('STATS_DAILY_ACTIVITY', { defaultValue: 'Last 30 days' })}>
            <div className={styles['bars']}>
                {
                    days.map(({ date, count }) => (
                        <div
                            key={date}
                            role={'img'}
                            aria-label={`${date}: ${count}`}
                            title={`${date}: ${count}`}
                            className={styles['bar-track']}
                        >
                            <div className={styles['bar']} style={{ height: `${max > 0 ? (count / max) * 100 : 0}%` }} />
                        </div>
                    ))
                }
            </div>
            {
                days.length > 0 ?
                    <div className={styles['axis']}>
                        <span>{days[0].date}</span>
                        <span>{days[days.length - 1].date}</span>
                    </div>
                    :
                    null
            }
        </div>
    );
};

const Stats = () => {
    const { t, i18n } = useTranslation();
    const { stringWithPrefix } = useTranslate();
    const stats = useLibraryStats();
    const language = i18n.language;
    const empty = stats.totalWatchedMs === 0 && stats.top.length === 0;

    return (
        <MainNavBars className={styles['stats-container']} route={'stats'}>
            <div className={classNames(styles['stats-content'], 'animation-fade-in')}>
                <h1 className={styles['page-title']}>{t('STATS', { defaultValue: 'Stats' })}</h1>
                {
                    empty ?
                        <div className={styles['empty-state']}>
                            <div className={styles['empty-label']}>
                                {t('STATS_EMPTY', { defaultValue: 'Nothing watched yet. Your viewing stats will show up here once you start watching.' })}
                            </div>
                        </div>
                        :
                        <React.Fragment>
                            <div className={styles['summary']}>
                                <SummaryCard
                                    hero
                                    value={formatHours(stats.totalWatchedMs, language)}
                                    label={t('STATS_HOURS_WATCHED', { defaultValue: 'Hours watched' })}
                                />
                                <SummaryCard
                                    value={formatCount(stats.moviesWatched, language)}
                                    label={t('STATS_MOVIES_WATCHED', { defaultValue: 'Movies watched' })}
                                />
                                <SummaryCard
                                    value={formatCount(stats.seriesCount, language)}
                                    label={t('STATS_SERIES_FOLLOWED', { defaultValue: 'Series followed' })}
                                />
                            </div>
                            {
                                stats.top.length > 0 ?
                                    <section className={styles['section']}>
                                        <h2 className={styles['section-title']}>{t('STATS_TOP_WATCHED', { defaultValue: 'Most watched' })}</h2>
                                        <div className={styles['top-list']}>
                                            {stats.top.map((item) => <TopItem key={`${item.type}:${item.id}`} item={item} language={language} />)}
                                        </div>
                                    </section>
                                    :
                                    null
                            }
                            <section className={styles['section']}>
                                <h2 className={styles['section-title']}>{t('STATS_DAILY_ACTIVITY', { defaultValue: 'Last 30 days' })}</h2>
                                <ActivityChart days={stats.dailyActivity} />
                            </section>
                            <section className={styles['section']}>
                                <h2 className={styles['section-title']}>{t('STATS_BY_TYPE', { defaultValue: 'By type' })}</h2>
                                <ul className={styles['type-list']}>
                                    {
                                        stats.byType.map(({ type, count }) => (
                                            <li key={type} className={styles['type-item']}>
                                                <span className={styles['type-name']}>{stringWithPrefix(type, 'TYPE_')}</span>
                                                <span className={styles['type-count']}>{formatCount(count, language)}</span>
                                            </li>
                                        ))
                                    }
                                </ul>
                            </section>
                        </React.Fragment>
                }
            </div>
        </MainNavBars>
    );
};

const StatsFallback = () => (
    <MainNavBars className={styles['stats-container']} route={'stats'} />
);

export default withCoreSuspender(Stats, StatsFallback);
