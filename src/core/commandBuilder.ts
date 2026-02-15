import * as path from 'path';

/**
 * Command configuration for running Quarkdown.
 */
export interface QuarkdownCommand {
    /** The executable command */
    command: string;
    /** Command line arguments */
    args: string[];
    /** Working directory for the command */
    cwd?: string;
}

/**
 * Utility class for building Quarkdown command configurations.
 * Pure utility functions without VS Code dependencies.
 */
export class QuarkdownCommandBuilder {
    /**
     * Build a basic Quarkdown command with the given executable path and arguments.
     * Handles platform-specific differences (Windows .cmd wrapper).
     *
     * @param executablePath Path to the Quarkdown executable
     * @param additionalArgs Additional command line arguments
     * @returns Command configuration ready for process execution
     */
    public static buildCommand(executablePath: string, additionalArgs: string[]): Omit<QuarkdownCommand, 'cwd'> {
        if (process.platform === 'win32') {
            // On Windows, wrap with cmd.exe
            const launcher = path.extname(executablePath) ? executablePath : `${executablePath}`;
            return {
                command: 'cmd',
                args: ['/c', launcher, ...additionalArgs],
            };
        }

        return {
            command: executablePath,
            args: additionalArgs,
        };
    }

    /**
     * Build a command for compiling Quarkdown files with standard options.
     *
     * @param executablePath Path to the Quarkdown executable
     * @param filePath Path to the source .qd file
     * @param outputDir Output directory for compilation artifacts
     * @param additionalArgs Additional command line arguments
     * @returns Complete command configuration including working directory
     */
    public static buildCompileCommand(
        executablePath: string,
        filePath: string,
        outputDir: string,
        additionalArgs: string[] = []
    ): QuarkdownCommand {
        const baseCommand = this.buildCommand(executablePath, [
            'c',
            path.basename(filePath),
            '--out',
            outputDir,
            ...additionalArgs,
            '--browser',
            'none',
        ]);

        return {
            ...baseCommand,
            cwd: path.dirname(filePath),
        };
    }

    /**
     * Build a command for starting the language server.
     *
     * @param executablePath Path to the Quarkdown executable
     * @returns Command configuration for the language server
     */
    public static buildLanguageServerCommand(executablePath: string): Omit<QuarkdownCommand, 'cwd'> {
        return this.buildCommand(executablePath, ['language-server']);
    }

    /**
     * Build a command for PDF export.
     *
     * @param executablePath Path to the Quarkdown executable
     * @param filePath Path to the source .qd file
     * @param outputDir Output directory for the PDF
     * @returns Complete command configuration for PDF export
     */
    public static buildPdfExportCommand(executablePath: string, filePath: string, outputDir: string): QuarkdownCommand {
        return this.buildCompileCommand(executablePath, filePath, outputDir, ['--pdf']);
    }

    /**
     * Build a command for live preview with server.
     *
     * @param executablePath Path to the Quarkdown executable
     * @param filePath Path to the source .qd file
     * @param outputDir Output directory for preview artifacts
     * @param port Server port for preview
     * @param additionalArgs Additional command line arguments
     * @returns Complete command configuration for live preview
     */
    public static buildPreviewCommand(
        executablePath: string,
        filePath: string,
        outputDir: string,
        port: number,
        additionalArgs: string[] = []
    ): QuarkdownCommand {
        return this.buildCompileCommand(executablePath, filePath, outputDir, [
            '--preview',
            '--watch',
            '--server-port',
            port.toString(),
            ...additionalArgs,
        ]);
    }
}
