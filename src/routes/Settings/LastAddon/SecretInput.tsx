// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useEffect, useState } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Button, TextInput } from 'stremio/components';
import type { ServiceTestResult } from 'stremio/common/lastAddon';
import { describeError } from './actions';
import styles from './LastAddon.less';

type Props = {
    value: unknown,
    onChange: (value: string) => void,
    onTest?: (key: string) => Promise<ServiceTestResult>,
};

type TestOutcome = {
    ok: boolean,
    message: string,
};

// Clé saisie en champ mot de passe. Seul le résultat du test est affiché, jamais la clé.
const SecretInput = ({ value, onChange, onTest }: Props) => {
    const { t } = useTranslation();
    const [testing, setTesting] = useState(false);
    const [outcome, setOutcome] = useState<TestOutcome | null>(null);
    const current = typeof value === 'string' ? value : '';

    // Un résultat ne vaut que pour la clé testée.
    useEffect(() => {
        setOutcome(null);
    }, [current]);

    const onTestClick = useCallback(async () => {
        if (!onTest) return;
        setTesting(true);
        setOutcome(null);
        try {
            const result = await onTest(current.trim());
            setOutcome(result.ok ?
                { ok: true, message: t('LASTADDON_TEST_OK', { defaultValue: 'Clé valide.' }) } :
                { ok: false, message: result.error ?? t('LASTADDON_TEST_REFUSED', { defaultValue: 'Clé refusée.' }) });
        } catch (error) {
            setOutcome({ ok: false, message: describeError(error) });
        } finally {
            setTesting(false);
        }
    }, [onTest, current, t]);

    return (
        <div className={styles['secret-input']}>
            <div className={styles['secret-row']}>
                <TextInput
                    className={styles['text-input']}
                    type={'password'}
                    value={current}
                    onChange={(event) => onChange(event.currentTarget.value)}
                />
                {
                    onTest &&
                        <Button className={'button'} title={t('LASTADDON_TEST', { defaultValue: 'Tester' })} disabled={testing || current.trim() === ''} onClick={onTestClick}>
                            { testing ? t('LASTADDON_TESTING', { defaultValue: 'Test…' }) : t('LASTADDON_TEST', { defaultValue: 'Tester' }) }
                        </Button>
                }
            </div>
            {
                outcome &&
                    <div className={classNames(styles['test-result'], outcome.ok ? styles['ok'] : styles['error'])} role={'status'}>
                        {outcome.message}
                    </div>
            }
        </div>
    );
};

export default SecretInput;
