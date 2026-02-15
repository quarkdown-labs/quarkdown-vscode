# CLAUDE.md — Quarkdown VS Code Extension

## Guidelines

You are a senior software engineer with high expertise in handling complex codebases, compilers, and typesetting systems.
You care about software quality, maintainability, and readability.
Avoid repetitive code at all costs and strive for elegant solutions, abstracting common patterns into reusable components.
Keep functions and classes small and focused on a single responsibility.
It's possible to over-engineer when necessary to achieve high cohesion, low coupling, to anticipate future changes,
leveraging design patterns, such as strategy and visitor (frequent in this codebase), and best practices.

Write medium-sized documentation comments for all public classes, methods, and properties,
and also non-public ones when the logic is not straightforward.

When creating new files, always add them to git via `git add`, and make sure to place them in the correct module and package, following the existing project structure.

## Project Overview

Official VS Code extension for [Quarkdown](https://github.com/quarkdown-labs/quarkdown), providing language support, live preview, and PDF export for `.qd` files. Acts as a bridge between VS Code and the Quarkdown CLI tool.

## Tech Stack

- **Language**: TypeScript
- **Runtime dependency**: `vscode-languageclient` (LSP integration)
- **Package manager**: Yarn
- **Packaging**: `@vscode/vsce`

## Build & Run

```bash
yarn install              # Install dependencies
yarn compile              # TypeScript → JavaScript (src/ → out/)
yarn watch                # Watch mode compilation
yarn build                # Compile + package into .vsix
```

To debug: press F5 in VS Code (uses `.vscode/launch.json` extensionHost config).

There is no test framework configured.

### Key architectural rule

`src/core/` contains **pure, platform-independent** modules with zero VS Code imports. These are wrapped by VS Code-specific files in `src/`. Keep this separation when adding new functionality.

## Extension Features

| Feature | Command | Keybinding |
|---------|---------|------------|
| Live preview | `quarkdown.startPreview` | Shift+Ctrl/Cmd+V |
| Stop preview | `quarkdown.stopPreview` | — |
| PDF export | `quarkdown.exportPdf` | Ctrl/Cmd+Alt+P |
| Restart LSP | `quarkdown.restartLanguageServer` | — |

**User settings**: `quarkdown.path` (executable path), `quarkdown.outputDirectory` (output dir).

## Syntax Highlighting

TextMate grammars live in `syntaxes/` as **git submodules**:
- `syntaxes/quarkdown-tm-grammar` — Quarkdown grammar (from `quarkdown-labs/quarkdown-tm-grammar`)
- `syntaxes/third-party/vscode-markdown-tm-grammar` — VS Code markdown grammar

After cloning, run `git submodule update --init --recursive`.

## Cross-Platform Notes

- **Windows**: processes spawn via `cmd /c`, terminated with `taskkill /pid /t /f`
- **Unix**: direct spawn, terminated with `SIGTERM`
- Platform logic is in `src/core/processManager.ts` and `src/core/commandBuilder.ts`

## Preview System

- Spawns Quarkdown CLI as a child process serving on port **8099**
- Uses HTTP polling to detect server readiness
- Renders via iframe in a VS Code webview (`assets/preview.html`)
- Auto-stops when source document or webview panel is closed

## Conventions

- **Linting**: `yarn lint` (ESLint v9 flat config with `typescript-eslint`)
- **Formatting**: `yarn format` (Prettier) / `yarn format:check` (CI-friendly check)
- User-facing strings are centralized in `src/strings.ts`
- Constants (port, channel names) are in `src/constants.ts`
- Extension activation flow: start LSP client → register commands → register webview serializer → attach document close handler
