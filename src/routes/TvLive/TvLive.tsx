// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import classNames from 'classnames';
import Icon from '@stremio/stremio-icons/react';
import { Button, MainNavBars } from 'stremio/components';
import { withCoreSuspender } from 'stremio/common';
import { useLastAddon } from 'stremio/common/lastAddon';
import type { TvChannel, TvEpgProgram } from 'stremio/common/lastAddon';
import { epgKeyOf, useEpg, useTvChannels } from './useTvData';
import { EPG_SLOT_SECONDS, EPG_WINDOW_HOURS, epgWindowStart, formatTime, nowSeconds, progressPercent } from './tvEpg';
import { readFavorites, readLastChannel, writeFavorites, writeLastChannel } from './tvStorage';
import type { LastChannel } from './tvStorage';
import TvPlayer from './TvPlayer';
import TvPlaylistForm from './TvPlaylistForm';
import styles from './TvLive.less';

const PAGE_SIZE = 40;
const PX_PER_MINUTE = 160 / 30;
const CHANNEL_COLUMN_PX = 220;
const WINDOW_WIDTH_PX = EPG_WINDOW_HOURS * 60 * PX_PER_MINUTE;
const SLOT_COUNT = EPG_WINDOW_HOURS * 2;
const CATALOG_CATEGORIES = ['Info', 'Sport', 'Cinéma', 'Jeunesse', 'Musique', 'Divertissement', 'Documentaires'];

type Selection = { channelId: string, start: number };
type Playing = { list: TvChannel[], index: number };

const filterChannels = (
    channels: TvChannel[],
    category: string,
    search: string,
    favorites: string[],
    showFlaky: boolean,
): TvChannel[] => {
    const query = search.trim().toLocaleLowerCase();
    let list = channels.filter((channel) => showFlaky || !channel.flaky);
    if (category === 'favorites') list = list.filter((channel) => favorites.includes(channel.id));
    else if (category === 'fast') list = list.filter((channel) => channel.fast);
    else if (category === 'playlist') list = list.filter((channel) => channel.source === 'user');
    else if (category !== 'all') list = list.filter((channel) => channel.source !== 'user' && channel.cat === category);
    if (query) list = list.filter((channel) => channel.name.toLocaleLowerCase().includes(query));
    if (category === 'all') {
        // Les favoris remontent en tête de la liste « Toutes ».
        list = list.slice().sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)));
    }
    return list;
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

type EpgRowProps = {
    channel: TvChannel,
    programs: TvEpgProgram[] | undefined,
    isFavorite: boolean,
    selectedStart: number | null,
    windowStart: number,
    now: number,
    onPlay: (channel: TvChannel) => void,
    onSelect: (selection: Selection) => void,
    onToggleFavorite: (channelId: string) => void,
};

