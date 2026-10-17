import React, { useCallback, useId, useState } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import {
    PRESETS,
    CUSTOM_THEME_ID,
    createTheme,
    readStoredTheme,
    writeStoredTheme,
    applyTheme,
} from 'stremio/common/theme/theme';
import styles from './ThemeSelector.less';

const DEFAULT_CUSTOM_ACCENT = '#7b5bf5';

const ThemeSelector = () => {
    const { t } = useTranslation();
    const [theme, setTheme] = useState(readStoredTheme);
    const [customAccent, setCustomAccent] = useState<string>(() => (
        theme.id === CUSTOM_THEME_ID && theme.accent ? theme.accent : DEFAULT_CUSTOM_ACCENT
    ));

    const selectTheme = useCallback((nextTheme: ReturnType<typeof createTheme>) => {
        writeStoredTheme(nextTheme);
        applyTheme(nextTheme);
        setTheme(nextTheme);
    }, []);

    const onCustomAccentChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setCustomAccent(event.target.value);
        selectTheme(createTheme(CUSTOM_THEME_ID, event.target.value));
    }, [selectTheme]);

    const customSelected = theme.id === CUSTOM_THEME_ID;
    const customStateId = useId();

    return (
        <div className={styles['theme-selector']}>
            {
                PRESETS.map((preset) => {
                    const label = t(preset.labelKey, { defaultValue: preset.defaultLabel });
                    const selected = theme.id === preset.id;
                    return (
                        <button
                            key={preset.id}
                            type={'button'}
                            className={classNames(styles['swatch'], { [styles['selected']]: selected })}
                            style={{ '--swatch-color': preset.accent } as React.CSSProperties}
                            aria-pressed={selected}
                            aria-label={label}
                            title={label}
                            onClick={() => selectTheme(createTheme(preset.id))}
                        >
                            <span className={styles['swatch-color']} />
                            <span className={styles['swatch-label']}>{label}</span>
                        </button>
                    );
                })
            }
            <label
                className={classNames(styles['swatch'], { [styles['selected']]: customSelected })}
                style={{ '--swatch-color': customAccent } as React.CSSProperties}
            >
                <input
                    type={'color'}
                    className={styles['custom-input']}
                    value={customAccent}
                    aria-describedby={customStateId}
                    onChange={onCustomAccentChange}
                />
                <span className={styles['swatch-label']}>{t('THEME_CUSTOM', { defaultValue: 'Custom accent' })}</span>
            </label>
            <span id={customStateId} className={styles['visually-hidden']}>
                {customSelected ? t('THEME_SELECTED', { defaultValue: 'Selected' }) : ''}
            </span>
        </div>
    );
};

export default ThemeSelector;
