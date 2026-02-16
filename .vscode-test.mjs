import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
    files: 'out/test/vscode/**/*.test.js',
    mocha: {
        timeout: 10_000,
    },
});
