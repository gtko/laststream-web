// Copyright (C) 2017-2026 Smart code 203358507

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const LASTADDON_DIR = path.join(__dirname, '..', 'src', 'common', 'lastAddon');
const SETTINGS_KEY = 'laststream.lastaddon';
const DEV_KEY = 'laststream.lastaddon.dev';

// Jest n'a pas de transform TypeScript dans ce projet : les modules lastAddon sont transpilés ici avec
// la devDependency `typescript`, puis évalués dans le contexte du test. Chaque chargement repart de zéro,
// ce qui permet de relire le mode dev et le cache mémoire à chaque test.
const resolveTs = (fromDir, request) => {
    const base = path.resolve(fromDir, request);
    return [`${base}.ts`, path.join(base, 'index.ts')].find((candidate) => fs.existsSync(candidate)) || null;
};

const loadTsModule = (file, registry) => {
    if (registry.has(file)) return registry.get(file).exports;
    const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        fileName: file,
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            esModuleInterop: true,
        },
    });
    const module = { exports: {} };
    registry.set(file, module);
    const localRequire = (request) => {
        if (request.startsWith('.')) {
            const resolved = resolveTs(path.dirname(file), request);
            if (resolved) return loadTsModule(resolved, registry);
        }
        return require(request);
    };
    new Function('exports', 'require', 'module', '__filename', '__dirname', outputText)(
        module.exports,
        localRequire,
        module,
        file,
        path.dirname(file),
    );
    return module.exports;
};

const loadLastAddon = () => loadTsModule(path.join(LASTADDON_DIR, 'index.ts'), new Map());

const createStorage = () => {
    const data = new Map();
    return {
        getItem: (key) => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => { data.set(key, String(value)); },
        removeItem: (key) => { data.delete(key); },
        clear: () => { data.clear(); },
        key: (index) => Array.from(data.keys())[index] ?? null,
        get length() { return data.size; },
    };
};

const setGlobal = (name, value) => {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
};

const jsonResponse = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

const captureError = (fn) => {
    try {
        fn();
    } catch (error) {
        return error;
    }
    throw new Error('expected the call to throw');
};

const BASE = 'https://addon.example.com';
const CONFIG = 'abc_-XYZ';

let clock;
let fetchMock;

