# Changelog

## [Unreleased]

- Fixed Quarkdown processes sometimes remaining alive after closing VS Code.
- Fixed preview startup hanging indefinitely when the server fails to start — now shows an error after ~2 minutes.
- Improved PDF export reliability and reduced CPU usage during export.
- Improved security of process spawning and preview URL handling.

## [1.0.4] - 2025-11-03

- Fixed an issue that would cause the preview to start up on Quarkdown v1.12.

## [1.0.3] - 2025-09-17

- Changed the PDF export keybinding to `Ctrl/⌘+Alt+P` to avoid conflicts.

## [1.0.2] - 2025-09-10

- Fixed process spawning issues on Windows.