// Copyright (C) 2017-2026 Smart code 203358507

// Réglages persistés (localStorage `laststream.lastaddon`). `config` est la configuration chiffrée renvoyée par /config/encode.
export type LastAddonSettings = {
    base: string;
    config: string;
};

export type LastAddonSnapshot = {
    configured: boolean;
    base: string;
    config: string;
};

// Objet `laststream` joint à chaque stream par le lastAddon (voir lastaddon/src/engine/format.ts).
export type LastStreamResolution = '2160p' | '1080p' | '720p' | '480p' | 'SD' | 'unknown';
export type LastStreamSource = 'REMUX' | 'BluRay' | 'WEB-DL' | 'WEBRip' | 'HDTV' | 'DVDRip' | 'CAM' | 'TS' | 'SCR' | 'unknown';
export type LastStreamCodec = 'HEVC' | 'AVC' | 'AV1' | 'unknown';
export type LastStreamHdr = 'HDR10' | 'HDR10+' | 'DV' | 'HLG';
export type LastStreamLang = 'fr' | 'en' | 'es' | 'de' | 'it' | 'multi' | 'original';
export type LastStreamFrVariant = 'VFF' | 'VFQ' | 'VF2' | 'TRUEFRENCH' | 'FRENCH' | 'VOSTFR' | 'SUBFRENCH';

export type LastStreamInfo = {
    resolution: LastStreamResolution;
    height: number;
    source: LastStreamSource;
    codec: LastStreamCodec;
    hdr: LastStreamHdr[];
    languages: LastStreamLang[];
    frVariant?: LastStreamFrVariant;
    sizeBytes?: number;
    cached: boolean;
    seeders?: number;
    score: number;
    estBitrateKbps: number | null;
    languageFallback?: boolean;
};

// Métadonnées externes (TMDB passthrough, MDBList, TVDB).
export type MdblistType = 'movie' | 'tv' | 'show';

export type MdblistRatings = {
    imdb: number | null;
    rottentomatoes: number | null;
    rottentomatoes_audience: number | null;
    metacritic: number | null;
    letterboxd: number | null;
    tmdb: number | null;
    trakt: number | null;
};

export type MdblistResponse = {
    ratings: MdblistRatings;
    score: number | null;
};

export type TvdbSeason = {
    number: number;
};

export type TvdbSeriesResponse = {
    status: string;
    seasonCount: number;
    seasons: TvdbSeason[];
    nextAired: string;
    lastAired: string;
};

export type TmdbFindResult = {
    type: 'movie' | 'tv';
    tmdbId: number;
};

export type TmdbFindResponse = {
    movie_results?: { id: number }[];
    tv_results?: { id: number }[];
};

export type TmdbExternalIds = {
    imdb_id?: string | null;
};

// IA : recommandations, « Pourquoi tu vas aimer », « Pourquoi cette personne ».
export type RecommendEntry = {
    title: string;
    year?: number | null;
    type?: 'movie' | 'tv';
};

export type RecommendRequest = {
    history: RecommendEntry[];
    liked: RecommendEntry[];
};

export type RecommendItem = {
    id: number;
    media_type: 'movie' | 'tv';
    title?: string;
    name?: string;
    poster_path?: string | null;
    reason_fr?: string;
    [key: string]: unknown;
};

export type RecommendResponse = {
    items: RecommendItem[];
};

export type WhyRequest = {
    title: string;
    year?: string | number;
    overview?: string;
    genres?: string[];
};

export type PersonWhyRequest = {
    name: string;
    knownFor: string[];
};

export type TextResponse = {
    text: string;
};

// TV : chaînes, programme et import de playlist.
export type TvChannel = {
    id: string;
    name: string;
    logo: string;
    group: string;
    cat: string;
    source: string;
    fast: boolean;
    url: string;
    epgId: string;
    flaky: boolean;
};

export type TvEpgProgram = {
    channelId: string;
    start: number;
    stop: number;
    title: string;
    desc: string;
    icon: string;
    category: string;
};

export type TvImportRequest = {
    type: 'm3u';
    url: string;
} | {
    type: 'xtream';
    server: string;
    username: string;
    password: string;
};

export type TvImportResponse = {
    channels: TvChannel[];
    count: number;
};

// Configuration : schéma, chiffrement, test d'un service.
export type ConfigSchemaDocument = Record<string, unknown>;

export type EncodeConfigResponse = {
    config: string;
};

export type TestableService = 'alldebrid';

export type SourceCheck = {
    name: string;
    type: 'upstream' | 'torznab' | 'alldebrid';
    ok: boolean;
    error?: string;
};

export type LastAddonTestResponse = {
    sources: SourceCheck[];
};

export type ServiceTestResult = {
    ok: boolean;
    error?: string;
};
