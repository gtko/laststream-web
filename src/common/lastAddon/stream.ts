// Copyright (C) 2017-2026 Smart code 203358507

import type {
    LastStreamCodec,
    LastStreamFrVariant,
    LastStreamHdr,
    LastStreamInfo,
    LastStreamLang,
    LastStreamResolution,
    LastStreamSource,
} from './types';

type Check<T> = (value: unknown) => value is T;

const enumOf = <T extends string>(values: readonly T[]): Check<T> => (value): value is T =>
    typeof value === 'string' && (values as readonly string[]).includes(value);

const listOf = <T>(check: Check<T>): Check<T[]> => (value): value is T[] =>
    Array.isArray(value) && value.every((item) => check(item));

const optionalOf = <T>(check: Check<T>): Check<T | undefined> => (value): value is T | undefined =>
    value === undefined || check(value);

const isFiniteNumber: Check<number> = (value): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const isNullableNumber: Check<number | null> = (value): value is number | null =>
    value === null || isFiniteNumber(value);

const isBoolean: Check<boolean> = (value): value is boolean => typeof value === 'boolean';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isResolution = enumOf<LastStreamResolution>(['2160p', '1080p', '720p', '480p', 'SD', 'unknown']);
const isSource = enumOf<LastStreamSource>(['REMUX', 'BluRay', 'WEB-DL', 'WEBRip', 'HDTV', 'DVDRip', 'CAM', 'TS', 'SCR', 'unknown']);
const isCodec = enumOf<LastStreamCodec>(['HEVC', 'AVC', 'AV1', 'unknown']);
const isHdr = enumOf<LastStreamHdr>(['HDR10', 'HDR10+', 'DV', 'HLG']);
const isLang = enumOf<LastStreamLang>(['fr', 'en', 'es', 'de', 'it', 'multi', 'original']);
const isFrVariant = enumOf<LastStreamFrVariant>(['VFF', 'VFQ', 'VF2', 'TRUEFRENCH', 'FRENCH', 'VOSTFR', 'SUBFRENCH']);

/**
 * Lit l'objet `laststream` d'un stream LastAddon. Renvoie null si l'objet est absent ou mal formé.
 * Le résultat ne contient que les champs connus.
 */
export const getLaststream = (stream: unknown): LastStreamInfo | null => {
    if (!isRecord(stream) || !isRecord(stream.laststream)) return null;
    const info = stream.laststream;

    if (
        !isResolution(info.resolution)
        || !isFiniteNumber(info.height)
        || !isSource(info.source)
        || !isCodec(info.codec)
        || !listOf(isHdr)(info.hdr)
        || !listOf(isLang)(info.languages)
        || !isBoolean(info.cached)
        || !isFiniteNumber(info.score)
        || !isNullableNumber(info.estBitrateKbps)
        || !optionalOf(isFrVariant)(info.frVariant)
        || !optionalOf(isFiniteNumber)(info.sizeBytes)
        || !optionalOf(isFiniteNumber)(info.seeders)
        || !optionalOf(isBoolean)(info.languageFallback)
    ) {
        return null;
    }

    const result: LastStreamInfo = {
        resolution: info.resolution,
        height: info.height,
        source: info.source,
        codec: info.codec,
        hdr: info.hdr,
        languages: info.languages,
        cached: info.cached,
        score: info.score,
        estBitrateKbps: info.estBitrateKbps,
    };
    if (info.frVariant !== undefined) result.frVariant = info.frVariant;
    if (info.sizeBytes !== undefined) result.sizeBytes = info.sizeBytes;
    if (info.seeders !== undefined) result.seeders = info.seeders;
    if (info.languageFallback !== undefined) result.languageFallback = info.languageFallback;
    return result;
};
