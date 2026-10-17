// Copyright (C) 2017-2026 Smart code 203358507

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SOURCES_FILE = path.join(__dirname, '..', 'src', 'common', 'lastAddon', 'sources.ts');
const SESSION_KEY = 'laststream.bandwidth';

// Même principe que lastAddon.spec.js : le module TypeScript est transpilé ici, puis évalué dans le test.
// Chaque chargement repart de zéro, donc le cache mémoire du débit est vierge à chaque test.
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

const loadSources = () => loadTsModule(SOURCES_FILE, new Map());

const createStorage = () => {
    const data = new Map();
    return {
        getItem: (key) => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => { data.set(key, String(value)); },
        removeItem: (key) => { data.delete(key); },
        clear: () => { data.clear(); },
    };
};

const setGlobal = (name, value) => {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
};

// Un stream LastAddon valide (même forme que celle lue par getLaststream).
const laststream = (overrides = {}) => ({
    resolution: '1080p',
    height: 1080,
    source: 'WEB-DL',
    codec: 'HEVC',
    hdr: [],
    languages: ['en'],
    cached: false,
    score: 50,
    estBitrateKbps: 8000,
    ...overrides,
});

const stream = (name, info, extra = {}) => ({
    name,
    url: `https://cdn.example.com/${name}.mkv`,
    ...(info === undefined ? {} : { laststream: info }),
    ...extra,
});

// Lecture d'un corps HTTP de `totalBytes` octets, servi en morceaux de 64 Ko.
const bodyOf = (totalBytes) => {
    let remaining = totalBytes;
    return {
        getReader: () => ({
            read: async () => {
                if (remaining <= 0) return { done: true, value: undefined };
                const size = Math.min(65536, remaining);
                remaining -= size;
                return { done: false, value: new Uint8Array(size) };
            },
            cancel: async () => undefined,
        }),
    };
};

let clock;
let fetchMock;
let perfNow;

