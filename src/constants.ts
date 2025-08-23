export const DEFAULT_PREVIEW_PORT = 8099;

export const OUTPUT_CHANNELS = {
    preview: 'Quarkdown Preview',
    languageServer: 'Quarkdown Language Server'
} as const;

/** Quarkdown configuration section name in settings.json */
export const CONFIG_ROOT = 'quarkdown';

/** Configuration keys under the quarkdown root. */
export const CONFIG_KEYS = {
    executablePath: 'path'
} as const;

/** File extension (including dot) for Quarkdown source files. */
export const QUARKDOWN_EXTENSION = '.qd';

export const VIEW_TYPES = {
    preview: 'quarkdownPreview'
} as const;
