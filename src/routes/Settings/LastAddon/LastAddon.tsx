// Copyright (C) 2017-2026 Smart code 203358507

import React, { forwardRef, useCallback, useEffect, useState } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useCore } from 'stremio/core';
import { Button, TextInput, Toggle } from 'stremio/components';
import { useToast } from 'stremio/common';
import { encodeConfig, getSchema, setBase, setConfig, useLastAddon } from 'stremio/common/lastAddon';
import { getAutoplay, setAutoplay } from 'stremio/common/lastAddon/prefs';
import { Category, Option, Section } from '../components';
import ConfigForm from './ConfigForm';
import { describeError, installedAddonsOf, installLastAddon } from './actions';
import { buildPayload, defaultsOf, hasIncompleteSource, setIn, type Draft, type SchemaNode } from './schema';
import styles from './LastAddon.less';

type Props = {
    profile: Profile,
};

// Section « LastAddon » : adresse du service, formulaire généré depuis /config/schema, installation de l'addon.
const LastAddon = forwardRef<HTMLDivElement, Props>(({ profile }: Props, ref) => {
    const { t } = useTranslation();
    const core = useCore();
    const toast = useToast();
    const snapshot = useLastAddon();

    const [baseInput, setBaseInput] = useState(snapshot.base);
    const [baseError, setBaseError] = useState<string | null>(null);
    const [schema, setSchema] = useState<SchemaNode | null>(null);
    const [schemaError, setSchemaError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    // Valeurs du formulaire, clés comprises : elles restent en mémoire de la section et partent dans /config/encode.
    const [draft, setDraft] = useState<Draft>({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [autoplay, setAutoplayState] = useState(getAutoplay);

    useEffect(() => {
        setBaseInput(snapshot.base);
    }, [snapshot.base]);

    useEffect(() => {
        setSchema(null);
        setSchemaError(null);
        if (snapshot.base === '') return undefined;

        let cancelled = false;
        getSchema().then((document) => {
            if (cancelled) return;
            const root = document as SchemaNode;
            setSchema(root);
            setDraft(defaultsOf(root) as Draft);
        }).catch((error) => {
            if (!cancelled) setSchemaError(describeError(error));
        });
        return () => {
            cancelled = true;
        };
    }, [snapshot.base, reloadToken]);

    const onBaseSubmit = useCallback(() => {
        try {
            setBase(baseInput);
            setBaseError(null);
        } catch (error) {
            setBaseError(describeError(error));
        }
    }, [baseInput]);

    const onChange = useCallback((path: string[], value: unknown) => {
        setDraft((current) => setIn(current, path, value));
    }, []);

    const onSave = useCallback(async () => {
        if (!schema) return;
        if (hasIncompleteSource(schema, draft)) {
            setSaveError(t('LASTADDON_ERR_SOURCE_INCOMPLETE', { defaultValue: 'Une source est incomplète : vérifie son nom, son adresse et sa clé.' }));
            return;
        }

        setSaving(true);
        setSaveError(null);
        try {
            const encoded = await encodeConfig(buildPayload(schema, draft));
            setConfig(encoded);
            await installLastAddon(encoded, installedAddonsOf(profile), core.transport.dispatch);
            toast.show({
                type: 'success',
                title: t('LASTADDON_SAVED', { defaultValue: 'LastAddon est configuré et installé.' }),
                timeout: 4000,
            });
        } catch (error) {
            setSaveError(describeError(error));
        } finally {
            setSaving(false);
        }
    }, [schema, draft, profile, core, t, toast]);

    const onToggleAutoplay = useCallback(() => {
        const next = !autoplay;
        setAutoplay(next);
        setAutoplayState(next);
    }, [autoplay]);

    const autoplayToggle = { checked: autoplay, onClick: onToggleAutoplay };

    return (
        <Section ref={ref} label={t('LASTADDON_NAV', { defaultValue: 'LastAddon' })}>
            <div
                className={classNames(styles['status'], snapshot.configured ? styles['configured'] : styles['pending'])}
                role={'status'}
            >
                {
                    snapshot.configured ?
                        t('LASTADDON_STATUS_CONFIGURED', { defaultValue: 'LastAddon est configuré.' }) :
                        t('LASTADDON_STATUS_PENDING', { defaultValue: 'LastAddon n\'est pas encore configuré.' })
                }
            </div>

            <Category icon={'network'} label={t('LASTADDON_CATEGORY_CONNECTION', { defaultValue: 'Connexion' })}>
                <Option label={t('LASTADDON_BASE_URL', { defaultValue: 'Adresse de LastAddon' })}>
                    <div className={styles['base-row']}>
                        <TextInput
                            className={styles['text-input']}
                            type={'url'}
                            placeholder={'https://'}
                            value={baseInput}
                            onChange={(event) => setBaseInput(event.currentTarget.value)}
                            onSubmit={onBaseSubmit}
                        />
                        <Button className={'button'} title={t('LASTADDON_BASE_SAVE', { defaultValue: 'Enregistrer l\'adresse' })} onClick={onBaseSubmit}>
                            {t('LASTADDON_BASE_SAVE', { defaultValue: 'Enregistrer l\'adresse' })}
                        </Button>
                    </div>
                </Option>
                {
                    baseError &&
                        <div className={styles['error']} role={'alert'}>{baseError}</div>
                }
            </Category>

            {
                snapshot.base !== '' && schema === null && schemaError === null &&
                    <div className={styles['hint']}>{t('LASTADDON_SCHEMA_LOADING', { defaultValue: 'Chargement de la configuration…' })}</div>
            }
            {
                schemaError &&
                    <div className={styles['error']} role={'alert'}>
                        <span>{schemaError}</span>
                        <Button className={'button'} title={t('LASTADDON_RETRY', { defaultValue: 'Réessayer' })} onClick={() => setReloadToken((value) => value + 1)}>
                            {t('LASTADDON_RETRY', { defaultValue: 'Réessayer' })}
                        </Button>
                    </div>
            }

            {
                schema &&
                    <>
                        <ConfigForm schema={schema} draft={draft} onChange={onChange} />
                        <div className={styles['actions']}>
                            <div className={styles['hint']}>
                                {t('LASTADDON_KEYS_HINT', { defaultValue: 'Les clés ne sont pas conservées sur cet appareil : ressaisis-les à chaque enregistrement.' })}
                            </div>
                            {
                                saveError &&
                                    <div className={styles['error']} role={'alert'}>{saveError}</div>
                            }
                            <Button className={'button'} title={t('LASTADDON_SAVE', { defaultValue: 'Enregistrer et installer' })} disabled={saving} onClick={onSave}>
                                { saving ?
                                    t('LASTADDON_SAVING', { defaultValue: 'Enregistrement…' }) :
                                    t('LASTADDON_SAVE', { defaultValue: 'Enregistrer et installer' })
                                }
                            </Button>
                        </div>
                    </>
            }

            <Category icon={'play'} label={t('LASTADDON_CATEGORY_PLAYBACK', { defaultValue: 'Lecture' })}>
                <Option label={t('LASTADDON_AUTOPLAY', { defaultValue: 'Lecture automatique de la meilleure source' })}>
                    <Toggle tabIndex={-1} {...autoplayToggle} />
                </Option>
            </Category>
        </Section>
    );
});

export default LastAddon;
