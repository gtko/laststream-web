// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useParams, useLocation, useNavigate } = require('react-router');
const { useTranslation } = require('react-i18next');
const classnames = require('classnames');
const { useCore } = require('stremio/core');
const { useContentGamepadNavigation } = require('stremio/services/GamepadNavigation');
const { withCoreSuspender, useProfile } = require('stremio/common');
const { useNavigateWithOrigin, navigateToRoute, toPath } = require('stremio-router');
const { HorizontalNavBar, DelayedRenderer, Image, MetaPreview } = require('stremio/components');
const StreamsList = require('./StreamsList');
const VideosList = require('./VideosList');
const { default: LiveTvDetails } = require('./LiveTvDetails');
const { default: LiveTvPlaceholder } = require('./LiveTvDetails/Placeholder');
const { default: Fiche } = require('./Fiche');
const { useLastAddon } = require('stremio/common/lastAddon');
const { default: getMetaDetailsHref } = require('stremio/common/getMetaDetailsHref');
const useMetaDetails = require('./useMetaDetails');
const useSeason = require('./useSeason');
const { default: useExternalPlayerCallback } = require('./useExternalPlayerCallback');
const { SourcesDrawer, SourcesPending, pickPlayVideo, useSourcesPlay } = require('./Sources');
const styles = require('./styles');

const GAMEPAD_HANDLER_ID = 'metadetails';

