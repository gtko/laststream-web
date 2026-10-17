// Copyright (C) 2017-2026 Smart code 203358507

// Lien d'ouverture d'un stream, calqué sur StreamsList/Stream : lecteur web, lecteur externe ou lien player.
export type StreamDeepLinks = {
    player?: string | null;
    externalPlayer?: {
        web?: string | null;
        openPlayer?: Partial<Record<string, string | null>> | null;
        playlist?: string | null;
        fileName?: string | null;
        streaming?: string | null;
        download?: string | null;
        magnet?: string | null;
    } | null;
};

export type StreamLinksSource = {
    deepLinks?: StreamDeepLinks | null;
};

/** Lien d'ouverture tel que le composant Stream le calcule (null si le stream n'a aucun lien). */
export const getStreamHref = (stream: StreamLinksSource, platformName: string): string | null => {
    const deepLinks = stream.deepLinks;
    if (!deepLinks) return null;
    const external = deepLinks.externalPlayer;
    if (!external) return deepLinks.player ?? null;
    if (external.web) return external.web;
    if (external.openPlayer) {
        return external.openPlayer[platformName] || external.playlist || null;
    }
    return deepLinks.player ?? null;
};

/** Lien du lecteur intégré uniquement (lecture automatique). */
export const getPlayerHref = (stream: StreamLinksSource): string | null => {
    const href = stream.deepLinks?.player;
    return typeof href === 'string' && href.length > 0 ? href : null;
};

/** Cible du lien : « _blank » pour un lien web, comme Stream. */
export const getStreamTarget = (stream: StreamLinksSource, href: string | null): '_blank' | undefined => {
    return href !== null && href === stream.deepLinks?.externalPlayer?.web ? '_blank' : undefined;
};
