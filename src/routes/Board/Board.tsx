// Copyright (C) 2017-2026 Smart code 203358507

import React, { useMemo } from 'react';
import classnames from 'classnames';
import useTranslate from 'stremio/common/useTranslate';
import useVisibleCatalogs from 'stremio/common/useVisibleCatalogs';
import { useLastAddon } from 'stremio/common/lastAddon';
import { useStreamingServer, useNotifications, withCoreSuspender, useProfile } from 'stremio/common';
import { EventModal, LiveTvContinueWatchingItem, MainNavBars, MetaItem, MetaRow } from 'stremio/components';
import useBoard from './useBoard';
import useLiveTvContinueWatching from './useLiveTvContinueWatching';
import { HomeRows } from './HomeRows';
import StreamingServerWarning from './StreamingServerWarning';
import styles from './styles.less';

const THRESHOLD = 5;
const EMPTY_CATALOGS: never[] = [];

const Board = () => {
    const t = useTranslate();
    const { configured } = useLastAddon();
    const streamingServer = useStreamingServer();
    const liveTvContinueWatching = useLiveTvContinueWatching();
    const [board, loadBoardRows] = useBoard();
    const notifications = useNotifications();
    const profile = useProfile();
    const liveTvCatalog = useMemo(() => ({
        items: (Array.isArray(liveTvContinueWatching.items) ? liveTvContinueWatching.items : [])
            .map((item) => ({ ...item, posterShape: 'landscape' })),
    }), [liveTvContinueWatching.items]);
    const showStreamingServerWarning = useMemo(() => {
        const dismissedAt = profile.settings.streamingServerWarningDismissed;
        return streamingServer.settings !== null && streamingServer.settings.type === 'Err' && (
            dismissedAt === null ||
            isNaN(dismissedAt.getTime()) ||
            dismissedAt.getTime() < Date.now());
    }, [profile.settings, streamingServer.settings]);
    // Les rangées de l’accueil forment un seul enfant du conteneur de défilement, suivi des catalogues addons.
    const { catalogRows, scrollContainerRef, onScroll } = useVisibleCatalogs({
        catalogs: board.catalogs ?? EMPTY_CATALOGS,
        loadRange: loadBoardRows,
        leadingRows: 1,
        preloadRows: THRESHOLD,
    });
    return (
        <div className={styles['board-container']}>
            <EventModal />
            <MainNavBars className={styles['board-content-container']} route={'board'}>
                <div ref={scrollContainerRef} className={styles['board-content']} onScroll={onScroll}>
                    <div className={styles['board-sections']}>
                        <HomeRows configured={configured} />
                        {
                            liveTvCatalog.items.length > 0 ?
                                <MetaRow
                                    className={classnames(styles['board-row'], styles['board-row-landscape'], 'animation-fade-in')}
                                    title={t.string('BOARD_CONTINUE_WATCHING_LIVE')}
                                    catalog={liveTvCatalog}
                                    itemComponent={LiveTvContinueWatchingItem}
                                    notifications={notifications}
                                />
                                :
                                null
                        }
                    </div>
                    {catalogRows.map(({ catalog, index }) => {
                        switch (catalog.content?.type) {
                            case 'Ready': {
                                return (
                                    <MetaRow
                                        key={index}
                                        className={classnames(styles['board-row'], styles[`board-row-${catalog.content.content[0].posterShape}`], 'animation-fade-in')}
                                        catalog={catalog}
                                        itemComponent={MetaItem}
                                    />
                                );
                            }
                            case 'Err': {
                                if (catalog.content.content !== 'EmptyContent') {
                                    return (
                                        <MetaRow
                                            key={index}
                                            className={classnames(styles['board-row'], 'animation-fade-in')}
                                            catalog={catalog}
                                            message={catalog.content.content}
                                        />
                                    );
                                }
                                return null;
                            }
                            default: {
                                return (
                                    <MetaRow.Placeholder
                                        key={index}
                                        className={classnames(styles['board-row'], styles['board-row-poster'], 'animation-fade-in')}
                                        catalog={catalog}
                                        title={t.catalogTitle(catalog)}
                                    />
                                );
                            }
                        }
                    })}
                </div>
            </MainNavBars>
            {
                showStreamingServerWarning ?
                    <StreamingServerWarning className={styles['board-warning-container']} />
                    :
                    null
            }
        </div>
    );
};

const BoardFallback = () => (
    <div className={styles['board-container']}>
        <MainNavBars className={styles['board-content-container']} route={'board'} />
    </div>
);

export default withCoreSuspender(Board, BoardFallback);