const MetaDetails = () => {
    const { type, id, videoId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { getStoredOrigin } = useNavigateWithOrigin();
    const contentRef = React.useRef(null);
    const videosScrollMemoryRef = React.useRef(null);
    const { t } = useTranslation();
    const core = useCore();
    const profile = useProfile();
    const urlParams = React.useMemo(() => ({
        type,
        id,
        videoId
    }), [type, id, videoId]);
    const metaDetails = useMetaDetails(urlParams);
    const readyMeta = metaDetails.metaItem?.content.type === 'Ready' ? metaDetails.metaItem.content.content : null;
    const metaAddonUrl = metaDetails.metaItem?.addon.transportUrl;
    const isEpgProvider = React.useMemo(() => {
        return profile.addons.some((addon) => addon.transportUrl === metaAddonUrl && addon.manifest.behaviorHints?.epgProvider === true);
    }, [profile.addons, metaAddonUrl]);
    const isLiveMeta = isEpgProvider && readyMeta !== null && (readyMeta.behaviorHints?.isLive === true || readyMeta.type === 'tv');
    const lastAddon = useLastAddon();
    const ficheMode = lastAddon.configured && readyMeta !== null && !isLiveMeta;
    const deepLinks = readyMeta?.deepLinks;
    useExternalPlayerCallback(urlParams, metaDetails);
    const [season, setSeason] = useSeason(urlParams);
    const [metaPath, streamPath] = React.useMemo(() => {
        return metaDetails.selected !== null ?
            [metaDetails.selected.metaPath, metaDetails.selected.streamPath]
            :
            [null, null];
    }, [metaDetails.selected]);
    const video = React.useMemo(() => {
        return streamPath !== null && metaDetails.metaItem !== null && metaDetails.metaItem.content.type === 'Ready' ?
            metaDetails.metaItem.content.content.videos.reduce((result, video) => {
                if (video.id === streamPath.id) {
                    return video;
                }

                return result;
            }, null)
            :
            null;
    }, [metaDetails.metaItem, streamPath]);
    const startStreamPlayback = React.useCallback((stream) => {
        navigateToRoute(navigate, location, toPath(stream.deepLinks.player));
    }, [navigate, location]);
    const {
        pending: sourcesPending,
        drawerOpen: sourcesDrawerOpen,
        requestPlay,
        openDrawer: openSourcesDrawer,
        closeDrawer: closeSourcesDrawer,
    } = useSourcesPlay({
        streams: metaDetails.streams,
        hasStreamPath: streamPath !== null,
        externalPlayer: profile.settings.playerType !== null,
        onStartStream: startStreamPlayback,
    });
    const externalPlayerCallbackCanMarkWatched = React.useMemo(() => {
        return typeof video?.id === 'string' &&
            metaDetails.libraryItem?.state?.video_id === video.id &&
            metaDetails.libraryItem?.state?.duration > 0;
    }, [metaDetails.libraryItem, video]);
    const addToLibrary = React.useCallback(() => {
        if (metaDetails.metaItem === null || metaDetails.metaItem.content.type !== 'Ready') {
            return;
        }

        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'AddToLibrary',
                args: metaDetails.metaItem.content.content
            }
        });
    }, [metaDetails]);
    const removeFromLibrary = React.useCallback(() => {
        if (metaDetails.metaItem === null || metaDetails.metaItem.content.type !== 'Ready') {
            return;
        }

        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'RemoveFromLibrary',
                args: metaDetails.metaItem.content.content.id
            }
        });
    }, [metaDetails]);
    const toggleWatched = React.useCallback(() => {
        if (metaDetails.metaItem === null || metaDetails.metaItem.content.type !== 'Ready') {
            return;
        }

        core.transport.dispatch({
            action: 'MetaDetails',
            args: {
                action: 'MarkAsWatched',
                args: !metaDetails.metaItem.content.content.watched
            }
        });
    }, [metaDetails]);
    const toggleNotifications = React.useCallback(() => {
        if (metaDetails.libraryItem) {
            core.transport.dispatch({
                action: 'Ctx',
                args: {
                    action: 'ToggleLibraryItemNotifications',
                    args: [metaDetails.libraryItem._id, !metaDetails.libraryItem.state.noNotif],
                }
            });
        }
    }, [metaDetails.libraryItem]);
    const seasonOnSelect = React.useCallback((event) => {
        setSeason(event.value);
    }, [setSeason]);
    const handleEpisodeSearch = React.useCallback((season, episode) => {
        const searchVideoHash = encodeURIComponent(`${urlParams.id}:${season}:${episode}`);
        const url = location.pathname;
        const searchVideoPath = (urlParams.videoId === undefined || urlParams.videoId === null || urlParams.videoId === '') ?
            url + (!url.endsWith('/') ? '/' : '') + searchVideoHash
            : url.replace(encodeURIComponent(urlParams.videoId), searchVideoHash);
        navigate(searchVideoPath, { replace: true });
    }, [urlParams, location]);
    const resumeVideoId = metaDetails.libraryItem?.state?.video_id ?? null;
    // Lecture de la fiche : flux déjà chargé (film, ou épisode choisi) → lecture automatique ou tiroir.
    // Série sans épisode choisi : on ouvre l'épisode « à suivre » (reprise, sinon premier non vu).
    const handleFichePlay = React.useCallback(() => {
        if (streamPath !== null || (readyMeta !== null && readyMeta.videos.length === 0)) {
            requestPlay();
            return;
        }

        const nextVideo = readyMeta !== null ? pickPlayVideo(readyMeta.videos, resumeVideoId) : null;
        const nextVideoHref = nextVideo?.deepLinks?.metaDetailsStreams;
        if (typeof nextVideoHref === 'string') {
            navigateToRoute(navigate, location, toPath(nextVideoHref));
            requestPlay();
            return;
        }

        const href = getMetaDetailsHref(deepLinks);
        if (typeof href === 'string') {
            navigateToRoute(navigate, location, toPath(href));
        }
    }, [streamPath, readyMeta, resumeVideoId, deepLinks, navigate, location, requestPlay]);
    // Depuis le lecteur (« Changer de source ») : ouvre directement le tiroir, puis retire l'état de navigation.
    React.useEffect(() => {
        if (location.state?.openSources === true) {
            openSourcesDrawer();
            navigate(location.pathname + location.search, { replace: true, state: null });
        }
    }, [location.state, location.pathname, location.search, navigate, openSourcesDrawer]);
    const sourcesTitle = video !== null && typeof video.season === 'number' && typeof video.episode === 'number'
        ? `S${video.season}E${video.episode}${video.title ? ` ${video.title}` : ''}`
        : (readyMeta?.name ?? '');
    const sourcesOverlay = (
        <React.Fragment>
            {sourcesPending ? <SourcesPending /> : null}
            {sourcesDrawerOpen ? (
                <SourcesDrawer
                    title={sourcesTitle}
                    streams={metaDetails.streams}
                    video={video}
                    onClose={closeSourcesDrawer}
                />
            ) : null}
        </React.Fragment>
    );
    const renderBackgroundImageFallback = React.useCallback(() => null, []);
    const renderBackground = React.useMemo(() => !!(
        metaPath &&
        metaDetails?.metaItem &&
        metaDetails.metaItem.content.type !== 'Loading' &&
        typeof metaDetails.metaItem.content.content?.background === 'string' &&
        metaDetails.metaItem.content.content.background.length > 0
    ), [metaPath, metaDetails]);
    const originPath = React.useMemo(() => getStoredOrigin(), [getStoredOrigin]);
    useContentGamepadNavigation(contentRef, GAMEPAD_HANDLER_ID);
    if (type === 'tv' && (metaDetails.selected === null || (isEpgProvider && metaDetails.metaItem?.content.type === 'Loading'))) {
        return (
            <div className={styles['metadetails-container']}>
                <HorizontalNavBar
                    className={styles['nav-bar']}
                    backButton={true}
                    fullscreenButton={true}
                    navMenu={true}
                    originPath={originPath}
                />
                <LiveTvPlaceholder />
            </div>
        );
    }
    if (isLiveMeta) {
        return (
            <LiveTvDetails
                key={readyMeta.id}
                className={styles['metadetails-container']}
                contentRef={contentRef}
                meta={readyMeta}
                addonName={metaDetails.metaItem.addon.manifest.name}
                streams={metaDetails.streams}
                onToggleLibrary={readyMeta.inLibrary ? removeFromLibrary : addToLibrary}
            >
                <HorizontalNavBar
                    className={styles['nav-bar']}
                    backButton={true}
                    fullscreenButton={true}
                    navMenu={true}
                    originPath={originPath}
                />
            </LiveTvDetails>
        );
    }
    if (ficheMode) {
        return (
            <div className={styles['metadetails-container']}>
                <HorizontalNavBar
                    className={styles['nav-bar']}
                    backButton={true}
                    fullscreenButton={true}
                    navMenu={true}
                    originPath={originPath}
                />
                <Fiche
                    containerRef={contentRef}
                    meta={readyMeta}
                    season={season}
                    onSeasonSelect={setSeason}
                    resumeVideoId={metaDetails.libraryItem?.state?.video_id ?? null}
                    inLibrary={readyMeta.inLibrary}
                    onToggleLibrary={readyMeta.inLibrary ? removeFromLibrary : addToLibrary}
                    onPlay={handleFichePlay}
                    sources={streamPath !== null ?
                        <StreamsList
                            streams={metaDetails.streams}
                            video={video}
                            type={streamPath.type}
                            externalPlayerCallbackCanMarkWatched={externalPlayerCallbackCanMarkWatched}
                            onEpisodeSearch={handleEpisodeSearch}
                        />
                        :
                        null
                    }
                />
                {sourcesOverlay}
            </div>
        );
    }
    return (
        <div className={styles['metadetails-container']}>
            {
                renderBackground ?
                    <div className={styles['background-image-layer']}>
                        <Image
                            className={styles['background-image']}
                            src={metaDetails.metaItem.content.content.background}
                            renderFallback={renderBackgroundImageFallback}
                            alt={' '}
                        />
                    </div>
                    :
                    null
            }
            <HorizontalNavBar
                className={styles['nav-bar']}
                backButton={true}
                fullscreenButton={true}
                navMenu={true}
                originPath={originPath}
            />
            <div ref={contentRef} className={styles['metadetails-content']}>
                {
                    metaPath === null ?
                        <DelayedRenderer delay={500}>
                            <div className={styles['meta-message-container']}>
                                <Image className={styles['image']} src={require('/assets/images/empty.png')} alt={' '} />
                                <div className={styles['message-label']}>{t('ERR_NO_META_SELECTED')}</div>
                            </div>
                        </DelayedRenderer>
                        :
                        metaDetails.metaItem === null ?
                            <div className={styles['meta-message-container']}>
                                <Image className={styles['image']} src={require('/assets/images/empty.png')} alt={' '} />
                                <div className={styles['message-label']}>{t('ERR_NO_ADDONS_FOR_META')}</div>
                            </div>
                            :
                            metaDetails.metaItem.content.type === 'Err' ?
                                <div className={styles['meta-message-container']}>
                                    <Image className={styles['image']} src={require('/assets/images/empty.png')} alt={' '} />
                                    <div className={styles['message-label']}>{t('ERR_NO_META_FOUND')}</div>
                                </div>
                                :
                                metaDetails.metaItem.content.type === 'Loading' ?
                                    <MetaPreview.Placeholder className={styles['meta-preview']} />
                                    :
                                    <React.Fragment>
                                        <MetaPreview
                                            className={classnames(styles['meta-preview'], 'animation-fade-in')}
                                            name={metaDetails.metaItem.content.content.name}
                                            logo={metaDetails.metaItem.content.content.logo}
                                            runtime={metaDetails.metaItem.content.content.runtime}
                                            releaseInfo={metaDetails.metaItem.content.content.releaseInfo}
                                            released={metaDetails.metaItem.content.content.released}
                                            description={
                                                video !== null && typeof video.overview === 'string' && video.overview.length > 0 ?
                                                    video.overview
                                                    :
                                                    metaDetails.metaItem.content.content.description
                                            }
                                            links={metaDetails.metaItem.content.content.links}
                                            trailerStreams={metaDetails.metaItem.content.content.trailerStreams}
                                            inLibrary={metaDetails.metaItem.content.content.inLibrary}
                                            toggleInLibrary={metaDetails.metaItem.content.content.inLibrary ? removeFromLibrary : addToLibrary}
                                            watched={metaDetails.metaItem.content.content.watched}
                                            toggleWatched={toggleWatched}
                                            metaId={metaDetails.metaItem.content.content.id}
                                            ratingInfo={metaDetails.ratingInfo}
                                        />
                                    </React.Fragment>
                }
                <div className={styles['spacing']} />
                {
                    streamPath !== null ?
                        <StreamsList
                            className={styles['streams-list']}
                            streams={metaDetails.streams}
                            video={video}
                            type={streamPath.type}
                            externalPlayerCallbackCanMarkWatched={externalPlayerCallbackCanMarkWatched}
                            onEpisodeSearch={handleEpisodeSearch}
                        />
                        :
                        metaPath !== null ?
                            <VideosList
                                className={styles['videos-list']}
                                metaItem={metaDetails.metaItem}
                                libraryItem={metaDetails.libraryItem}
                                season={season}
                                selectedVideoId={metaDetails.libraryItem?.state?.video_id}
                                seasonOnSelect={seasonOnSelect}
                                toggleNotifications={toggleNotifications}
                                scrollMemoryRef={videosScrollMemoryRef}
                                titleKey={JSON.stringify([metaPath.type, metaPath.id])}
                            />
                            :
                            null
                }
            </div>
            {sourcesOverlay}
        </div>
    );
};

const MetaDetailsFallback = () => {
    const { type } = useParams();
    return (
        <div className={styles['metadetails-container']}>
            <HorizontalNavBar
                className={styles['nav-bar']}
                backButton={true}
                fullscreenButton={true}
                navMenu={true}
            />
            {type === 'tv' && <LiveTvPlaceholder />}
        </div>
    );
};

module.exports = withCoreSuspender(MetaDetails, MetaDetailsFallback);
