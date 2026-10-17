// Copyright (C) 2017-2026 Smart code 203358507

// `kind` sert de clé de traduction côté UI : le message reste technique.
export type LastAddonErrorKind =
    | 'not_configured'
    | 'invalid_base'
    | 'network'
    | 'http'
    | 'invalid_response';

export type LastAddonErrorOptions = {
    status?: number;
    code?: string;
};

export class LastAddonError extends Error {
    readonly kind: LastAddonErrorKind;
    readonly status?: number;
    // Champ `error` renvoyé par le service en cas d'erreur HTTP (ex. `invalid_config`).
    readonly code?: string;

    constructor(kind: LastAddonErrorKind, message: string, options: LastAddonErrorOptions = {}) {
        super(message);
        Object.setPrototypeOf(this, LastAddonError.prototype);
        this.name = 'LastAddonError';
        this.kind = kind;
        this.status = options.status;
        this.code = options.code;
    }
}
