// Copyright (C) 2017-2026 Smart code 203358507

import { ltUrl } from './config';
import { cachedRequest, requestJson } from './transport';

// Segments de saut (intro, récap, générique, post-générique, aperçu) d'un épisode, renvoyés par LastAddon.
export type SkipSegmentKind = 'intro' | 'recap' | 'credits' | 'postcredits' | 'preview';

export type SkipSegment = {
    kind: SkipSegmentKind,
    start: number,
    end: number,
    source?: string,
    confidence?: number,
};

export const SKIP_SEGMENT_KINDS: readonly SkipSegmentKind[] = ['intro', 'recap', 'credits', 'postcredits', 'preview'];

// Le bouton « Passer » apparaît au début du segment et disparaît 8 s plus tard (ou à sa fin).
export const SKIP_BUTTON_VISIBLE_S = 8;
// Le compte à rebours de l'épisode suivant dure 10 s.
export const NEXT_EPISODE_COUNTDOWN_S = 10;

/** Valide la réponse de LastAddon : segments mal formés ignorés, tri par début. Réponse vide ou inconnue : []. */
export const parseSkipSegments = (body: unknown): SkipSegment[] => {
    const raw = (body as { segments?: unknown } | null)?.segments;
    if (!Array.isArray(raw)) return [];
    const segments: SkipSegment[] = [];
    raw.forEach((item) => {
        const candidate = item as Partial<SkipSegment> | null;
        if (typeof candidate !== 'object' || candidate === null) return;
        if (!SKIP_SEGMENT_KINDS.includes(candidate.kind as SkipSegmentKind)) return;
        if (typeof candidate.start !== 'number' || typeof candidate.end !== 'number') return;
        if (!Number.isFinite(candidate.start) || !Number.isFinite(candidate.end)) return;
        if (candidate.start < 0 || candidate.end <= candidate.start) return;
        segments.push({
            kind: candidate.kind as SkipSegmentKind,
            start: candidate.start,
            end: candidate.end,
            ...(typeof candidate.source === 'string' ? { source: candidate.source } : {}),
            ...(typeof candidate.confidence === 'number' ? { confidence: candidate.confidence } : {}),
        });
    });
    return segments.sort((a, b) => a.start - b.start);
};

/**
 * Segments d'un épisode (GET {base}/{config}/lt/skip/series/:imdbId/:season/:episode). 404, réponse vide ou
 * erreur réseau : aucun segment, la lecture continue sans saut.
 */
export const fetchSkipSegments = async (imdbId: string, season: number, episode: number): Promise<SkipSegment[]> => {
    try {
        const key = `skip series/${imdbId}/${season}/${episode}`;
        const body = await cachedRequest(key, () => requestJson<unknown>(ltUrl(`skip/series/${imdbId}/${season}/${episode}`)));
        return parseSkipSegments(body);
    } catch {
        return [];
    }
};

/** Épisode ciblé par une URL de flux : `tt1234567:2:5` → IMDb, saison, épisode. Null pour un film ou un autre identifiant. */
export const parseSeriesTarget = (id: string): { imdbId: string, season: number, episode: number } | null => {
    const match = /^(tt\d+):(\d+):(\d+)$/.exec(id);
    if (!match) return null;
    return { imdbId: match[1], season: Number(match[2]), episode: Number(match[3]) };
};

export const segmentKeyOf = (segment: SkipSegment): string => `${segment.kind}:${segment.start}:${segment.end}`;

/**
 * Segment de saut à proposer à `time` (intro ou récap) : visible à partir de son début, 8 s au plus, jusqu'à sa fin.
 */
export const skipButtonSegment = (
    segments: readonly SkipSegment[],
    time: number,
    kinds: readonly SkipSegmentKind[] = ['intro', 'recap'],
): SkipSegment | null => segments.find((segment) => (
    kinds.includes(segment.kind)
    && time >= segment.start
    && time < Math.min(segment.end, segment.start + SKIP_BUTTON_VISIBLE_S)
)) ?? null;

/**
 * Segment à passer tout seul à `time` : un type activé dans les réglages, dans son intervalle, et pas encore passé.
 */
export const autoSkipSegment = (
    segments: readonly SkipSegment[],
    time: number,
    enabledKinds: ReadonlySet<SkipSegmentKind>,
    alreadySkipped: ReadonlySet<string>,
): SkipSegment | null => segments.find((segment) => (
    enabledKinds.has(segment.kind)
    && time >= segment.start
    && time < segment.end
    && !alreadySkipped.has(segmentKeyOf(segment))
)) ?? null;

export const creditsSegmentOf = (segments: readonly SkipSegment[]): SkipSegment | null => (
    segments.find((segment) => segment.kind === 'credits') ?? null
);

export const postcreditsSegmentOf = (segments: readonly SkipSegment[]): SkipSegment | null => (
    segments.find((segment) => segment.kind === 'postcredits') ?? null
);

/** Secondes restantes du compte à rebours « Épisode suivant », depuis le début du générique. */
export const countdownRemaining = (creditsStart: number, time: number): number => (
    Math.min(NEXT_EPISODE_COUNTDOWN_S, Math.max(0, Math.ceil(NEXT_EPISODE_COUNTDOWN_S - (time - creditsStart))))
);

/** La carte « Épisode suivant » s'affiche dès le début du générique, sauf si l'utilisateur veut le regarder. */
export const nextEpisodeCardVisible = (segments: readonly SkipSegment[], time: number, watchingCredits: boolean): boolean => {
    const credits = creditsSegmentOf(segments);
    return credits !== null && !watchingCredits && time >= credits.start;
};

/**
 * Passe à l'épisode suivant : le compte à rebours est écoulé, et s'il existe un post-générique, il a commencé
 * (on ne passe pas avant).
 */
export const shouldAdvanceToNextEpisode = (segments: readonly SkipSegment[], time: number, watchingCredits: boolean): boolean => {
    const credits = creditsSegmentOf(segments);
    if (credits === null || watchingCredits) return false;
    if (time < credits.start + NEXT_EPISODE_COUNTDOWN_S) return false;
    const postcredits = postcreditsSegmentOf(segments);
    return postcredits === null || time >= postcredits.start;
};
