export const DEFAULT_PREVIEW_PORT = 8099;

export const OUTPUT_CHANNELS = {
    preview: 'Quarkdown Preview',
    languageServer: 'Quarkdown Language Server',
    pdfExport: 'Quarkdown PDF Export',
} as const;

/** File extension (including dot) for Quarkdown source files. */
export const QUARKDOWN_EXTENSION = '.qd';

export const VIEW_TYPES = {
    preview: 'quarkdownPreview',
} as const;
