// Copyright (C) 2017-2026 Smart code 203358507

const DAY_MS = 864e5;

export const tmdbImage = (size: string, path?: string | null): string | null => (
    path ? `https://image.tmdb.org/t/p/${size}${path}` : null
);

export const GENRE_FR: Record<number, string> = {
    28: 'Action', 12: 'Aventure', 16: 'Animation', 35: 'Comédie', 80: 'Policier', 99: 'Documentaire', 18: 'Drame', 10751: 'Famille',
    14: 'Fantastique', 36: 'Histoire', 27: 'Horreur', 10402: 'Musique', 9648: 'Mystère', 10749: 'Romance', 878: 'Science-fiction',
    10770: 'Téléfilm', 53: 'Thriller', 10752: 'Guerre', 37: 'Western', 10759: 'Action', 10762: 'Enfants', 10763: 'Actualités',
    10764: 'Téléréalité', 10765: 'Science-fiction', 10766: 'Feuilleton', 10767: 'Talk-show', 10768: 'Guerre',
};

export const todayIso = (): string => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const addDays = (iso: string, days: number): string => new Date(Date.parse(iso.slice(0, 10)) + days * DAY_MS).toISOString().slice(0, 10);

// Nombre de jours entre aujourd’hui et `iso` : négatif dans le passé, positif dans le futur.
export const dayDiff = (iso: string): number => Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(todayIso())) / DAY_MS);

export const formatRuntime = (minutes: number): string => {
    if (minutes <= 0) return '';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours > 0 ? `${hours} h ${String(rest).padStart(2, '0')}` : `${rest} min`;
};

export const formatDayMonth = (iso: string): { day: number, month: string } | null => {
    const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return {
        day: date.getDate(),
        month: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase(),
    };
};

// Certification FR telle quelle, avec le préfixe « - » pour les âges numériques (ex. -12).
export const certLabel = (cert: string): string => (/^\d+$/.test(cert) ? `-${cert}` : cert);

export const prefersReducedMotion = (): boolean => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

// Aperçus au survol : seulement avec une souris précise (pas sur tactile).
export const canHoverPreview = (): boolean => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
);
