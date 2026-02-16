import { QUARKDOWN_EXTENSION } from '../constants';

/**
 * Determine whether the given file name appears to be a Quarkdown document.
 *
 * @param fileName File name or path to check
 * @returns true if the file has a .qd extension, false otherwise
 */
export function isQuarkdownFile(fileName: string | undefined): boolean {
    return !!fileName && fileName.toLowerCase().endsWith(QUARKDOWN_EXTENSION);
}

export function getPathFromPdfExportOutput(output: string): string | undefined {
    const match = output.match(/Success.*@ (.+\.pdf)/);
    if (match && match[1]) {
        return match[1].trim();
    }
    return undefined;
}
