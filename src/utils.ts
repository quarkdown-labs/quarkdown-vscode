import { QUARKDOWN_EXTENSION } from './constants';

/**
 * Determine whether the given file name appears to be a Quarkdown document.
 *
 * @param fileName File name or path to check
 * @returns true if the file has a .qd extension, false otherwise
 */
export function isQuarkdownFile(fileName: string | undefined): boolean {
    return !!fileName && fileName.toLowerCase().endsWith(QUARKDOWN_EXTENSION);
}
