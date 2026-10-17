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

/** Chiffre une configuration (POST {base}/config/encode). Renvoie la chaîne à passer à setConfig. */
export const encodeConfig = async (values: Record<string, unknown>): Promise<string> => {
    const response = await requestJson<EncodeConfigResponse>(`${requireBase()}/config/encode`, {
        method: 'POST',
        body: values,
    });
    if (typeof response.config !== 'string') {
        throw new LastAddonError('invalid_response', 'LastAddon encode response has no config string.');
    }
    return response.config;
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
