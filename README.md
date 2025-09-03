# 🪐 Official Quarkdown extension for VS Code

This extension provides [Quarkdown](https://quarkdown.com/) language support for `.qd` files.

## Features

### In-editor live preview

Launch the live preview from the menu command or by using the keyboard shortcut `Ctrl/⌘+Shift+V`.

Live preview will let you see your changes in real-time as you edit your Quarkdown files,
vastly boosting your productivity.

![Live preview demo](https://raw.githubusercontent.com/quarkdown-labs/quarkdown-vscode/refs/heads/project-files/live-preview.gif)

### User-first completions

Receive comprehensive completions for functions, parameters and values, with a flow designed to get your work done faster.

![Completions demo](https://raw.githubusercontent.com/quarkdown-labs/quarkdown-vscode/refs/heads/project-files/completions.gif)

### PDF export

Easily export your Quarkdown document to PDF from the menu command or by using the keyboard shortcut `Ctrl/⌘+Shift+P`.

`TODO img`

### Documentation

Documentation for functions can be accessed on hover or during completion.

![Documentation demo](https://raw.githubusercontent.com/quarkdown-labs/quarkdown-vscode/refs/heads/project-files/docs.png)

### Diagnostics

Diagnostics cover common function call mistakes, helping you identify and fix issues quickly.

![Diagnostics demo](https://raw.githubusercontent.com/quarkdown-labs/quarkdown-vscode/refs/heads/project-files/diagnostics.png)

## Requirements

This extension makes extensive use of Quarkdown's language server, available from version 1.9.0 of the software and above.

Check out the [installation guide](https://github.com/iamgio/quarkdown?tab=readme-ov-file#getting-started) to quickly get started with Quarkdown.

## FAQ

**Q: Why am I not getting completions for my custom functions?**  
A: The language server is young and does not perform complex analysis yet. Function data is only retrieved from the documentation found in Quarkdown's `docs` directory, thus only the stdlib is supported. This is planned to be improved in future releases.

**Q: Why aren't my function calls highlighted?**  
A: Function call highlighting happens on the server side via semantic tokens.
This is enabled by default, but in case it isn't working properly, make sure `editor.semanticHighlighting.enabled` is set to `true`.

**Q: How to adjust the live preview refresh rate?**  
A: Compilation is triggered every time the document is saved. The auto-save delay defaults to 150ms, and can be adjusted by changing the `files.autoSaveDelay` setting.