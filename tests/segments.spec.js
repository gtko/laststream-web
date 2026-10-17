// Copyright (C) 2017-2026 Smart code 203358507

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SEGMENTS_FILE = path.join(__dirname, '..', 'src', 'common', 'lastAddon', 'segments.ts');
const SETTINGS_KEY = 'laststream.lastaddon';

// Même principe que sources.spec.js : le module TypeScript est transpilé ici, puis évalué dans le test.
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

const BASE = 'https://addon.example.com';
const CONFIG = 'abc_-XYZ';

const loadSegments = () => loadTsModule(SEGMENTS_FILE, new Map());

let fetchMock;

beforeEach(() => {
    setGlobal('localStorage', createStorage());
    setGlobal('sessionStorage', createStorage());
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ base: BASE, config: CONFIG }));
    fetchMock = jest.fn();
    setGlobal('fetch', fetchMock);
});

afterEach(() => {
    jest.restoreAllMocks();
});

const jsonResponse = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

const intro = { kind: 'intro', start: 30, end: 90 };
const recap = { kind: 'recap', start: 300, end: 340 };
const credits = { kind: 'credits', start: 1200, end: 1400 };

describe('parseSkipSegments', () => {
    it('keeps well-formed segments, sorted by start, and drops invalid ones', () => {
        const { parseSkipSegments } = loadSegments();
        const parsed = parseSkipSegments({
            segments: [
                credits,
                { kind: 'unknown', start: 1, end: 2 },
                { kind: 'intro', start: 'x', end: 90 },
                { kind: 'intro', start: -5, end: 10 },
                { kind: 'recap', start: 50, end: 50 },
                intro,
                { kind: 'intro', start: Number.NaN, end: 10 },
            ],
        });
        expect(parsed).toEqual([intro, credits]);
    });

    it('keeps the optional source and confidence fields', () => {
        const { parseSkipSegments } = loadSegments();
        expect(parseSkipSegments({ segments: [{ ...intro, source: 'community', confidence: 0.8 }] }))
            .toEqual([{ ...intro, source: 'community', confidence: 0.8 }]);
    });

    it('returns no segment for an empty or unexpected body', () => {
        const { parseSkipSegments } = loadSegments();
        expect(parseSkipSegments({ segments: [] })).toEqual([]);
        expect(parseSkipSegments({})).toEqual([]);
        expect(parseSkipSegments(null)).toEqual([]);
        expect(parseSkipSegments({ segments: 'nope' })).toEqual([]);
    });
});

describe('parseSeriesTarget', () => {
    it('reads IMDb id, season and episode from a series stream id', () => {
        const { parseSeriesTarget } = loadSegments();
        expect(parseSeriesTarget('tt1234567:2:5')).toEqual({ imdbId: 'tt1234567', season: 2, episode: 5 });
    });

    it('returns null for a movie id or a malformed series id', () => {
        const { parseSeriesTarget } = loadSegments();
        expect(parseSeriesTarget('tt1234567')).toBeNull();
        expect(parseSeriesTarget('tt1234567:x:5')).toBeNull();
        expect(parseSeriesTarget('123:1:2')).toBeNull();
    });
});

describe('skipButtonSegment (bouton « Passer »)', () => {
    it('appears at the start of the segment and hides 8 s later', () => {
        const { skipButtonSegment } = loadSegments();
        expect(skipButtonSegment([intro], 29.9)).toBeNull();
        expect(skipButtonSegment([intro], 30)).toBe(intro);
        expect(skipButtonSegment([intro], 37.9)).toBe(intro);
        expect(skipButtonSegment([intro], 38)).toBeNull();
    });

    it('hides at the segment end when the segment is shorter than 8 s', () => {
        const { skipButtonSegment } = loadSegments();
        const short = { kind: 'intro', start: 10, end: 13 };
        expect(skipButtonSegment([short], 12.9)).toBe(short);
        expect(skipButtonSegment([short], 13)).toBeNull();
    });

    it('only offers intro and recap by default, never credits', () => {
        const { skipButtonSegment } = loadSegments();
        expect(skipButtonSegment([recap], 301)).toBe(recap);
        expect(skipButtonSegment([credits], 1201)).toBeNull();
    });
});

