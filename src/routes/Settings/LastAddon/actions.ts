// Copyright (C) 2017-2026 Smart code 203358507

import { t } from 'i18next';
import {
    LASTADDON_ID,
    LastAddonError,
    manifestUrl,
    requestJson,
    requireBase,
    type ServiceTestResult,
} from 'stremio/common/lastAddon';

type ServicesCheck = {
    services?: { type?: string, ok?: boolean, error?: string }[],
};

// Descripteur d'addon installé (profile.addons).
export type InstalledAddon = {
    transportUrl: string,
    manifest?: { id?: string },
};

type Dispatch = (action: any) => unknown;

/** Addons installés du profil. Le type Profile ne déclare pas `addons`, mais le core le fournit. */
export const installedAddonsOf = (profile: Profile): InstalledAddon[] => (
    (profile as Profile & { addons?: InstalledAddon[] }).addons ?? []
);

/**
 * Teste une clé de service (POST {base}/config/test, section `services`). Le corps ne contient que cette clé :
 * elle n'est ni mise en cache ni conservée, et les messages d'erreur ne la reprennent pas.
 */
export const testServiceKey = async (field: string, key: string): Promise<ServiceTestResult> => {
    const response = await requestJson<ServicesCheck>(`${requireBase()}/config/test`, {
        method: 'POST',
        body: { services: { [field]: key } },
    });
    const check = response.services?.find((item) => item.type === field);
    if (!check) {
        throw new LastAddonError('invalid_response', `LastAddon test response has no result for ${field}.`);
    }
    return { ok: check.ok === true, error: check.error };
};

/**
 * Installe ou met à jour LastAddon dans le core. Le manifest est lu d'abord ; les installations précédentes
 * (même manifest.id) sont retirées avant l'installation de la configuration chiffrée.
 */
export const installLastAddon = async (encoded: string, installed: InstalledAddon[], dispatch: Dispatch): Promise<void> => {
    const transportUrl = manifestUrl(encoded);
    const manifest = await requestJson<{ id?: string }>(transportUrl);
    if (manifest?.id !== LASTADDON_ID) {
        throw new LastAddonError('invalid_response', 'LastAddon manifest has an unexpected id.');
    }
    installed
        .filter((addon) => addon.manifest?.id === LASTADDON_ID)
        .forEach((addon) => {
            dispatch({ action: 'Ctx', args: { action: 'UninstallAddon', args: addon } });
        });
    dispatch({
        action: 'Ctx',
        args: {
            action: 'InstallAddon',
            args: { transportUrl, manifest, flags: { official: false, protected: false } },
        },
    });
};

/** Message lisible pour une erreur. Ne reprend jamais la configuration ni les clés saisies. */
export const describeError = (error: unknown): string => {
    if (error instanceof LastAddonError) {
        switch (error.kind) {
            case 'not_configured':
                return t('LASTADDON_ERR_NOT_CONFIGURED', { defaultValue: 'Renseigne d\'abord l\'adresse de LastAddon.' });
            case 'invalid_base':
                return t('LASTADDON_ERR_INVALID_BASE', { defaultValue: 'Adresse invalide : http ou https attendu.' });
            case 'network':
                return t('LASTADDON_ERR_NETWORK', { defaultValue: 'LastAddon est injoignable.' });
            case 'http':
                return error.code === 'invalid_config' ?
                    t('LASTADDON_ERR_INVALID_CONFIG', { defaultValue: 'LastAddon refuse cette configuration. Vérifie les champs.' }) :
                    t('LASTADDON_ERR_HTTP', { defaultValue: 'LastAddon a répondu HTTP {{status}}.', status: error.status });
            default:
                return t('LASTADDON_ERR_INVALID_RESPONSE', { defaultValue: 'Réponse inattendue de LastAddon.' });
        }
    }
    return t('LASTADDON_ERR_UNKNOWN', { defaultValue: 'Erreur inattendue.' });
};
