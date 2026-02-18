# Changelog

## [1.1.0] - 2026-02-17

- Added an *Open PDF* button to the PDF export notification, to easily open the exported PDF file.
- Logs from PDF export are now persistent in the `Quarkdown PDF Export` output channel.

## [1.0.5] - 2026-02-16

-   Fixed Quarkdown processes sometimes remaining alive after closing VS Code.
-   Fixed preview startup hanging indefinitely when the server fails to start.
-   Improved PDF export reliability and reduced CPU usage during export.
-   Improved security of process spawning and preview URL handling.

## [1.0.4] - 2025-11-03

-   Fixed an issue that would cause the preview to start up on Quarkdown v1.12.

## [1.0.3] - 2025-09-17

-   Changed the PDF export keybinding to `Ctrl/⌘+Alt+P` to avoid conflicts.

## [1.0.2] - 2025-09-10

-   Fixed process spawning issues on Windows.

[Unreleased]: https://github.com/quarkdown-labs/quarkdown-vscode/compare/v1.0.5...HEAD

[1.0.5]: https://github.com/quarkdown-labs/quarkdown-vscode/compare/6269170cb1312a38275d1f90fe56155b5f52be37...v1.0.5
