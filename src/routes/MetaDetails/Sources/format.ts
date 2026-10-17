// Copyright (C) 2017-2026 Smart code 203358507

import type { LastStreamInfo, LastStreamLang } from 'stremio/common/lastAddon/types';

const LANGUAGE_LABELS: Record<LastStreamLang, string> = {
    fr: 'VF',
    en: 'VO',
    es: 'ES',
    de: 'DE',
    it: 'IT',
    multi: 'MULTI',
    original: 'VO',
};

/** Libellé de langue : variante française si connue (VFF, VOSTFR…), sinon les langues du stream. */
export const languageLabel = (info: LastStreamInfo): string | null => {
    if (info.frVariant) return info.frVariant;
    const labels = [...new Set(info.languages.map((lang) => LANGUAGE_LABELS[lang]))];
    return labels.length > 0 ? labels.join(' + ') : null;
};

/** Taille lisible (Go ou Mo), null si inconnue. */
export const formatSize = (bytes: number | undefined): string | null => {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null;
    const gigabytes = bytes / 1e9;
    return gigabytes >= 1 ? `${gigabytes.toFixed(gigabytes >= 10 ? 0 : 1)} Go` : `${Math.round(bytes / 1e6)} Mo`;
};

/** Débit estimé lisible (Mb/s ou kb/s), null si inconnu. */
export const formatBitrate = (kbps: number | null | undefined): string | null => {
    if (typeof kbps !== 'number' || !Number.isFinite(kbps) || kbps <= 0) return null;
    return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mb/s` : `${Math.round(kbps)} kb/s`;
};
