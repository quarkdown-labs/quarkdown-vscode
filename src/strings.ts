export const Strings = {
    previewPanelTitle: 'Quarkdown Preview',
    previewWaitingTitle: 'Quarkdown Preview (waiting…)',
    previewStartingInfo: 'Starting live preview...',
    previewInstallErrorTitle: 'Preview failed to start. Please check your Quarkdown installation.',
    previewInstallGuide: 'Install Guide',
    loadingMessage: 'Launching Quarkdown preview…',
    stillWaitingMessage: 'Still waiting to load preview…',

    // Extension messages
    openQuarkdownFirst: 'Please open a Quarkdown (.qd) file first.',
    saveBeforePreview: 'Please save the file before starting preview.',
    previewStopped: 'Live preview stopped.',
    previewNotRunning: 'No preview is currently running.',
    lsRestarted: 'Quarkdown Language Server restarted successfully.',
    lsRestartFailed: 'Failed to restart Language Server.',

    // PDF export
    chooseFolder: 'Choose Output Folder',
    saveBeforeExport: 'Please save the file before exporting.',
    quarkdownNotFound: 'Quarkdown not found. Please install Quarkdown first.',
    exportInProgress: 'Exporting to PDF…',
    exportAlreadyInProgress: 'A PDF export is already in progress. Please wait.',
    exportFailed: 'PDF export failed',
    exportSucceeded: 'PDF exported successfully.',
    exportPdfNotFound: 'Output PDF was not created',
} as const;
