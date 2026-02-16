import * as assert from 'assert';
import { getActiveQuarkdownDocument } from '../../src/vscode/utils';

suite('VS Code Utils', () => {
    test('getActiveQuarkdownDocument: undefined with no active editor', () => {
        const doc = getActiveQuarkdownDocument();
        assert.strictEqual(doc, undefined);
    });
});
