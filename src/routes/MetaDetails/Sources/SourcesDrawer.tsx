// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import Button from 'stremio/components/Button';
import { useCore } from 'stremio/core';
import useProfile from 'stremio/common/useProfile';
import { usePlatform } from 'stremio/common/Platform';
import { getLaststream } from 'stremio/common/lastAddon/stream';
import { groupByQuality, sortStreams } from 'stremio/common/lastAddon/sources';
import type { QualityGroupKey } from 'stremio/common/lastAddon/sources';
import type { LastStreamInfo } from 'stremio/common/lastAddon/types';
import { flattenReadyStreams } from './useSourcesPlay';
import { getStreamHref, getStreamTarget } from './getStreamHref';
import { formatBitrate, formatSize, languageLabel } from './format';
import styles from './SourcesDrawer.less';

type CoreStreamEntries = MetaDetails['streams'];

type SourcesDrawerProps = {
    title: string;
    streams: CoreStreamEntries;
    video: Video | null;
    onClose: () => void;
};

type Badge = {
    key: string;
    label: string;
    accent?: boolean;
};

type TranslateFn = (key: string, options: { defaultValue: string }) => string;

const GROUP_LABELS: Record<Exclude<QualityGroupKey, 'other'>, string> = {
    '2160p': '2160p',
    '1080p': '1080p',
    '720p': '720p',
    'SD': 'SD',
};

const badgesOf = (info: LastStreamInfo | null, t: TranslateFn): Badge[] => {
    if (!info) return [];
    const badges: Badge[] = [];
    const language = languageLabel(info);
    if (language !== null) badges.push({ key: 'lang', label: language, accent: true });
    const size = formatSize(info.sizeBytes);
    if (size !== null) badges.push({ key: 'size', label: size });
    const bitrate = formatBitrate(info.estBitrateKbps);
    if (bitrate !== null) badges.push({ key: 'bitrate', label: bitrate });
    if (info.cached) badges.push({ key: 'cached', label: t('SOURCES_CACHED', { defaultValue: 'Cache debrid' }), accent: true });
    if (info.hdr.length > 0) badges.push({ key: 'hdr', label: info.hdr.join(' · ') });
    if (info.codec !== 'unknown') badges.push({ key: 'codec', label: info.codec });
    if (info.source !== 'unknown') badges.push({ key: 'source', label: info.source });
    return badges;
};

type SourceRowProps = {
    stream: Stream;
    addonName: string;
    onSelect: (stream: Stream) => void;
};

const SourceRow = ({ stream, addonName, onSelect }: SourceRowProps) => {
    const { t } = useTranslation();
    const platform = usePlatform();
    const info = getLaststream(stream);
    const href = getStreamHref(stream, platform.name);
    const target = getStreamTarget(stream, href);
    const badges = useMemo(() => badgesOf(info, t), [info, t]);
    const onClick = useCallback(() => onSelect(stream), [onSelect, stream]);

    return (
        <li className={styles['row']}>
            <Button className={styles['row-link']} title={addonName} href={href ?? undefined} target={target} onClick={onClick}>
                <div className={styles['row-addon']}>{addonName}</div>
                <div className={styles['row-title']}>{stream.name || addonName}</div>
                {stream.description ? <div className={styles['row-description']}>{stream.description}</div> : null}
                {badges.length > 0 ? (
                    <div className={styles['badges']}>
                        {badges.map((badge) => (
                            <span key={badge.key} className={classnames(styles['badge'], badge.accent && styles['badge-accent'])}>
                                {badge.label}
                            </span>
                        ))}
                    </div>
                ) : null}
            </Button>
        </li>
    );
};

