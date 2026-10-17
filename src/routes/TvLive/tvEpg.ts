// Copyright (C) 2017-2026 Smart code 203358507

import type { TvEpgProgram } from 'stremio/common/lastAddon';

export const EPG_WINDOW_HOURS = 6;
export const EPG_SLOT_SECONDS = 30 * 60;

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/** Début de la fenêtre EPG : le créneau de 30 min précédant l'heure courante, aligné sur les demi-heures. */
export const epgWindowStart = (now: number = nowSeconds()): number =>
    Math.floor((now - EPG_SLOT_SECONDS) / EPG_SLOT_SECONDS) * EPG_SLOT_SECONDS;

export const nowNext = (programs: TvEpgProgram[], now: number) => {
    const current = programs.find((program) => program.start <= now && now < program.stop) ?? null;
    const next = programs.find((program) => program.start >= (current ? current.stop : now)) ?? null;
    return { current, next };
};

export const progressPercent = (program: TvEpgProgram, now: number): number => {
    const duration = program.stop - program.start;
    if (duration <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round(((now - program.start) / duration) * 100)));
};

export const formatTime = (seconds: number, language: string): string =>
    new Date(seconds * 1000).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
