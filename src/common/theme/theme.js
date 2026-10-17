// Copyright (C) 2017-2026 Smart code 203358507

const STORAGE_KEY = 'laststream.theme';
const DEFAULT_THEME_ID = 'laststream';
const CUSTOM_THEME_ID = 'custom';
const LIGHT_TEXT_COLOR = '#FFFFFF';
const DARK_TEXT_COLOR = '#000000';
const MIN_TEXT_CONTRAST = 4.5;
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;
const THEME_VARIABLE_NAMES = ['--primary-accent-color', '--primary-accent-foreground-color', '--outer-glow'];
// Strict allow-list for stored variable values. The inline script in src/index.html uses the same literal
// (tests/theme.spec.js asserts that both are identical), so anything else is never handed to setProperty.
const VALUE_PATTERN = /^(#[0-9a-f]{6}|0px 0px 15px rgba\(\d{1,3}, \d{1,3}, \d{1,3}, 0\.\d{1,2}\))$/i;

// The "laststream" preset is the app default: its accent matches the base values in App/styles.less.
const PRESETS = [
    { id: 'laststream', labelKey: 'THEME_LASTSTREAM', defaultLabel: 'Laststream', accent: '#FF5A36' },
    { id: 'stremio', labelKey: 'THEME_STREMIO', defaultLabel: 'Stremio', accent: '#7B5BF5' },
    { id: 'teal', labelKey: 'THEME_TEAL', defaultLabel: 'Teal', accent: '#19C3A6' },
    { id: 'amber', labelKey: 'THEME_AMBER', defaultLabel: 'Amber', accent: '#F5B700' },
];

const isHexColor = (value) => typeof value === 'string' && HEX_COLOR_REGEX.test(value);

const hexToRgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));

const toLinearChannel = (value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
};

const getRelativeLuminance = (hex) => {
    const [red, green, blue] = hexToRgb(hex).map(toLinearChannel);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

// WCAG contrast ratio between two opaque colors.
const getContrastRatio = (firstHex, secondHex) => {
    const first = getRelativeLuminance(firstHex);
    const second = getRelativeLuminance(secondHex);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

// White is used whenever it reaches 4.5:1. Otherwise pure black is used: white failing means the accent luminance
// is above ~0.18, which puts black above 4.6:1, so text on the accent always stays readable.
const getAccentForegroundColor = (accent) => (
    getContrastRatio(accent, LIGHT_TEXT_COLOR) >= MIN_TEXT_CONTRAST ? LIGHT_TEXT_COLOR : DARK_TEXT_COLOR
);

const getThemeVariables = (accent) => {
    const [red, green, blue] = hexToRgb(accent);
    return {
        '--primary-accent-color': accent,
        '--primary-accent-foreground-color': getAccentForegroundColor(accent),
        '--outer-glow': `0px 0px 15px rgba(${red}, ${green}, ${blue}, 0.37)`,
    };
};

const buildTheme = (id, accent) => ({
    id,
    accent,
    variables: accent === null ? {} : getThemeVariables(accent),
});

const createTheme = (id, customAccent) => {
    if (id === CUSTOM_THEME_ID) {
        return isHexColor(customAccent) ?
            buildTheme(CUSTOM_THEME_ID, customAccent.toLowerCase())
            :
            buildTheme(DEFAULT_THEME_ID, null);
    }

    const preset = PRESETS.find((item) => item.id === id) || PRESETS[0];
    return buildTheme(preset.id, preset.accent);
};

const readStoredTheme = () => {
    try {
        const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
        return createTheme(stored?.id, stored?.accent);
    } catch {
        return createTheme(DEFAULT_THEME_ID);
    }
};

const writeStoredTheme = (theme) => {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    } catch {
        // Storage can be unavailable (private window, blocked site data): the theme still applies for this session.
    }
};

const applyTheme = (theme) => {
    const style = document.documentElement.style;
    THEME_VARIABLE_NAMES.forEach((name) => {
        const value = theme.variables[name];
        if (typeof value === 'string' && VALUE_PATTERN.test(value)) {
            style.setProperty(name, value);
        } else {
            style.removeProperty(name);
        }
    });
};

module.exports = {
    STORAGE_KEY,
    CUSTOM_THEME_ID,
    DEFAULT_THEME_ID,
    PRESETS,
    THEME_VARIABLE_NAMES,
    VALUE_PATTERN,
    getContrastRatio,
    getAccentForegroundColor,
    getThemeVariables,
    createTheme,
    readStoredTheme,
    writeStoredTheme,
    applyTheme,
};
