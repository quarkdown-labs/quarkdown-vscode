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

export function getPathFromPdfExportOutput(output: string): [string, 'file' | 'folder'] | undefined {
    const pdfMatch = output.match(/Success.*@ (.+\.pdf)/);
    if (pdfMatch && pdfMatch[1]) {
        return [pdfMatch[1].trim(), 'file'];
    }
    
    const folderMatch = output.match(/Success.*@ (.+?)(?:\s|$)/);
    if (folderMatch && folderMatch[1]) {
        return [folderMatch[1].trim(), 'folder'];
    }
    
    return undefined;
}
