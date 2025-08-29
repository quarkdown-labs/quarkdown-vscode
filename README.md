# 🪐 Official Quarkdown extension for VS Code

This extension provides [Quarkdown](https://quarkdown.com/) language support for `.qd` files.

## Features

### Syntax highlighting

Syntax highlighting is provided for both function calls and base Markdown content.

`TODO img`

### User-first completions

Receive comprehensive completions for functions, parameters and values, with a flow designed to get your work done faster.

`TODO gif`

### In-editor live preview

Launch the live preview from the menu command or by using the keyboard shortcut `Ctrl/⌘+Shift+V`.

Live preview will let you see your changes in real-time as you edit your Quarkdown files,
boosting your productivity and helping you catch errors early.

`TODO gif`

### PDF export

Easily export your Quarkdown document to PDF from the menu command or by using the keyboard shortcut `Ctrl/⌘+Shift+P`.

`TODO img`

### Documentation

Documentation for functions can be accessed on hover or during completion.

`TODO img`

### Diagnostics

Diagnostics cover common function call mistakes, helping you identify and fix issues quickly.

`TODO img`

## Requirements

This extension makes extensive use of Quarkdown's language server, available from version 1.9.0 of the software and above.

Check out the [installation guide](https://github.com/iamgio/quarkdown?tab=readme-ov-file#getting-started) to quickly get started with Quarkdown.

## FAQ

**Q: Why am I not getting completions for my custom functions?**  
A: The language server is young and does not perform complex analysis yet. Function data is only retrieved from the documentation found in Quarkdown's `docs` directory, thus only the stdlib is supported. This is planned to be improved in future releases.

**Q: Why aren't my function calls highlighted?**  
A: Function call highlighting happens on the server side via semantic tokens.
This should be enabled by default, but in case it isn't working properly, make sure `editor.semanticHighlighting.enabled` is set to `true`.

**Q: Why is my live preview delayed?**  
A: Compilation happens almost instantly, but it's triggered only when the document is saved. To improve the experience you might consider lowering the auto-save delay in your VS Code settings (`files.autoSaveDelay`) but beware of throttling due to high throughput.