// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import { useTranslation } from 'react-i18next';
import { testService } from 'stremio/common/lastAddon';
import { Category, Option } from '../components';
import { testServiceKey } from './actions';
import FieldInput, { type TestHandler } from './FieldInput';
import SourcesField from './SourcesField';
import { fieldLabel, fieldsOf, isRenderable, isSecretKey, type Draft, type SchemaNode } from './schema';

type Props = {
    schema: SchemaNode,
    draft: Draft,
    onChange: (path: string[], value: unknown) => void,
};

// Formulaire généré à partir du schéma : libellés, options et champs viennent de /config/schema.
const ConfigForm = ({ schema, draft, onChange }: Props) => {
    const { t } = useTranslation();
    const roots = schema.properties ?? {};

    const renderFields = (root: string, testerFor?: (name: string) => TestHandler | undefined) => (
        fieldsOf(roots[root])
            .filter(([, node]) => isRenderable(node))
            .map(([name, node]) => {
                const path = `${root}.${name}`;
                return (
                    <Option key={path} label={fieldLabel(t, path, node)}>
                        <FieldInput
                            name={name}
                            path={path}
                            node={node}
                            value={draft[root]?.[name]}
                            onChange={(value) => onChange([root, name], value)}
                            onTest={testerFor?.(name)}
                        />
                    </Option>
                );
            })
    );

    return (
        <>
            <Category icon={'magnet-link'} label={t('LASTADDON_CATEGORY_SOURCES', { defaultValue: 'Sources' })}>
                <SourcesField
                    node={roots.sources}
                    sources={(draft.sources ?? []) as Draft[]}
                    onChange={(next) => onChange(['sources'], next)}
                />
            </Category>
            <Category icon={'subtitles'} label={t('LASTADDON_CATEGORY_LANGUAGES', { defaultValue: 'Langues' })}>
                { renderFields('languages') }
            </Category>
            <Category icon={'hdr'} label={t('LASTADDON_CATEGORY_QUALITIES', { defaultValue: 'Qualités' })}>
                { renderFields('resolutions') }
            </Category>
            <Category icon={'details'} label={t('LASTADDON_CATEGORY_SIZES', { defaultValue: 'Tailles' })}>
                { renderFields('size') }
            </Category>
            <Category icon={'cloud-library'} label={t('LASTADDON_CATEGORY_DEBRID', { defaultValue: 'Débrid' })}>
                {
                    renderFields('debrid', (name) => isSecretKey(name) ?
                        (key) => testService('alldebrid', key) :
                        undefined)
                }
            </Category>
            <Category icon={'settings'} label={t('LASTADDON_CATEGORY_SERVICES', { defaultValue: 'Clés de services' })}>
                {
                    renderFields('services', (name) => isSecretKey(name) ?
                        (key) => testServiceKey(name, key) :
                        undefined)
                }
            </Category>
        </>
    );
};

export default ConfigForm;