// Tiroir des sources : streams groupés par qualité, triés par score LastAddon. Un clic lance le stream.
const SourcesDrawer = ({ title, streams, video, onClose }: SourcesDrawerProps) => {
    const { t } = useTranslation();
    const core = useCore();
    const profile = useProfile();
    const addonNameByStream = useMemo(() => {
        const names = new Map<Stream, string>();
        streams.forEach(({ addon, content }) => {
            if (content.type === 'Ready') {
                content.content.forEach((stream) => names.set(stream, addon.manifest.name));
            }
        });
        return names;
    }, [streams]);
    const groups = useMemo(() => {
        return groupByQuality(sortStreams(flattenReadyStreams(streams)));
    }, [streams]);
    const loadingCount = useMemo(() => streams.filter(({ content }) => content.type === 'Loading').length, [streams]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    // Même effet de bord que StreamsList : analytics, puis lecteur externe si configuré.
    const onSelect = useCallback((stream: Stream) => {
        core.transport.analytics({ event: 'StreamClicked', args: { stream } });
        if (profile.settings.playerType !== null) {
            core.transport.dispatch({ action: 'MetaDetails', args: { action: 'ExternalPlayerStreamOpened', args: stream } });
            if (video) {
                core.transport.dispatch({
                    action: 'MetaDetails',
                    args: { action: 'MarkVideoAsWatched', args: [{ id: video.id, released: video.released }, true] },
                });
            }
        }
        onClose();
    }, [core, profile.settings.playerType, video, onClose]);

    const hasStreams = groups.length > 0;
    const noAddons = streams.length === 0;

    return (
        <div className={styles['scrim']} onClick={onClose}>
            <aside
                className={styles['drawer']}
                role="dialog"
                aria-modal="true"
                aria-label={t('FICHE_SOURCES', { defaultValue: 'Sources' })}
                onClick={(event) => event.stopPropagation()}
            >
                <header className={styles['header']}>
                    <div className={styles['heading']}>
                        <div className={styles['title']}>{title}</div>
                        <div className={styles['subtitle']}>
                            {t('FICHE_SOURCES', { defaultValue: 'Sources' })}
                            {loadingCount > 0 ? ` · ${loadingCount} ${t('MOBILE_ADDONS_LOADING', { defaultValue: 'addons en cours' })}` : ''}
                        </div>
                    </div>
                    <button type="button" className={styles['close']} onClick={onClose} aria-label={t('CLOSE', { defaultValue: 'Fermer' })}>
                        ×
                    </button>
                </header>
                <div className={styles['body']}>
                    {noAddons ? <div className={styles['message']}>{t('ERR_NO_ADDONS_FOR_STREAMS', { defaultValue: 'Aucun addon de sources installé' })}</div> : null}
                    {!noAddons && !hasStreams && loadingCount === 0 ? <div className={styles['message']}>{t('NO_STREAM', { defaultValue: 'Aucune source trouvée' })}</div> : null}
                    {!hasStreams && loadingCount > 0 ? <div className={styles['message']}>{t('MOBILE_ADDONS_LOADING', { defaultValue: 'Recherche des sources en cours…' })}</div> : null}
                    {groups.map((group) => (
                        <section key={group.key} className={styles['group']}>
                            <h3 className={styles['group-title']}>
                                {group.key === 'other' ? t('SOURCES_OTHER_QUALITY', { defaultValue: 'Autres' }) : GROUP_LABELS[group.key]}
                            </h3>
                            <ul className={styles['list']}>
                                {group.streams.map((stream, index) => (
                                    <SourceRow
                                        key={index}
                                        stream={stream}
                                        addonName={addonNameByStream.get(stream) ?? ''}
                                        onSelect={onSelect}
                                    />
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </aside>
        </div>
    );
};

// Indicateur « recherche de la meilleure source » pendant l'attente des streams.
export const SourcesPending = () => {
    const { t } = useTranslation();
    return (
        <div className={styles['pending']} role="status" aria-live="polite">
            <span className={styles['spinner']} aria-hidden="true" />
            <span>{t('SOURCES_SEARCHING', { defaultValue: 'Recherche de la meilleure source…' })}</span>
        </div>
    );
};

export default SourcesDrawer;