const EpgRow = ({ channel, programs, isFavorite, selectedStart, windowStart, now, onPlay, onSelect, onToggleFavorite }: EpgRowProps) => {
    const { t, i18n } = useTranslation();
    const windowEnd = windowStart + EPG_WINDOW_HOURS * 3600;
    const cells = (programs ?? []).filter((program) => program.stop > windowStart && program.start < windowEnd);

    return (
        <div className={styles['epg-row']}>
            <div className={styles['epg-channel']}>
                <button
                    type={'button'}
                    className={styles['epg-channel-button']}
                    aria-label={t('TV_WATCH_CHANNEL', { defaultValue: 'Regarder {{name}}', name: channel.name })}
                    onClick={() => onPlay(channel)}
                >
                    <span className={styles['epg-logo']}>
                        {channel.logo ? <img src={channel.logo} alt={''} loading={'lazy'} decoding={'async'} /> : <b>{channel.name.slice(0, 3)}</b>}
                    </span>
                    <span className={styles['epg-name']}>
                        {channel.name}
                        {channel.flaky ? <em>{t('TV_FLAKY', { defaultValue: 'instable' })}</em> : null}
                    </span>
                </button>
                <button
                    type={'button'}
                    className={classNames(styles['epg-fav'], { [styles['on']]: isFavorite })}
                    aria-pressed={isFavorite}
                    aria-label={isFavorite
                        ? t('TV_REMOVE_FAVORITE', { defaultValue: 'Retirer des favoris : {{name}}', name: channel.name })
                        : t('TV_ADD_FAVORITE', { defaultValue: 'Ajouter aux favoris : {{name}}', name: channel.name })}
                    onClick={() => onToggleFavorite(channel.id)}
                >
                    <Icon name={isFavorite ? 'star' : 'star-outline'} />
                </button>
            </div>
            <div className={styles['epg-line']} style={{ width: WINDOW_WIDTH_PX }}>
                {
                    programs === undefined ?
                        <span className={styles['epg-status']}>{t('TV_EPG_LOADING', { defaultValue: 'Chargement…' })}</span>
                        : cells.length === 0 ?
                            <button
                                type={'button'}
                                className={classNames(styles['epg-cell'], styles['epg-none'])}
                                style={{ left: 0, width: WINDOW_WIDTH_PX - 3 }}
                                onClick={() => onPlay(channel)}
                            >
                                <span className={styles['ec-title']}>{t('TV_EPG_UNAVAILABLE', { defaultValue: 'Programme indisponible' })}</span>
                                <span className={styles['ec-time']}>{t('TV_WATCH_LIVE', { defaultValue: 'Regarder en direct' })}</span>
                            </button>
                            :
                            cells.map((program) => {
                                const start = Math.max(program.start, windowStart);
                                const end = Math.min(program.stop, windowEnd);
                                const isNow = program.start <= now && now < program.stop;
                                const label = `${program.title}, ${formatTime(program.start, i18n.language)} – ${formatTime(program.stop, i18n.language)}${isNow ? `, ${t('TV_NOW', { defaultValue: 'En cours' })}` : ''}`;
                                return (
                                    <button
                                        key={program.start}
                                        type={'button'}
                                        className={classNames(styles['epg-cell'], {
                                            [styles['now']]: isNow,
                                            [styles['selected']]: selectedStart === program.start,
                                        })}
                                        style={{
                                            left: ((start - windowStart) / 60) * PX_PER_MINUTE,
                                            width: Math.max(2, ((end - start) / 60) * PX_PER_MINUTE - 3),
                                        }}
                                        aria-label={label}
                                        onClick={() => onSelect({ channelId: channel.id, start: program.start })}
                                    >
                                        <span className={styles['ec-title']}>{program.title}</span>
                                        <span className={styles['ec-time']}>{formatTime(program.start, i18n.language)}</span>
                                    </button>
                                );
                            })
                }
            </div>
        </div>
    );
};

