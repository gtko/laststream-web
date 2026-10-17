// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, MultiselectMenu } from 'stremio/components';
import FieldInput from './FieldInput';
import { fieldLabel, fieldsOf, isRenderable, optionLabel, type Draft, type SchemaNode } from './schema';
import styles from './LastAddon.less';

type Props = {
    node?: SchemaNode,
    sources: Draft[],
    onChange: (next: Draft[]) => void,
};

// Liste des sources : une variante du `oneOf` du schéma par type (upstream, torznab...), ses champs viennent du schéma.
const SourcesField = ({ node, sources, onChange }: Props) => {
    const { t } = useTranslation();
    const variants = node?.items?.oneOf ?? [];
    const typeOf = (variant: SchemaNode): string => String(variant.properties?.type?.const ?? '');
    const typeOptions = variants.map((variant) => ({
        label: optionLabel(t, typeOf(variant)),
        value: typeOf(variant),
    }));

    if (variants.length === 0) return null;

    const updateSource = (index: number, next: Draft) => {
        onChange(sources.map((source, position) => position === index ? next : source));
    };

    return (
        <div className={styles['sources']}>
            {
                sources.length === 0 &&
                    <div className={styles['hint']}>{t('LASTADDON_SOURCES_EMPTY', { defaultValue: 'Aucune source ajoutée.' })}</div>
            }
            {
                sources.map((source, index) => {
                    const variant = variants.find((item) => typeOf(item) === source.type) ?? variants[0];
                    return (
                        <div key={index} className={styles['source']}>
                            <div className={styles['source-header']}>
                                <MultiselectMenu
                                    className={'multiselect'}
                                    options={typeOptions}
                                    value={source.type}
                                    onSelect={(type: string) => updateSource(index, { type })}
                                />
                                <Button
                                    className={'button'}
                                    title={t('LASTADDON_SOURCE_REMOVE', { defaultValue: 'Retirer cette source' })}
                                    onClick={() => onChange(sources.filter((_, position) => position !== index))}
                                >
                                    {t('LASTADDON_SOURCE_REMOVE', { defaultValue: 'Retirer' })}
                                </Button>
                            </div>
                            {
                                fieldsOf(variant)
                                    .filter(([key, child]) => key !== 'type' && isRenderable(child))
                                    .map(([key, child]) => (
                                        <div key={key} className={styles['field']}>
                                            <div className={styles['field-label']}>{fieldLabel(t, `sources.${key}`, child)}</div>
                                            <FieldInput
                                                name={key}
                                                path={`sources.${key}`}
                                                node={child}
                                                value={source[key]}
                                                onChange={(value) => updateSource(index, { ...source, [key]: value })}
                                            />
                                        </div>
                                    ))
                            }
                        </div>
                    );
                })
            }
            <Button
                className={'button'}
                title={t('LASTADDON_SOURCE_ADD', { defaultValue: 'Ajouter une source' })}
                onClick={() => onChange([...sources, { type: typeOf(variants[0]) }])}
            >
                {t('LASTADDON_SOURCE_ADD', { defaultValue: 'Ajouter une source' })}
            </Button>
        </div>
    );
};

export default SourcesField;