beforeEach(() => {
    setGlobal('localStorage', createStorage());
    setGlobal('sessionStorage', createStorage());
    fetchMock = jest.fn();
    setGlobal('fetch', fetchMock);
    clock = 1700000000000;
    jest.spyOn(Date, 'now').mockImplementation(() => clock);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('ltUrl', () => {
    it('builds {base}/{config}/lt/<path> in normal mode', () => {
        const api = loadLastAddon();
        api.setBase(`${BASE}/`);
        api.setConfig(CONFIG);

        expect(api.DEV_PROTOTYPE_MODE).toBe(false);
        expect(api.ltUrl('tv/channels')).toBe(`${BASE}/${CONFIG}/lt/tv/channels`);
        expect(api.ltUrl('/tmdb/movie/550')).toBe(`${BASE}/${CONFIG}/lt/tmdb/movie/550`);
    });

    it('serializes query values and drops null and undefined ones', () => {
        const api = loadLastAddon();
        api.setBase(BASE);
        api.setConfig(CONFIG);

        expect(api.ltUrl('tv/epg', { ids: 'a,b', from: 1700000000, to: undefined, extra: null }))
            .toBe(`${BASE}/${CONFIG}/lt/tv/epg?ids=a%2Cb&from=1700000000`);
    });

    it('throws not_configured in normal mode until base and config are both set', () => {
        const api = loadLastAddon();
        expect(api.isConfigured()).toBe(false);
        expect(captureError(() => api.ltUrl('tv/channels'))).toMatchObject({ kind: 'not_configured' });

        api.setBase(BASE);
        expect(captureError(() => api.ltUrl('tv/channels'))).toBeInstanceOf(api.LastAddonError);
        expect(api.isConfigured()).toBe(false);

        api.setConfig(CONFIG);
        expect(api.isConfigured()).toBe(true);
    });

    it('uses the prototype API in dev mode, without base or config', () => {
        localStorage.setItem(DEV_KEY, '1');
        const api = loadLastAddon();

        expect(api.DEV_PROTOTYPE_MODE).toBe(true);
        expect(api.isConfigured()).toBe(true);
        expect(api.ltUrl('tmdb/movie/550')).toBe('http://localhost:8089/api/tmdb/movie/550');
        expect(api.ltUrl('tv/hls', { u: 'https://x.test/a.m3u8' }))
            .toBe('http://localhost:8089/api/tv/hls?u=https%3A%2F%2Fx.test%2Fa.m3u8');
    });

    it('rejects a base that is not http(s)', () => {
        const api = loadLastAddon();
        expect(captureError(() => api.setBase('ftp://addon.example.com'))).toMatchObject({ kind: 'invalid_base' });
        expect(api.getBase()).toBe('');
    });
});

describe('settings persistence and subscribe', () => {
    it('persists {base, config} as JSON under laststream.lastaddon and reloads it', () => {
        const api = loadLastAddon();
        api.setBase(`${BASE}/`);
        api.setConfig(CONFIG);

        expect(JSON.parse(localStorage.getItem(SETTINGS_KEY))).toEqual({ base: BASE, config: CONFIG });
        const reloaded = loadLastAddon();
        expect(reloaded.getBase()).toBe(BASE);
        expect(reloaded.getConfig()).toBe(CONFIG);
    });

    it('notifies subscribers only on real changes', () => {
        const api = loadLastAddon();
        const listener = jest.fn();
        const unsubscribe = api.subscribe(listener);

        api.setBase(BASE);
        api.setBase(BASE);
        api.setConfig(CONFIG);
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        api.setConfig('other');
        expect(listener).toHaveBeenCalledTimes(2);
    });
});

describe('cache', () => {
    it('serves a repeated GET from cache for 10 minutes, then refetches', async () => {
        const api = loadLastAddon();
        api.setBase(BASE);
        api.setConfig(CONFIG);
        fetchMock.mockResolvedValue(jsonResponse({ id: 550 }));

        expect(await api.tmdb('movie/550')).toEqual({ id: 550 });
        await api.tmdb('movie/550');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        clock += 10 * 60 * 1000 - 1;
        await api.tmdb('movie/550');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        clock += 2;
        await api.tmdb('movie/550');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('defaults the TTL to 10 minutes', () => {
        const transport = loadTsModule(path.join(LASTADDON_DIR, 'transport.ts'), new Map());
        expect(transport.DEFAULT_TTL_MS).toBe(600000);
    });

    it('shares one in-flight request between concurrent callers', async () => {
        const api = loadLastAddon();
        api.setBase(BASE);
        api.setConfig(CONFIG);
        fetchMock.mockResolvedValue(jsonResponse({ ratings: {}, score: 7 }));

        const [first, second] = await Promise.all([api.mdblist('movie', 'tt0133093'), api.mdblist('movie', 'tt0133093')]);
        expect(first).toBe(second);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('reads a fresh entry back from sessionStorage after a reload', async () => {
        const api = loadLastAddon();
        api.setBase(BASE);
        api.setConfig(CONFIG);
        fetchMock.mockResolvedValue(jsonResponse({ channels: [], count: 0 }));
        await api.tvImport({ type: 'm3u', url: 'https://x.test/list.m3u' });
        await api.tvChannels();
        await api.tvChannels();
        expect(fetchMock).toHaveBeenCalledTimes(2);

        const reloaded = loadLastAddon();
        await reloaded.tvChannels();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not cache errors and maps HTTP failures to LastAddonError', async () => {
        const api = loadLastAddon();
        api.setBase(BASE);
        api.setConfig(CONFIG);
        fetchMock
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(jsonResponse({ error: 'not_found' }, 404))
            .mockResolvedValueOnce(jsonResponse({ items: [] }));

        await expect(api.tvChannels()).rejects.toMatchObject({ kind: 'network' });
        await expect(api.tvChannels()).rejects.toMatchObject({ kind: 'http', status: 404, code: 'not_found' });
        await expect(api.tvChannels()).resolves.toEqual({ items: [] });
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});

describe('configurator', () => {
    it('builds the manifest URL from the encoded config', () => {
        const api = loadLastAddon();
        api.setBase(BASE);
        expect(api.manifestUrl(CONFIG)).toBe(`${BASE}/${CONFIG}/manifest.json`);
    });

    it('returns the ok flag of the service matching the requested service', async () => {
        const api = loadLastAddon();
        api.setBase(BASE);
        fetchMock.mockResolvedValue(jsonResponse({
            sources: [{ name: 'AllDebrid', type: 'alldebrid', ok: false, error: 'invalid key' }],
        }));

        await expect(api.testService('alldebrid', 'secret')).resolves.toEqual({ ok: false, error: 'invalid key' });
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`${BASE}/config/test`);
        expect(JSON.parse(init.body)).toEqual({ debrid: { service: 'alldebrid', apiKey: 'secret' } });
    });
});

describe('getLaststream', () => {
    const valid = {
        resolution: '1080p',
        height: 1080,
        source: 'WEB-DL',
        codec: 'HEVC',
        hdr: ['HDR10'],
        languages: ['fr', 'multi'],
        frVariant: 'VFQ',
        sizeBytes: 2147483648,
        cached: true,
        seeders: 42,
        score: 812,
        estBitrateKbps: 6100,
        languageFallback: true,
    };

    it('returns the laststream info of a stream, keeping only known fields', () => {
        const api = loadLastAddon();
        const info = api.getLaststream({ name: 'LastStream', laststream: { ...valid, unknownField: 1 } });
        expect(info).toEqual(valid);
    });

    it('accepts the optional fields when they are absent and a null bitrate', () => {
        const api = loadLastAddon();
        const minimal = {
            resolution: 'SD',
            height: 480,
            source: 'unknown',
            codec: 'unknown',
            hdr: [],
            languages: ['original'],
            cached: false,
            score: 0,
            estBitrateKbps: null,
        };
        expect(api.getLaststream({ laststream: minimal })).toEqual(minimal);
    });

    it('returns null when laststream is missing or malformed', () => {
        const api = loadLastAddon();
        expect(api.getLaststream({ name: 'plain' })).toBeNull();
        expect(api.getLaststream(null)).toBeNull();
        expect(api.getLaststream({ laststream: { ...valid, resolution: '4K' } })).toBeNull();
        expect(api.getLaststream({ laststream: { ...valid, cached: 'yes' } })).toBeNull();
        expect(api.getLaststream({ laststream: { ...valid, hdr: ['HDR99'] } })).toBeNull();
        expect(api.getLaststream({ laststream: { ...valid, estBitrateKbps: undefined } })).toBeNull();
    });
});

const SIG = 'SIG_abc-_9';

describe('hlsUrl', () => {
    it('builds the signed proxy URL exactly as returned: u then s', () => {
        const api = loadLastAddon();
        api.setBase(BASE);
        api.setConfig(CONFIG);

        expect(api.hlsUrl('https://x.test/a.m3u8', SIG))
            .toBe(`${BASE}/${CONFIG}/lt/tv/hls?u=https%3A%2F%2Fx.test%2Fa.m3u8&s=${SIG}`);
    });

    it('never builds an unsigned URL: no signature gives null and no request', () => {
        const api = loadLastAddon();
        api.setBase(BASE);
        api.setConfig(CONFIG);

        expect(api.hlsUrl('https://x.test/a.m3u8', null)).toBeNull();
        expect(api.hlsUrl('https://x.test/a.m3u8', undefined)).toBeNull();
        expect(api.hlsUrl('https://x.test/a.m3u8', '')).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('tmdb parameter sanitizer', () => {
    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    it('keeps whitelisted parameters and drops the others', () => {
        const api = loadLastAddon();
        const kept = api.sanitizeTmdbParams({
            language: 'fr-FR',
            'primary_release_date.gte': '2020-01-01',
            include_adult: 'false',
            external_source: 'imdb_id',
            include_video_language: 'fr,en,null',
            with_release_type: '2|3',
        });

        expect(kept).toEqual({
            language: 'fr-FR',
            'primary_release_date.gte': '2020-01-01',
            include_adult: 'false',
        });
    });

    it('sends only whitelisted parameters through tmdb()', async () => {
        const api = loadLastAddon();
        api.setBase(BASE);
        api.setConfig(CONFIG);
        fetchMock.mockResolvedValue(jsonResponse({ results: [] }));

        await api.tmdb('discover/movie', { sort_by: 'popularity.desc', include_video_language: 'fr' });
        const [url] = fetchMock.mock.calls[0];
        expect(url).toBe(`${BASE}/${CONFIG}/lt/tmdb/discover/movie?sort_by=popularity.desc`);
    });

    it('warns once per dropped parameter in dev, and stays silent in production', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const api = loadLastAddon();

        api.sanitizeTmdbParams({ external_source: 'imdb_id' });
        api.sanitizeTmdbParams({ external_source: 'imdb_id' });
        expect(warn).toHaveBeenCalledTimes(1);

        const previous = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        try {
            api.sanitizeTmdbParams({ other_param: 'x' });
            expect(warn).toHaveBeenCalledTimes(1);
        } finally {
            process.env.NODE_ENV = previous;
        }
    });
});

describe('AI texts', () => {
    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    it('why sends only {type, tmdbId, language} in normal mode', async () => {
        const api = loadLastAddon();
        api.setBase(BASE);
        api.setConfig(CONFIG);
        fetchMock.mockResolvedValue(jsonResponse({ text: 'Pour toi.' }));

        await expect(api.why({
            type: 'movie',
            tmdbId: 550,
            language: 'fr',
            legacy: { title: 'Fight Club', overview: 'Un homme…', genres: ['Drame'] },
        })).resolves.toEqual({ text: 'Pour toi.' });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`${BASE}/${CONFIG}/lt/why`);
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toEqual({ type: 'movie', tmdbId: 550, language: 'fr' });
    });

    it('personWhy sends only {type, tmdbId, language} in normal mode', async () => {
        const api = loadLastAddon();
        api.setBase(BASE);
        api.setConfig(CONFIG);
        fetchMock.mockResolvedValue(jsonResponse({ text: 'Acteur.' }));

        await api.personWhy({ type: 'person', tmdbId: 287, language: 'en', legacy: { name: 'Brad Pitt', knownFor: ['Fight Club'] } });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`${BASE}/${CONFIG}/lt/person-why`);
        expect(JSON.parse(init.body)).toEqual({ type: 'person', tmdbId: 287, language: 'en' });
    });

    it('keeps the legacy body in DEV_PROTOTYPE_MODE', async () => {
        localStorage.setItem(DEV_KEY, '1');
        const api = loadLastAddon();
        fetchMock.mockResolvedValue(jsonResponse({ text: 'Proto.' }));

        await api.why({ type: 'tv', tmdbId: 1399, language: 'fr', legacy: { title: 'Game of Thrones', year: 2011 } });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('http://localhost:8089/api/why');
        expect(JSON.parse(init.body)).toEqual({ type: 'tv', tmdbId: 1399, language: 'fr', title: 'Game of Thrones', year: 2011 });
    });

    it('aiLanguage takes the short code of the interface language, then of the browser', () => {
        const api = loadLastAddon();
        setGlobal('navigator', { language: 'de-DE' });

        expect(api.aiLanguage('pt-BR')).toBe('pt');
        expect(api.aiLanguage('')).toBe('de');
        expect(api.aiLanguage(undefined)).toBe('de');
        setGlobal('navigator', undefined);
        expect(api.aiLanguage(undefined)).toBe('fr');
    });
});

describe('transport limits', () => {
    const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

    it('keeps at most 6 requests in flight and starts the next one when a slot frees', async () => {
        const api = loadLastAddon();
        api.setBase(BASE);
        api.setConfig(CONFIG);
        const settle = [];
        fetchMock.mockImplementation(() => new Promise((resolve) => { settle.push(resolve); }));

        for (let index = 0; index < 10; index += 1) {
            api.mdblist('movie', `tt${index}`);
        }
        await flush();
        expect(fetchMock).toHaveBeenCalledTimes(6);

        settle[0](jsonResponse({ ratings: {}, score: 1 }));
        await flush();
        expect(fetchMock).toHaveBeenCalledTimes(7);
    });

    it('floors the cache lifetime at 5 minutes', async () => {
        const api = loadLastAddon();
        const load = jest.fn(async () => 'value');

        await api.cachedRequest('short-ttl', load, 1000);
        clock += 4 * 60 * 1000;
        await api.cachedRequest('short-ttl', load, 1000);
        expect(load).toHaveBeenCalledTimes(1);

        clock += 60 * 1000 + 1;
        await api.cachedRequest('short-ttl', load, 1000);
        expect(load).toHaveBeenCalledTimes(2);
    });
});
