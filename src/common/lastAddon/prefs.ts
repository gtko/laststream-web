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
