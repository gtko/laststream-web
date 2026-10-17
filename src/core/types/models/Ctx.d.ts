type Auth = {
    key: string,
    user: {
        _id: string,
        avatar: string,
        email: string,
        trakt: {
            access_token: string,
            created_at: number,
            expires_in: number,
        },
        isNewUser: boolean,
    },
};

type Settings = {
    audioLanguage: string,
    audioPassthrough: boolean,
    autoFrameRateMatching: boolean,
    bingeWatching: boolean,
    discordRpcEnabled: boolean,
    hardwareDecoding: boolean,
    gpuVideoProcessing: boolean,
    videoMode: string | null,
    escExitFullscreen: boolean,
    interfaceLanguage: string,
    interfaceScale: number,
    quitOnClose: boolean,
    hideSpoilers: boolean,
    gamepadSupport: boolean,
    nextVideoNotificationDuration: number,
    playInBackground: boolean,
    playerType: string | null,
    secondaryAudioLanguage: string | null,
    secondarySubtitlesLanguage: string | null,
    seekTimeDuration: number,
    seekShortTimeDuration: number,
    streamingServerUrl: string,
    remoteHttps: string | null,
    streamingServerWarningDismissed: Date | null,
    subtitlesBackgroundColor: string,
    subtitlesBold: boolean,
    subtitlesFont: string,
    subtitlesLanguage: string | null,
    subtitlesOffset: number,
    subtitlesOutlineColor: string,
    subtitlesSize: number,
    subtitlesTextColor: string,
    assSubtitlesStyling: boolean,
    surroundSound: boolean,
    pauseOnMinimize: boolean,
};

type Profile = {
    auth: Auth | null,
    addonsLocked: boolean,
    settings: Settings,
};

type Notifications = {
    uid: string,
    created: string,
    items: Record<string, NotificationItem[]>,
};

type NotificationItem = {
    metaId: string,
    videoId: string,
    videoReleased: string,
};

type SearchHistoryItem = {
    query: string,
    deepLinks: {
        search: string,
    },
};

type SearchHistory = SearchHistoryItem[];

type StreamingServerUrl = {
    url: string,
    mtime: Date,
};

type StreamingServerUrls = StreamingServerUrl[];

type LibraryStatsTypeCount = {
    type: string,
    count: number,
};

type LibraryStatsTopItem = {
    id: string,
    name: string,
    type: string,
    poster: string | null,
    overallTimeWatchedMs: number,
};

type LibraryStatsDailyActivity = {
    date: string,
    count: number,
};

type LibraryStats = {
    totalWatchedMs: number,
    moviesWatched: number,
    seriesCount: number,
    byType: LibraryStatsTypeCount[],
    top: LibraryStatsTopItem[],
    dailyActivity: LibraryStatsDailyActivity[],
};

type Ctx = {
    profile: Profile,
    notifications: Notifications,
    searchHistory: SearchHistory,
    streamingServerUrls: StreamingServerUrls,
    libraryStats: LibraryStats,
};