const TvLive = () => {
    const { t, i18n } = useTranslation();
    const { configured } = useLastAddon();
    const { channels, catalogState, userError, reloadPlaylist } = useTvChannels(configured);
    const [windowStart] = useState(() => epgWindowStart());
    const [now, setNow] = useState(nowSeconds);
    const [category, setCategory] = useState('all');
    const [search, setSearch] = useState('');
    const [showFlaky, setShowFlaky] = useState(false);
    const [favorites, setFavorites] = useState<string[]>(readFavorites);
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [showPlaylist, setShowPlaylist] = useState(false);
    const [lastChannel, setLastChannel] = useState<LastChannel | null>(readLastChannel);
    const [playing, setPlaying] = useState<Playing | null>(null);

    useEffect(() => {
        const timer = setInterval(() => setNow(nowSeconds()), 60 * 1000);
        return () => clearInterval(timer);
    }, []);

    const visible = useMemo(
        () => filterChannels(channels, category, search, favorites, showFlaky),
        [channels, category, search, favorites, showFlaky],
    );
    const shown = visible.slice(0, limit);
    const playingChannel = playing ? playing.list[playing.index] : undefined;
    const programs = useEpg(
        playingChannel ? [...shown, playingChannel] : shown,
        windowStart,
        EPG_WINDOW_HOURS,
    );
    const programsOf = useCallback(
        (channel: TvChannel): TvEpgProgram[] => programs[epgKeyOf(channel)] ?? [],
        [programs],
    );

    const categoryCounts = useMemo(() => {
        const counts = new Map<string, number>();
        ['all', 'favorites', 'fast', 'playlist', ...CATALOG_CATEGORIES].forEach((id) => {
            counts.set(id, filterChannels(channels, id, '', favorites, showFlaky).length);
        });
        return counts;
    }, [channels, favorites, showFlaky]);

    const flakyCount = useMemo(() => channels.filter((channel) => channel.flaky).length, [channels]);
    const selectedChannel = selection ? channels.find((channel) => channel.id === selection.channelId) : undefined;
    const selectedProgram = selectedChannel && selection
        ? programsOf(selectedChannel).find((program) => program.start === selection.start) ?? null
        : null;

    const openPlayer = useCallback((channel: TvChannel) => {
        const index = visible.findIndex((candidate) => candidate.id === channel.id);
        setPlaying(index >= 0 ? { list: visible, index } : { list: [channel], index: 0 });
    }, [visible]);

    const onPlayed = useCallback((channel: TvChannel) => {
        writeLastChannel(channel);
        setLastChannel(readLastChannel());
    }, []);

    const onToggleFavorite = useCallback((channelId: string) => {
        setFavorites((current) => {
            const next = current.includes(channelId)
                ? current.filter((id) => id !== channelId)
                : [...current, channelId];
            writeFavorites(next);
            return next;
        });
    }, []);

    const categoryLabel = (id: string): string => {
        switch (id) {
            case 'all': return t('TV_CATEGORY_ALL', { defaultValue: 'Toutes' });
            case 'favorites': return t('TV_CATEGORY_FAVORITES', { defaultValue: 'Favoris' });
            case 'fast': return 'FAST';
            case 'playlist': return t('TV_CATEGORY_PLAYLIST', { defaultValue: 'Ma playlist' });
            default: return id;
        }
    };

    const categoryIds = ['all', 'favorites', ...CATALOG_CATEGORIES, 'fast', 'playlist'];
    const slots = Array.from({ length: SLOT_COUNT }, (_, index) => windowStart + index * EPG_SLOT_SECONDS);
    const nowOffsetPx = ((now - windowStart) / 60) * PX_PER_MINUTE;

    const emptyMessage = category === 'favorites'
        ? t('TV_EMPTY_FAVORITES', { defaultValue: 'Aucun favori pour le moment : clique sur l’étoile d’une chaîne.' })
        : category === 'playlist'
            ? t('TV_EMPTY_PLAYLIST', { defaultValue: 'Aucune chaîne : ajoute une playlist avec le bouton « Ma playlist ».' })
            : t('TV_EMPTY_CATEGORY', { defaultValue: 'Aucune chaîne dans cette catégorie.' });

    const renderBody = () => {
        if (!configured) return <LastAddonCta />;
        if (catalogState === 'loading') {
            return <p className={styles['message']} role={'status'} aria-busy={'true'}>{t('TV_LOADING', { defaultValue: 'Chargement…' })}</p>;
        }
        if (catalogState === 'error') {
            return <p className={styles['message']} role={'alert'}>{t('TV_LOAD_ERROR', { defaultValue: 'La TV en direct n’a pas pu être chargée.' })}</p>;
        }

        return (
            <div className={styles['tv-body']}>
                <nav className={styles['tv-cats']} aria-label={t('TV_CATEGORIES', { defaultValue: 'Catégories' })}>
                    <input
                        type={'search'}
                        className={styles['tv-search']}
                        value={search}
                        placeholder={t('TV_SEARCH_PLACEHOLDER', { defaultValue: 'Rechercher une chaîne' })}
                        aria-label={t('TV_SEARCH_PLACEHOLDER', { defaultValue: 'Rechercher une chaîne' })}
                        onChange={(event) => { setSearch(event.target.value); setLimit(PAGE_SIZE); }}
                    />
                    {categoryIds.map((id) => (
                        <button
                            key={id}
                            type={'button'}
                            className={classNames(styles['tv-cat'], { [styles['selected']]: category === id })}
                            aria-pressed={category === id}
                            onClick={() => { setCategory(id); setLimit(PAGE_SIZE); }}
                        >
                            <span>{categoryLabel(id)}</span>
                            <span className={styles['tv-cat-count']}>{categoryCounts.get(id) ?? 0}</span>
                        </button>
                    ))}
                    {
                        flakyCount > 0 ?
                            <button
                                type={'button'}
                                className={classNames(styles['tv-cat'], styles['tv-flaky'], { [styles['selected']]: showFlaky })}
                                aria-pressed={showFlaky}
                                onClick={() => setShowFlaky((value) => !value)}
                            >
                                <span>{t('TV_FLAKY_CHANNELS', { defaultValue: 'Chaînes instables' })}</span>
                                <span className={styles['tv-cat-count']}>{flakyCount}</span>
                            </button>
                            : null
                    }
                </nav>

                <div className={styles['tv-main']}>
                    {
                        userError ?
                            <p className={styles['tv-user-error']} role={'alert'}>
                                {t('TV_PLAYLIST_LOAD_ERROR', { defaultValue: 'Ta playlist n’a pas pu être chargée. Vérifie son adresse et tes identifiants.' })}
                            </p>
                            : null
                    }
                    {
                        showPlaylist ?
                            <div className={styles['tv-settings']}>
                                <TvPlaylistForm onSaved={reloadPlaylist} />
                            </div>
                            : null
                    }
                    <div className={styles['tv-detail']} aria-live={'polite'}>
                        {
                            selectedProgram && selectedChannel ?
                                <React.Fragment>
                                    {selectedProgram.icon ? <img className={styles['tvd-img']} src={selectedProgram.icon} alt={''} loading={'lazy'} /> : null}
                                    <div className={styles['tvd-text']}>
                                        <p className={styles['tvd-channel']}>{selectedChannel.name}</p>
                                        <h2 className={styles['tvd-title']}>{selectedProgram.title}</h2>
                                        <p className={styles['tvd-time']}>
                                            {t('TV_PROGRAM_TIME', {
                                                defaultValue: '{{start}} – {{stop}} · {{duration}} min',
                                                start: formatTime(selectedProgram.start, i18n.language),
                                                stop: formatTime(selectedProgram.stop, i18n.language),
                                                duration: Math.round((selectedProgram.stop - selectedProgram.start) / 60),
                                            })}
                                            {selectedProgram.start <= now && now < selectedProgram.stop
                                                ? <strong>{` · ${t('TV_NOW', { defaultValue: 'En cours' })}`}</strong>
                                                : null}
                                            {selectedProgram.category ? ` · ${selectedProgram.category}` : ''}
                                        </p>
                                        {selectedProgram.desc ? <p className={styles['tvd-desc']}>{selectedProgram.desc}</p> : null}
                                        {
                                            selectedProgram.start <= now && now < selectedProgram.stop
                                                ? <span className={styles['progress']} aria-hidden={'true'}><span style={{ width: `${progressPercent(selectedProgram, now)}%` }} /></span>
                                                : null
                                        }
                                        <Button className={styles['primary-button']} onClick={() => openPlayer(selectedChannel)}>
                                            <Icon name={'play'} />
                                            <span>{t('TV_WATCH', { defaultValue: 'Regarder' })}</span>
                                        </Button>
                                    </div>
                                </React.Fragment>
                                :
                                <p className={styles['tv-detail-hint']}>
                                    {t('TV_DETAIL_HINT', { defaultValue: 'Sélectionne un programme pour voir le détail. Entrée lance la chaîne.' })}
                                </p>
                        }
                    </div>

                    {
                        visible.length === 0 ?
                            <p className={styles['message']}>{emptyMessage}</p>
                            :
                            <div className={styles['epg']}>
                                <div className={styles['epg-scroll']}>
                                    <div className={styles['epg-inner']} style={{ width: CHANNEL_COLUMN_PX + WINDOW_WIDTH_PX }}>
                                        <div className={styles['epg-times']}>
                                            <div className={styles['epg-corner']}>{t('TV_CHANNEL', { defaultValue: 'Chaîne' })}</div>
                                            <div className={styles['epg-slots']}>
                                                {slots.map((slot) => (
                                                    <span key={slot} className={styles['epg-slot']} style={{ width: 30 * PX_PER_MINUTE }}>
                                                        {formatTime(slot, i18n.language)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {shown.map((channel) => (
                                            <EpgRow
                                                key={channel.source === 'user' ? `user:${channel.id}` : channel.id}
                                                channel={channel}
                                                programs={epgKeyOf(channel) ? programs[epgKeyOf(channel)] : []}
                                                isFavorite={favorites.includes(channel.id)}
                                                selectedStart={selection && selection.channelId === channel.id ? selection.start : null}
                                                windowStart={windowStart}
                                                now={now}
                                                onPlay={openPlayer}
                                                onSelect={setSelection}
                                                onToggleFavorite={onToggleFavorite}
                                            />
                                        ))}
                                        <div className={styles['epg-now']} style={{ left: CHANNEL_COLUMN_PX + nowOffsetPx }} aria-hidden={'true'} />
                                    </div>
                                </div>
                                {
                                    visible.length > shown.length ?
                                        <button type={'button'} className={styles['more']} onClick={() => setLimit((value) => value + PAGE_SIZE)}>
                                            {t('TV_SHOW_MORE', { defaultValue: 'Afficher plus de chaînes ({{count}})', count: visible.length - shown.length })}
                                        </button>
                                        : null
                                }
                            </div>
                    }
                </div>
            </div>
        );
    };

    return (
        <MainNavBars className={styles['tv-container']} route={'tvlive'}>
            <div className={classNames(styles['tv-content'], 'animation-fade-in')}>
                <header className={styles['tv-head']}>
                    <div>
                        <p className={styles['eyebrow']}>{t('TV_EYEBROW', { defaultValue: 'Chaînes gratuites, FAST et ta playlist' })}</p>
                        <h1 className={styles['page-title']}>{t('TV_TITLE', { defaultValue: 'TV en direct' })}</h1>
                    </div>
                    {
                        configured ?
                            <div className={styles['tv-head-actions']}>
                                {
                                    lastChannel ?
                                        <Button className={styles['primary-button']} onClick={() => setPlaying({ list: [lastChannel], index: 0 })}>
                                            <Icon name={'play'} />
                                            <span>{t('TV_RESUME_LAST', { defaultValue: 'Reprendre la dernière chaîne' })}</span>
                                        </Button>
                                        : null
                                }
                                <Button className={styles['ghost-button']} onClick={() => setShowPlaylist((value) => !value)}>
                                    <Icon name={'channels'} />
                                    <span>{t('TV_MY_PLAYLIST', { defaultValue: 'Ma playlist' })}</span>
                                </Button>
                            </div>
                            : null
                    }
                </header>
                {renderBody()}
            </div>

            {
                playing && playingChannel ?
                    createPortal(
                        <TvPlayer
                            channels={playing.list}
                            index={playing.index}
                            programsOf={programsOf}
                            onIndexChange={(index) => setPlaying((current) => (current ? { ...current, index } : current))}
                            onClose={() => setPlaying(null)}
                            onPlayed={onPlayed}
                        />,
                        document.body,
                    )
                    : null
            }
        </MainNavBars>
    );
};

const TvLiveFallback = () => (
    <MainNavBars className={styles['tv-container']} route={'tvlive'} />
);

export default withCoreSuspender(TvLive, TvLiveFallback);
