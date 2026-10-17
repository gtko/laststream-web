// Copyright (C) 2017-2026 Smart code 203358507

import { LastAddonError } from './errors';
import { requireBase } from './config';
import { cachedRequest, requestJson } from './transport';
import type {
    ConfigSchemaDocument,
    EncodeConfigResponse,
    LastAddonTestResponse,
    ServiceTestResult,
    TestableService,
} from './types';

/** Schéma JSON de la configuration (GET {base}/config/schema). Mis en cache. */
export const getSchema = async (): Promise<ConfigSchemaDocument> => {
    const base = requireBase();
    return cachedRequest(`schema ${base}`, () => requestJson<ConfigSchemaDocument>(`${base}/config/schema`));
};

/**
 * Chiffre une configuration (POST {base}/config/encode). Avec `previous` (configuration déjà enregistrée, chiffrée),
 * le serveur garde les secrets que `values` laisse vides ou masqués : les clés n'ont pas à être ressaisies.
 * Renvoie la chaîne à passer à setConfig.
 */
export const encodeConfig = async (values: Record<string, unknown>, previous?: string): Promise<string> => {
    const body = previous ? { previous, config: values } : values;
    const response = await requestJson<EncodeConfigResponse>(`${requireBase()}/config/encode`, {
        method: 'POST',
        body,
    });
    if (typeof response.config !== 'string') {
        throw new LastAddonError('invalid_response', 'LastAddon encode response has no config string.');
    }
    return response.config;
};

/**
 * Déchiffre la configuration enregistrée pour le formulaire (POST {base}/config/decode). Chaque secret revient
 * masqué (`{set, last4}`), jamais sa valeur. Null si indisponible (404 d'un serveur ancien compris) : le formulaire
 * garde alors ses valeurs par défaut.
 */
export const decodeConfig = async (encoded: string): Promise<Record<string, unknown> | null> => {
    try {
        const response = await requestJson<unknown>(`${requireBase()}/config/decode`, {
            method: 'POST',
            body: { config: encoded },
        });
        return typeof response === 'object' && response !== null && !Array.isArray(response)
            ? response as Record<string, unknown>
            : null;
    } catch {
        return null;
    }
};

/**
 * Teste la clé d'un service (POST {base}/config/test). La clé part dans le corps de la requête,
 * elle n'est ni mise en cache ni stockée.
 */
export const testService = async (service: TestableService, key: string): Promise<ServiceTestResult> => {
    const response = await requestJson<LastAddonTestResponse>(`${requireBase()}/config/test`, {
        method: 'POST',
        body: { debrid: { service, apiKey: key } },
    });
    const check = response.sources?.find((source) => source.type === service);
    if (!check) {
        throw new LastAddonError('invalid_response', `LastAddon test response has no result for ${service}.`);
    }
    return { ok: check.ok, error: check.error };
};

/** URL du manifest Stremio pour une configuration chiffrée. Lève not_configured si la base manque. */
export const manifestUrl = (encoded: string): string =>
    `${requireBase()}/${encodeURIComponent(encoded)}/manifest.json`;
