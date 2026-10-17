// Copyright (C) 2017-2026 Smart code 203358507

import React, { forwardRef, useCallback, useEffect, useState } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useCore } from 'stremio/core';
import { Button, MultiselectMenu, TextInput, Toggle } from 'stremio/components';
import { useToast } from 'stremio/common';
import {
    decodeConfig,
    encodeConfig,
    getConfig,
    getSchema,
    setBase,
    setConfig,
    useLastAddon,
} from 'stremio/common/lastAddon';
import {
    getAutoplay,
    getBandwidthSetting,
    getSkipPref,
    setAutoplay,
    setBandwidthSetting,
    setSkipPref,
    BANDWIDTH_PRESETS_MBPS,
    type BandwidthSetting,
    type SkipPrefName,
} from 'stremio/common/lastAddon/prefs';
import { testBandwidthKbps } from 'stremio/common/lastAddon/sources';
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
    // Valeurs du formulaire. Les secrets déjà enregistrés y figurent masqués (`{set, last4}`), jamais en clair.
    const [draft, setDraft] = useState<Draft>({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [autoplay, setAutoplayState] = useState(getAutoplay);
    const [bandwidth, setBandwidthState] = useState<BandwidthSetting>(getBandwidthSetting);
    const [bandwidthTesting, setBandwidthTesting] = useState(false);
    const [bandwidthMessage, setBandwidthMessage] = useState<string | null>(null);
    const [skipPrefs, setSkipPrefsState] = useState(() => ({
        intro: getSkipPref('intro'),
        recap: getSkipPref('recap'),
        nextEpisode: getSkipPref('nextEpisode'),
    }));

    useEffect(() => {
        setBaseInput(snapshot.base);
    }, [snapshot.base]);

    useEffect(() => {
        setSchema(null);
        setSchemaError(null);
        if (snapshot.base === '') return undefined;

        let cancelled = false;
        getSchema().then(async (document) => {
            if (cancelled) return;
            const root = document as SchemaNode;
            setSchema(root);
            // Configuration déjà enregistrée : le formulaire reprend ses valeurs. Sans /config/decode, il garde ses défauts.
            const saved = getConfig() === '' ? null : await decodeConfig(getConfig());
            if (cancelled) return;
            setDraft({ ...(defaultsOf(root) as Draft), ...(saved ?? {}) });
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
            // Les secrets laissés vides (ou masqués) sont gardés depuis la configuration précédente.
            const encoded = await encodeConfig(buildPayload(schema, draft), getConfig() || undefined);
            // La configuration n'est enregistrée qu'une fois l'addon installé : un échec ne laisse pas un état à moitié écrit.
            await installLastAddon(encoded, installedAddonsOf(profile), core.transport.dispatch);
            setConfig(encoded);
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

    const onToggleSkip = useCallback((name: SkipPrefName) => {
        const next = !skipPrefs[name];
        setSkipPref(name, next);
        setSkipPrefsState((current) => ({ ...current, [name]: next }));
    }, [skipPrefs]);

    const skipToggleOf = (name: SkipPrefName) => ({ checked: skipPrefs[name], onClick: () => onToggleSkip(name) });

    const bandwidthLabel = bandwidth === 'auto'
        ? t('LASTADDON_BANDWIDTH_AUTO', { defaultValue: 'Auto (mesure)' })
        : `${bandwidth} Mb/s`;
    const bandwidthOptions = [
        { label: t('LASTADDON_BANDWIDTH_AUTO', { defaultValue: 'Auto (mesure)' }), value: 'auto' },
        ...BANDWIDTH_PRESETS_MBPS.map((mbps) => ({ label: `${mbps} Mb/s`, value: String(mbps) })),
    ];

    const onBandwidthSelect = useCallback((value: string) => {
        const next: BandwidthSetting = value === 'auto' ? 'auto' : Number(value);
        setBandwidthSetting(next);
        setBandwidthState(next);
        setBandwidthMessage(null);
    }, []);

    const onTestBandwidth = useCallback(async () => {
        setBandwidthTesting(true);
        setBandwidthMessage(null);
        try {
            const kbps = await testBandwidthKbps();
            setBandwidthMessage(kbps === null ?
                t('LASTADDON_BANDWIDTH_FAILED', { defaultValue: 'Mesure impossible pour le moment. Réessaie.' }) :
                t('LASTADDON_BANDWIDTH_RESULT', { defaultValue: 'Débit mesuré : {{mbps}} Mb/s', mbps: (kbps / 1000).toFixed(1) }));
        } finally {
            setBandwidthTesting(false);
        }
    }, [t]);

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
                                {t('LASTADDON_KEYS_HINT', { defaultValue: 'Les clés enregistrées restent masquées : laisse un champ vide pour garder la clé actuelle.' })}
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
                <Option label={t('LASTADDON_BANDWIDTH', { defaultValue: 'Débit de ma connexion' })}>
                    <MultiselectMenu
                        className={'multiselect'}
                        options={bandwidthOptions}
                        value={String(bandwidth)}
                        title={bandwidthLabel}
                        onSelect={onBandwidthSelect}
                    />
                    <Button className={'button'} title={t('LASTADDON_BANDWIDTH_TEST', { defaultValue: 'Tester ma connexion' })} disabled={bandwidthTesting} onClick={onTestBandwidth}>
                        {
                            bandwidthTesting ?
                                t('LASTADDON_TESTING', { defaultValue: 'Test…' }) :
                                t('LASTADDON_BANDWIDTH_TEST', { defaultValue: 'Tester ma connexion' })
                        }
                    </Button>
                </Option>
                {
                    bandwidthMessage &&
                        <div className={styles['hint']} role={'status'}>{bandwidthMessage}</div>
                }
                <Option label={t('LASTADDON_SKIP_INTRO', { defaultValue: 'Passer automatiquement les intros' })}>
                    <Toggle tabIndex={-1} {...skipToggleOf('intro')} />
                </Option>
                <Option label={t('LASTADDON_SKIP_RECAP', { defaultValue: 'Passer automatiquement les récaps' })}>
                    <Toggle tabIndex={-1} {...skipToggleOf('recap')} />
                </Option>
                <Option label={t('LASTADDON_SKIP_NEXT', { defaultValue: 'Enchaîner l’épisode suivant' })}>
                    <Toggle tabIndex={-1} {...skipToggleOf('nextEpisode')} />
                </Option>
            </Category>
        </Section>
    );
});

export default LastAddon;
