import * as vscode from 'vscode';

/** Quarkdown configuration section name in settings.json */
const CONFIG_ROOT = 'quarkdown';

/** Configuration keys under the quarkdown root. */
const CONFIG_KEYS = {
    executablePath: 'path',
    outputDirectory: 'outputDirectory'
} as const;

/**
 * Gets a configuration value, falling back to a default if not set or invalid.
 *
 * @param key Configuration key (under the quarkdown root).
 * @param defaultValue Default value to use if not set or invalid.
 * @param validate Optional validation function to check the retrieved value.
 * @returns The configuration value, or the default if not set or invalid.
 */
function getConfigValue<T>(
    key: string,
    defaultValue: T,
    validate: (value: T) => boolean = () => true
): T {
    const config = vscode.workspace.getConfiguration(CONFIG_ROOT);
    const value = config.get<T>(key, defaultValue);
    if (validate(value)) {
        return value;
    }
    return defaultValue;
}

// Configurations

export const getExecutablePath = () => getConfigValue<string>(CONFIG_KEYS.executablePath, 'quarkdown');
export const getOutputDirectory = () => getConfigValue<string>(CONFIG_KEYS.outputDirectory, 'output', value => value.length > 0);