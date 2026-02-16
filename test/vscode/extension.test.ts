import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension', () => {
    /** Ensure the extension is activated before running command checks. */
    suiteSetup(async () => {
        const ext = vscode.extensions.getExtension('Quarkdown.quarkdown-vscode');
        if (ext && !ext.isActive) {
            await ext.activate();
        }
    });

    test('extension activates', async () => {
        const ext = vscode.extensions.getExtension('Quarkdown.quarkdown-vscode');
        assert.ok(ext, 'Extension not found');
        assert.ok(ext.isActive, 'Extension is not active');
    });

    const expectedCommands = [
        'quarkdown.startPreview',
        'quarkdown.stopPreview',
        'quarkdown.exportPdf',
        'quarkdown.restartLanguageServer',
    ];

    for (const command of expectedCommands) {
        test(`command "${command}" is registered`, async () => {
            const allCommands = await vscode.commands.getCommands(true);
            assert.ok(allCommands.includes(command), `Command ${command} not found`);
        });
    }
});