describe('autoSkipSegment (sauts automatiques)', () => {
    it('skips an enabled kind inside its interval, once per segment', () => {
        const { autoSkipSegment, segmentKeyOf } = loadSegments();
        const enabled = new Set(['intro']);
        expect(autoSkipSegment([intro, recap], 31, enabled, new Set())).toBe(intro);
        expect(autoSkipSegment([intro, recap], 31, enabled, new Set([segmentKeyOf(intro)]))).toBeNull();
    });

    it('ignores kinds that are not enabled and times outside the interval', () => {
        const { autoSkipSegment } = loadSegments();
        expect(autoSkipSegment([intro, recap], 301, new Set(['intro']), new Set())).toBeNull();
        expect(autoSkipSegment([intro], 90, new Set(['intro']), new Set())).toBeNull();
        expect(autoSkipSegment([intro], 29, new Set(['intro']), new Set())).toBeNull();
    });
});

describe('countdownRemaining and next-episode card', () => {
    it('counts 10 s down from the start of the credits, and stops at 0', () => {
        const { countdownRemaining } = loadSegments();
        expect(countdownRemaining(1200, 1200)).toBe(10);
        expect(countdownRemaining(1200, 1200.5)).toBe(10);
        expect(countdownRemaining(1200, 1201)).toBe(9);
        expect(countdownRemaining(1200, 1209.5)).toBe(1);
        expect(countdownRemaining(1200, 1210)).toBe(0);
        expect(countdownRemaining(1200, 1300)).toBe(0);
    });

    it('shows the card from the start of the credits unless the user chose to watch them', () => {
        const { nextEpisodeCardVisible } = loadSegments();
        expect(nextEpisodeCardVisible([credits], 1199, false)).toBe(false);
        expect(nextEpisodeCardVisible([credits], 1200, false)).toBe(true);
        expect(nextEpisodeCardVisible([credits], 1300, true)).toBe(false);
        expect(nextEpisodeCardVisible([intro], 1300, false)).toBe(false);
    });

    it('advances 10 s into the credits when there is no post-credits segment', () => {
        const { shouldAdvanceToNextEpisode } = loadSegments();
        expect(shouldAdvanceToNextEpisode([credits], 1209.9, false)).toBe(false);
        expect(shouldAdvanceToNextEpisode([credits], 1210, false)).toBe(true);
        expect(shouldAdvanceToNextEpisode([credits], 1210, true)).toBe(false);
    });

    it('does not advance before the post-credits segment starts', () => {
        const { shouldAdvanceToNextEpisode } = loadSegments();
        const postcredits = { kind: 'postcredits', start: 1350, end: 1400 };
        const segments = [credits, postcredits];
        expect(shouldAdvanceToNextEpisode(segments, 1210, false)).toBe(false);
        expect(shouldAdvanceToNextEpisode(segments, 1349, false)).toBe(false);
        expect(shouldAdvanceToNextEpisode(segments, 1350, false)).toBe(true);
    });

    it('never advances without a credits segment', () => {
        const { shouldAdvanceToNextEpisode } = loadSegments();
        expect(shouldAdvanceToNextEpisode([intro], 5000, false)).toBe(false);
    });
});

describe('fetchSkipSegments', () => {
    it('reads the segments of an episode from the lt skip route', async () => {
        const { fetchSkipSegments } = loadSegments();
        fetchMock.mockResolvedValue(jsonResponse({ segments: [intro] }));

        await expect(fetchSkipSegments('tt1234567', 2, 5)).resolves.toEqual([intro]);
        expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/${CONFIG}/lt/skip/series/tt1234567/2/5`);
    });

    it('returns no segment on 404, on an empty body and on network failure', async () => {
        const { fetchSkipSegments } = loadSegments();
        fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'not_found' }, 404));
        await expect(fetchSkipSegments('tt1', 1, 1)).resolves.toEqual([]);

        fetchMock.mockResolvedValueOnce(jsonResponse({}));
        await expect(fetchSkipSegments('tt2', 1, 1)).resolves.toEqual([]);

        fetchMock.mockRejectedValueOnce(new Error('offline'));
        await expect(fetchSkipSegments('tt3', 1, 1)).resolves.toEqual([]);
    });
});
