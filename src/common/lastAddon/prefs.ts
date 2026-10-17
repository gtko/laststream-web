// Copyright (C) 2017-2026 Smart code 203358507

// Préférence de lecture (localStorage `laststream.autoplay`). Activée par défaut : seule la valeur '0' la désactive.
export const AUTOPLAY_STORAGE_KEY = 'laststream.autoplay';

/** Lecture automatique de la meilleure source LastAddon. Vrai tant que le réglage n'a jamais été désactivé. */
export const getAutoplay = (): boolean => {
    try {
        return globalThis.localStorage?.getItem(AUTOPLAY_STORAGE_KEY) !== '0';
    } catch {
        return true;
    }
};

/** Enregistre la préférence. Stockage indisponible : le réglage reste valable en mémoire pour la session. */
export const setAutoplay = (enabled: boolean): void => {
    try {
        globalThis.localStorage?.setItem(AUTOPLAY_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
        // Navigation privée ou quota dépassé : rien à faire.
    }
};

// Débit de la connexion (localStorage `laststream.bandwidth.setting`) : 'auto' (mesure) ou un débit fixe en Mb/s.
export const BANDWIDTH_SETTING_KEY = 'laststream.bandwidth.setting';
export const BANDWIDTH_PRESETS_MBPS: readonly number[] = [2, 5, 10, 20, 50, 100];
export type BandwidthSetting = 'auto' | number;

/** Réglage de débit. Absent ou illisible : 'auto'. */
export const getBandwidthSetting = (): BandwidthSetting => {
    try {
        const raw = globalThis.localStorage?.getItem(BANDWIDTH_SETTING_KEY);
        if (raw === null || raw === undefined || raw === 'auto') return 'auto';
        const mbps = Number(raw);
        return Number.isFinite(mbps) && mbps > 0 ? mbps : 'auto';
    } catch {
        return 'auto';
    }
};

export const setBandwidthSetting = (value: BandwidthSetting): void => {
    try {
        globalThis.localStorage?.setItem(BANDWIDTH_SETTING_KEY, value === 'auto' ? 'auto' : String(value));
    } catch {
        // Stockage indisponible : le réglage reste celui de la session en cours.
    }
};

// Sauts automatiques (localStorage `laststream.skip.<nom>` = '1' ou '0'). Passer l'intro et le récap sont désactivés
// par défaut, l'épisode suivant est enchaîné.
export type SkipPrefName = 'intro' | 'recap' | 'nextEpisode';
export const SKIP_PREF_DEFAULTS: Readonly<Record<SkipPrefName, boolean>> = { intro: false, recap: false, nextEpisode: true };

const skipPrefKey = (name: SkipPrefName): string => `laststream.skip.${name}`;

export const getSkipPref = (name: SkipPrefName): boolean => {
    try {
        const raw = globalThis.localStorage?.getItem(skipPrefKey(name));
        if (raw === null || raw === undefined) return SKIP_PREF_DEFAULTS[name];
        return raw === '1';
    } catch {
        return SKIP_PREF_DEFAULTS[name];
    }
};

export const setSkipPref = (name: SkipPrefName, enabled: boolean): void => {
    try {
        globalThis.localStorage?.setItem(skipPrefKey(name), enabled ? '1' : '0');
    } catch {
        // Stockage indisponible : le réglage reste celui de la session.
    }
};
