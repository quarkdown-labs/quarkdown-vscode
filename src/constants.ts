/**
 * Shared constants for the Quarkdown VS Code extension.
 * Centralizing these avoids duplication and magic numbers/strings.
 */
export const DEFAULT_PREVIEW_PORT = 8099;

export const OUTPUT_CHANNELS = Object.freeze({
    preview: 'Quarkdown Preview',
    languageServer: 'Quarkdown Language Server'
});

/** Quarkdown configuration section name in settings.json */
export const CONFIG_ROOT = 'quarkdown';

/** Configuration keys under the quarkdown root. */
export const CONFIG_KEYS = Object.freeze({
    executablePath: 'path'
});

/** File extension (including dot) for Quarkdown source files. */
export const QUARKDOWN_EXTENSION = '.qd';
