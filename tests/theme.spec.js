// Copyright (C) 2017-2026 Smart code 203358507

const fs = require('fs');
const path = require('path');
const theme = require('../src/common/theme/theme');

const readProjectFile = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

// Runs writeStoredTheme against an in-memory storage and returns the exact string it would persist.
const captureStoredTheme = (value) => {
    let stored = null;
    global.window = { localStorage: { setItem: (key, data) => { stored = data; } } };
    try {
        theme.writeStoredTheme(value);
    } finally {
        delete global.window;
    }
    return JSON.parse(stored);
};

describe('theme', () => {
    describe('contrast of text drawn on the accent', () => {
        it('reaches 4.5:1 for every preset accent', () => {
            theme.PRESETS
                .filter((preset) => preset.accent !== null)
                .forEach((preset) => {
                    const foreground = theme.getAccentForegroundColor(preset.accent);
                    expect(theme.getContrastRatio(preset.accent, foreground)).toBeGreaterThanOrEqual(4.5);
                });
        });

        it('reaches 4.5:1 for a grid of arbitrary accents', () => {
            for (let red = 0; red < 256; red += 17) {
                for (let green = 0; green < 256; green += 17) {
                    for (let blue = 0; blue < 256; blue += 17) {
                        const accent = `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
                        const foreground = theme.getAccentForegroundColor(accent);
                        expect(theme.getContrastRatio(accent, foreground)).toBeGreaterThanOrEqual(4.5);
                    }
                }
            }
        });

        it('picks dark text on light accents and white text on dark accents', () => {
            expect(theme.getAccentForegroundColor('#F5B700')).toBe('#000000');
            expect(theme.getAccentForegroundColor('#101010')).toBe('#FFFFFF');
        });

        it('keeps white text on the Stremio accent, which reaches 4.5:1 with white', () => {
            expect(theme.getAccentForegroundColor('#7B5BF5')).toBe('#FFFFFF');
        });
    });

    describe('createTheme', () => {
        it('uses coral as the laststream default preset', () => {
            expect(theme.createTheme('laststream')).toEqual({
                id: 'laststream',
                accent: '#FF5A36',
                variables: {
                    '--primary-accent-color': '#FF5A36',
                    '--primary-accent-foreground-color': '#000000',
                    '--outer-glow': '0px 0px 15px rgba(255, 90, 54, 0.37)',
                },
            });
        });

        it('falls back to the laststream preset for an unknown id', () => {
            expect(theme.createTheme('unknown').id).toBe('laststream');
            expect(theme.createTheme('coral').id).toBe('laststream');
        });

        it('derives accent, foreground and glow variables for a preset', () => {
            expect(theme.createTheme('stremio').variables).toEqual({
                '--primary-accent-color': '#7B5BF5',
                '--primary-accent-foreground-color': '#FFFFFF',
                '--outer-glow': '0px 0px 15px rgba(123, 91, 245, 0.37)',
            });
        });

        it('accepts a valid custom accent and lowercases it', () => {
            const custom = theme.createTheme('custom', '#AABBCC');
            expect(custom.id).toBe('custom');
            expect(custom.accent).toBe('#aabbcc');
            expect(custom.variables['--primary-accent-color']).toBe('#aabbcc');
        });

        it('rejects an invalid custom accent', () => {
            expect(theme.createTheme('custom', 'not-a-color').id).toBe('laststream');
            expect(theme.createTheme('custom', undefined).id).toBe('laststream');
        });
    });

    describe('storage', () => {
        const originalWindow = global.window;

        afterEach(() => {
            global.window = originalWindow;
        });

        const withStorage = (getItem, setItem = () => {}) => {
            global.window = { localStorage: { getItem, setItem } };
        };

        it('reads a stored custom theme', () => {
            withStorage(() => JSON.stringify({ id: 'custom', accent: '#123456' }));
            expect(theme.readStoredTheme().accent).toBe('#123456');
        });

        it('falls back to the default when nothing is stored', () => {
            withStorage(() => null);
            expect(theme.readStoredTheme().id).toBe('laststream');
        });

        it('falls back to the default when the stored value is corrupted', () => {
            withStorage(() => '{not json');
            expect(theme.readStoredTheme().id).toBe('laststream');
        });

        it('falls back to the default when storage throws', () => {
            withStorage(() => {
                throw new Error('storage blocked');
            });
            expect(theme.readStoredTheme().id).toBe('laststream');
        });

        it('does not throw when writing to storage fails', () => {
            withStorage(() => null, () => {
                throw new Error('quota exceeded');
            });
            expect(() => theme.writeStoredTheme(theme.createTheme('teal'))).not.toThrow();
        });

        it('writes the theme under the laststream.theme key', () => {
            const setItem = jest.fn();
            withStorage(() => null, setItem);
            theme.writeStoredTheme(theme.createTheme('teal'));
            expect(setItem).toHaveBeenCalledWith('laststream.theme', expect.any(String));
        });
    });

    describe('head script validation', () => {
        const headScript = readProjectFile('src/index.html');
        const headLiteral = headScript.match(/var VALUE_PATTERN = (\/.+\/[a-z]*);/);
        const headPattern = new Function(`return ${headLiteral[1]};`)();

        it('uses the same VALUE_PATTERN as the module', () => {
            expect(headPattern.toString()).toBe(theme.VALUE_PATTERN.toString());
        });

        it('accepts every variable value that writeStoredTheme persists', () => {
            const themes = [
                ...theme.PRESETS.map((preset) => theme.createTheme(preset.id)),
                theme.createTheme('custom', '#2F72DE'),
                theme.createTheme('custom', '#000000'),
            ];
            themes.forEach((value) => {
                const stored = captureStoredTheme(value);
                Object.values(stored.variables).forEach((variableValue) => {
                    expect(headPattern.test(variableValue)).toBe(true);
                });
            });
        });

        it('rejects anything that is not a hex colour or the glow shape', () => {
            expect(headPattern.test('red; background: url(https://evil.example)')).toBe(false);
            expect(headPattern.test('#FF5A3')).toBe(false);
            expect(headPattern.test('rgba(255, 90, 54, 1)')).toBe(false);
        });
    });

    describe('stylesheet defaults', () => {
        it('match the laststream preset, so the default needs no JavaScript', () => {
            const styles = readProjectFile('src/App/styles.less');
            const [, red, green, blue] = styles.match(/--primary-accent-color:\s*rgb\((\d+), (\d+), (\d+)\);/);
            const accent = `#${[red, green, blue].map((value) => Number(value).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
            const foreground = styles.match(/--primary-accent-foreground-color:\s*(#[0-9a-f]{6});/i)[1].toUpperCase();
            const glow = styles.match(/--outer-glow:\s*([^;]+);/)[1];
            const preset = theme.createTheme('laststream').variables;

            expect(accent).toBe(preset['--primary-accent-color']);
            expect(foreground).toBe(preset['--primary-accent-foreground-color']);
            expect(glow).toBe(preset['--outer-glow']);
        });
    });
});
