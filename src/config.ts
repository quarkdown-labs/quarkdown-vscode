import * as path from 'path';
import * as vscode from 'vscode';

/** Quarkdown configuration section name in settings.json */
const CONFIG_ROOT = 'quarkdown';

/** Configuration keys under the quarkdown root. */
const CONFIG_KEYS = {
    executablePath: 'path',
    outputDirectory: 'outputDirectory',
} as const;

/**
 * Configuration interface for type safety.
 */
export interface QuarkdownConfig {
    /** Path to the Quarkdown executable */
    executablePath: string;
    /** Output directory for Quarkdown artifacts */
    outputDirectory: string;
}

/**
 * Gets a configuration value, falling back to a default if not set or invalid.
 *
 * @param key Configuration key (under the quarkdown root).
 * @param defaultValue Default value to use if not set or invalid.
 * @param validate Optional validation function to check the retrieved value.
 * @returns The configuration value, or the default if not set or invalid.
 */
function getConfigValue<T>(key: string, defaultValue: T, validate: (value: T) => boolean = () => true): T {
    const config = vscode.workspace.getConfiguration(CONFIG_ROOT);
    const value = config.get<T>(key, defaultValue);
    if (validate(value)) {
        return value;
    }
    return defaultValue;
}

/**
 * Validates that a string value is non-empty.
 */
const isNonEmptyString = (value: string): boolean => value.length > 0;

// Configuration getters with better documentation and validation

/**
 * Get the configured path to the Quarkdown executable.
 * Defaults to 'quarkdown' if not configured.
 */
export const getExecutablePath = (): string => getConfigValue<string>(CONFIG_KEYS.executablePath, 'quarkdown');

/**
 * Get the configured output directory for Quarkdown artifacts,
 * resolved as an absolute path against the workspace root.
 * If the configured value is already absolute or no workspace is open,
 * it is returned as-is.
 * Defaults to 'output' if not configured or if empty.
 */
export const getOutputDirectory = (): string => {
    const outputDir = getConfigValue<string>(CONFIG_KEYS.outputDirectory, 'output', isNonEmptyString);
    if (path.isAbsolute(outputDir)) {
        return outputDir;
    }
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        return outputDir;
    }
    return path.resolve(workspaceRoot, outputDir);
};

/**
 * Get all Quarkdown configuration as a typed object.
 * Useful for passing configuration to pure functions that don't depend on VS Code.
 */
export const getQuarkdownConfig = (): QuarkdownConfig => ({
    executablePath: getExecutablePath(),
    outputDirectory: getOutputDirectory(),
});