beforeEach(() => {
    setGlobal('localStorage', createStorage());
    setGlobal('sessionStorage', createStorage());
    setGlobal('navigator', { connection: undefined });
    fetchMock = jest.fn();
    setGlobal('fetch', fetchMock);
    clock = 1700000000000;
    jest.spyOn(Date, 'now').mockImplementation(() => clock);
    // Durée de la mesure : 0 ms au départ, 1 s à l'arrivée (donc 1 s pour les octets lus).
    perfNow = jest.spyOn(performance, 'now');
    perfNow.mockReturnValueOnce(0).mockReturnValue(1000);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('sortStreams', () => {
    it('sorts scored streams by score descending and keeps unscored ones last in their original order', () => {
        const { sortStreams } = loadSources();
        const a = stream('a', laststream({ score: 10 }));
        const noInfoFirst = stream('no-info-1');
        const b = stream('b', laststream({ score: 90 }));
        const noInfoSecond = stream('no-info-2');
        const c = stream('c', laststream({ score: 50 }));

        expect(sortStreams([a, noInfoFirst, b, noInfoSecond, c])).toEqual([b, c, a, noInfoFirst, noInfoSecond]);
    });

    it('keeps the original order on equal scores', () => {
        const { sortStreams } = loadSources();
        const first = stream('first', laststream({ score: 40 }));
        const second = stream('second', laststream({ score: 40 }));

        expect(sortStreams([first, second])).toEqual([first, second]);
    });

    it('does not mutate its input and treats a malformed laststream as absent', () => {
        const { sortStreams } = loadSources();
        const malformed = stream('bad', { resolution: '4K' });
        const good = stream('good', laststream({ score: 5 }));
        const input = [malformed, good];

        expect(sortStreams(input)).toEqual([good, malformed]);
        expect(input).toEqual([malformed, good]);
    });
});

describe('groupByQuality', () => {
    it('groups streams in the order 2160p, 1080p, 720p, SD, other and omits empty groups', () => {
        const { groupByQuality } = loadSources();
        const uhd = stream('uhd', laststream({ resolution: '2160p', height: 2160 }));
        const hd = stream('hd', laststream({ resolution: '1080p' }));
        const sd480 = stream('480', laststream({ resolution: '480p', height: 480 }));
        const sd = stream('sd', laststream({ resolution: 'SD', height: 360 }));
        const unknown = stream('unknown', laststream({ resolution: 'unknown', height: 0 }));
        const unscored = stream('unscored');

        const groups = groupByQuality([unscored, sd, unknown, hd, sd480, uhd]);

        expect(groups.map(({ key }) => key)).toEqual(['2160p', '1080p', 'SD', 'other']);
        expect(groups[0].streams).toEqual([uhd]);
        expect(groups[2].streams).toEqual([sd, sd480]);
        expect(groups[3].streams).toEqual([unscored, unknown]);
    });

    it('returns no groups for an empty list and omits the 720p group when absent', () => {
        const { groupByQuality } = loadSources();
        expect(groupByQuality([])).toEqual([]);
        const hd = stream('hd', laststream({ resolution: '1080p' }));
        expect(groupByQuality([hd]).map(({ key }) => key)).toEqual(['1080p']);
    });
});

describe('pickAutoplay', () => {
    it('returns the best scored stream that fits 80 % of the bandwidth', () => {
        const { pickAutoplay } = loadSources();
        const best = stream('best', laststream({ score: 90, estBitrateKbps: 20000, languages: ['fr'] }));
        const fits = stream('fits', laststream({ score: 70, estBitrateKbps: 6000, languages: ['fr'] }));

        // Budget : 0.8 * 10000 = 8000 kbps ; `best` (20000) est écarté.
        expect(pickAutoplay([best, fits], 10000, 'fr')).toEqual({ stream: fits, languageFallback: false });
    });

    it('accepts a stream whose estimated bitrate is missing', () => {
        const { pickAutoplay } = loadSources();
        const unknownRate = stream('unknown-rate', laststream({ score: 30, estBitrateKbps: null, languages: ['fr'] }));
        const heavy = stream('heavy', laststream({ score: 80, estBitrateKbps: 50000, languages: ['fr'] }));

        expect(pickAutoplay([heavy, unknownRate], 1000, 'fr')?.stream).toBe(unknownRate);
    });

    it('applies no bitrate filter when the bandwidth is unknown', () => {
        const { pickAutoplay } = loadSources();
        const heavy = stream('heavy', laststream({ score: 80, estBitrateKbps: 50000, languages: ['fr'] }));

        expect(pickAutoplay([heavy], null, 'fr')).toEqual({ stream: heavy, languageFallback: false });
    });

    it('prefers the preferred language and flags a fallback only when none matches', () => {
        const { pickAutoplay } = loadSources();
        const vo = stream('vo', laststream({ score: 95, languages: ['en'] }));
        const vf = stream('vf', laststream({ score: 60, languages: ['fr'] }));
        const multi = stream('multi', laststream({ score: 40, languages: ['multi'] }));

        expect(pickAutoplay([vo, vf], 20000, 'fr')).toEqual({ stream: vf, languageFallback: false });
        expect(pickAutoplay([vo, multi], 20000, 'fr')).toEqual({ stream: multi, languageFallback: false });
        expect(pickAutoplay([vo], 20000, 'fr')).toEqual({ stream: vo, languageFallback: true });
    });

    it('treats a server languageFallback flag as not matching the preferred language', () => {
        const { pickAutoplay } = loadSources();
        const flagged = stream('flagged', laststream({ score: 90, languages: ['fr'], languageFallback: true }));
        const vo = stream('vo', laststream({ score: 10, languages: ['en'] }));

        // Aucun flux VF réel : repli sur le meilleur score, signalé comme VO.
        expect(pickAutoplay([flagged, vo], 20000, 'fr')).toEqual({ stream: flagged, languageFallback: true });
        const realFr = stream('real-fr', laststream({ score: 20, languages: ['fr'] }));
        expect(pickAutoplay([flagged, realFr, vo], 20000, 'fr')).toEqual({ stream: realFr, languageFallback: false });
    });

    it('ignores streams without a valid laststream object', () => {
        const { pickAutoplay } = loadSources();
        expect(pickAutoplay([stream('plain')], 20000, 'fr')).toBeNull();
    });

    it('returns null when no stream fits the bandwidth', () => {
        const { pickAutoplay } = loadSources();
        const heavy = stream('heavy', laststream({ estBitrateKbps: 50000 }));

        expect(pickAutoplay([heavy], 1000, 'fr')).toBeNull();
        expect(pickAutoplay([], 1000, 'fr')).toBeNull();
    });

    it('defaults the preferred language to French', () => {
        const { pickAutoplay } = loadSources();
        const vo = stream('vo', laststream({ score: 90, languages: ['en'] }));
        const vf = stream('vf', laststream({ score: 10, languages: ['fr'] }));

        expect(pickAutoplay([vo, vf], null)).toEqual({ stream: vf, languageFallback: false });
    });
});

describe('combineBandwidthKbps', () => {
    it('takes the lower of network and measured estimates, or whichever exists', () => {
        const { combineBandwidthKbps } = loadSources();
        expect(combineBandwidthKbps(10000, 4000)).toBe(4000);
        expect(combineBandwidthKbps(3000, 9000)).toBe(3000);
        expect(combineBandwidthKbps(10000, null)).toBe(10000);
        expect(combineBandwidthKbps(null, 4000)).toBe(4000);
        expect(combineBandwidthKbps(null, null)).toBeNull();
    });
});

describe('measureBandwidthKbps', () => {
    it('combines navigator.connection.downlink (Mbps to kbps) with a timed probe on the stream URL', async () => {
        const { measureBandwidthKbps } = loadSources();
        setGlobal('navigator', { connection: { downlink: 20 } });
        fetchMock.mockResolvedValue({ ok: true, status: 206, body: bodyOf(131072) });

        // 131072 octets en 1 s = 1048.576 kbit/s : plus faible que 20 Mbps.
        await expect(measureBandwidthKbps('https://cdn.example.com/a.mkv')).resolves.toBeCloseTo(1048.576, 3);
        expect(fetchMock).toHaveBeenCalledWith(
            'https://cdn.example.com/a.mkv',
            expect.objectContaining({ headers: { Range: 'bytes=0-262143' } }),
        );
    });

    it('uses the network estimate alone when the probe fails', async () => {
        const { measureBandwidthKbps } = loadSources();
        setGlobal('navigator', { connection: { downlink: 5 } });
        fetchMock.mockRejectedValue(new Error('network down'));

        await expect(measureBandwidthKbps('https://cdn.example.com/a.mkv')).resolves.toBe(5000);
    });

    it('ignores a probe that is too small to be meaningful', async () => {
        const { measureBandwidthKbps } = loadSources();
        setGlobal('navigator', { connection: undefined });
        fetchMock.mockResolvedValue({ ok: true, status: 200, body: bodyOf(4096) });

        await expect(measureBandwidthKbps('https://cdn.example.com/a.mkv')).resolves.toBeNull();
    });

    it('falls back to the bundled small file when there is no stream URL', async () => {
        const { measureBandwidthKbps, BANDWIDTH_FALLBACK_PROBE_URL } = loadSources();
        fetchMock.mockResolvedValue({ ok: true, status: 200, body: bodyOf(98000) });

        await measureBandwidthKbps(null);
        expect(fetchMock.mock.calls[0][0]).toBe(BANDWIDTH_FALLBACK_PROBE_URL);
    });

    it('caches the result for 10 minutes in sessionStorage and memory', async () => {
        const { measureBandwidthKbps } = loadSources();
        setGlobal('navigator', { connection: { downlink: 8 } });

        await expect(measureBandwidthKbps(null)).resolves.toBe(8000);
        const probesAfterFirstCall = fetchMock.mock.calls.length;
        clock += 9 * 60 * 1000;
        await expect(measureBandwidthKbps(null)).resolves.toBe(8000);
        expect(fetchMock.mock.calls.length).toBe(probesAfterFirstCall);
        expect(JSON.parse(sessionStorage.getItem(SESSION_KEY)).expiresAt).toBe(1700000000000 + 10 * 60 * 1000);
    });

    it('measures again once the cache entry has expired', async () => {
        const { measureBandwidthKbps } = loadSources();
        setGlobal('navigator', { connection: { downlink: 8 } });
        await measureBandwidthKbps(null);

        setGlobal('navigator', { connection: { downlink: 2 } });
        clock += 10 * 60 * 1000 + 1;
        await expect(measureBandwidthKbps(null)).resolves.toBe(2000);
    });

    it('reads a valid entry from sessionStorage in a fresh module', async () => {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ kbps: 7777, expiresAt: clock + 60000 }));
        const { measureBandwidthKbps } = loadSources();

        await expect(measureBandwidthKbps(null)).resolves.toBe(7777);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns null when neither the network nor the probe gives an estimate', async () => {
        const { measureBandwidthKbps } = loadSources();
        fetchMock.mockRejectedValue(new Error('blocked'));

        await expect(measureBandwidthKbps('https://cdn.example.com/a.mkv')).resolves.toBeNull();
    });
});

describe('getStreamHttpUrl and getQualityGroupKey', () => {
    it('returns only http(s) stream URLs', () => {
        const { getStreamHttpUrl } = loadSources();
        expect(getStreamHttpUrl({ url: 'https://a.example/x.mkv' })).toBe('https://a.example/x.mkv');
        expect(getStreamHttpUrl({ url: 'magnet:?xt=urn:btih:abc' })).toBeNull();
        expect(getStreamHttpUrl({ infoHash: 'abc' })).toBeNull();
    });

    it('maps a missing laststream object to the other group', () => {
        const { getQualityGroupKey } = loadSources();
        expect(getQualityGroupKey({ name: 'plain' })).toBe('other');
    });
});
