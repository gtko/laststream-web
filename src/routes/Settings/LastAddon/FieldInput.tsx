// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, MultiselectMenu, TextInput, Toggle } from 'stremio/components';
import type { ServiceTestResult } from 'stremio/common/lastAddon';
import SecretInput from './SecretInput';
import { isRenderable, isSecretKey, optionLabel, type SchemaNode } from './schema';
import styles from './LastAddon.less';

export type TestHandler = (key: string) => Promise<ServiceTestResult>;

type Props = {
    name: string,
    path: string,
    node: SchemaNode,
    value: unknown,
    onChange: (value: unknown) => void,
    onTest?: TestHandler,
};

// Widget déduit du nœud de schéma : booléen, liste de choix, choix unique, nombre, secret ou texte.
const FieldInput = ({ name, path, node, value, onChange, onTest }: Props) => {
    const { t } = useTranslation();

    if (!isRenderable(node)) return null;

    if (node.type === 'boolean') {
        const toggle = { checked: value === true, onClick: () => onChange(value !== true) };
        return <Toggle tabIndex={-1} {...toggle} />;
    }

    if (node.type === 'array' && node.items?.enum) {
        const selected = Array.isArray(value) ? value as string[] : [];
        return (
            <div className={styles['checkbox-group']}>
                {
                    node.items.enum.map((option) => (
                        <Checkbox
                            key={option}
                            name={`${path}.${option}`}
                            label={optionLabel(t, option)}
                            checked={selected.includes(option)}
                            onChange={({ checked }) => onChange(checked ?
                                [...selected, option] :
                                selected.filter((item) => item !== option))}
                        />
                    ))
                }
            </div>
        );
    }

    if (node.enum) {
        // Un choix sans défaut est facultatif : la première entrée lève la limite.
        const options = [
            ...(node.default === undefined ? [{ label: t('LASTADDON_NO_LIMIT', { defaultValue: 'Aucune limite' }), value: '' }] : []),
            ...node.enum.map((option) => ({ label: optionLabel(t, option), value: option })),
        ];
        return (
            <MultiselectMenu
                className={'multiselect'}
                options={options}
                value={typeof value === 'string' ? value : ''}
                onSelect={(next: string) => onChange(next)}
            />
        );
    }

    if (node.type === 'number' || node.type === 'integer') {
        return (
            <TextInput
                className={styles['text-input']}
                type={'number'}
                min={node.minimum}
                step={'any'}
                value={value === undefined || value === null ? '' : String(value)}
                onChange={(event) => onChange(event.currentTarget.value)}
            />
        );
    }

    if (isSecretKey(name)) {
        return (
            <SecretInput
                value={value}
                onChange={onChange}
                onTest={onTest}
            />
        );
    }

    return (
        <TextInput
            className={styles['text-input']}
            type={node.format === 'uri' ? 'url' : 'text'}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(event.currentTarget.value)}
        />
    );
};

export default FieldInput;
