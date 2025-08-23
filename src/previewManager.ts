import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as http from 'http';
import * as net from 'net';
import * as fs from 'fs';
import { getQuarkdownCommandArgs } from './utils';
import { DEFAULT_PREVIEW_PORT, OUTPUT_CHANNELS, VIEW_TYPES } from './constants';
import { Strings } from './strings';

/**
 * Manages a single live Quarkdown preview process & its associated browser view.
 * Singleton ensures only one process (port) at a time for now.
 */
export class QuarkdownPreviewManager {
    private static instance: QuarkdownPreviewManager;
    private previewProcess: cp.ChildProcess | undefined;
    private currentFilePath: string | undefined;
    private readonly outputChannel: vscode.OutputChannel;
    private readonly port: number = DEFAULT_PREVIEW_PORT;
    private webviewPanel: vscode.WebviewPanel | undefined;
    private isStopping = false;
    private serverReadyTimer: NodeJS.Timeout | undefined;
    private proxyServer: http.Server | undefined;
    private proxyPort: number | undefined;

    private readonly url: string = `http://localhost:${this.port}`;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNELS.preview);
    }

    public static getInstance(): QuarkdownPreviewManager {
        return this.instance || (this.instance = new QuarkdownPreviewManager());
    }

    /** Load HTML template and inject CSP + strings */
    private getWebviewHtml(): string {
        const ext = vscode.extensions.getExtension('Quarkdown.quarkdown-vscode')
            || vscode.extensions.all.find(e => e.packageJSON?.name === 'quarkdown-vscode');
        const baseUri = ext ? ext.extensionUri : vscode.Uri.file(path.dirname(__dirname));
        const htmlPath = vscode.Uri.joinPath(baseUri, 'assets', 'preview.html');
        let raw: string;
        try {
            raw = fs.readFileSync(htmlPath.fsPath, 'utf8');
        } catch (e) {
            this.outputChannel.appendLine(`[preview] Failed to read webview HTML at ${htmlPath.fsPath}: ${e}`);
            return `<!DOCTYPE html><html><body>Failed to load preview UI.</body></html>`;
        }

        const allowedPort = this.proxyPort ?? this.port;
        const allowedOrigins = [`http://localhost:${allowedPort}`, `http://127.0.0.1:${allowedPort}`].join(' ');

        return raw
            .replace(/__FRAME_ORIGINS__/g, allowedOrigins)
            .replace(/__LOADING_MESSAGE__/g, Strings.loadingMessage)
            .replace(/__STILL_WAITING_MESSAGE__/g, Strings.stillWaitingMessage);
    }

    /** Start (or restart) the preview for a file */
    public async startPreview(filePath: string): Promise<void> {
        await this.stopPreview();

        const { command, args } = getQuarkdownCommandArgs([
            'c', path.basename(filePath),
            '--preview', '--watch',
            '--browser', 'none',
            '--server-port', this.port.toString()
        ]);
        this.outputChannel.appendLine(`[preview] Starting: ${command} ${args.join(' ')}`);

        try {
            this.previewProcess = cp.execFile(command, args, { cwd: path.dirname(filePath) });
            this.previewProcess.on('exit', (code, signal) => {
                this.outputChannel.appendLine(`[preview] Process exited (code=${code} signal=${signal})`);
                this.cleanup();
            });
            this.previewProcess.on('error', (error: NodeJS.ErrnoException) => {
                this.outputChannel.appendLine(`[preview] Process error: ${error.message}`);
                if (error.code === 'ENOENT') this.showInstallError();
                this.cleanup();
            });

            this.currentFilePath = filePath;
            vscode.window.showInformationMessage(Strings.previewStartingInfo);
            // Prepare the Webview immediately with a loading screen
            this.openWebviewWithLoading();
            // Wait for the local server to become ready, then load it in the webview
            void this.waitForServerReady(this.url, 30, 250)
                .then((ready) => {
                    if (!ready) {
                        this.outputChannel.appendLine('[preview] Server did not become ready in initial window; continuing to poll.');
                        if (this.webviewPanel) this.webviewPanel.title = Strings.previewWaitingTitle;
                        // Continue polling in background until ready
                        this.startContinuousServerPolling();
                        return;
                    }
                    this.outputChannel.appendLine('[preview] Server is ready. Starting proxy and loading in Webview.');
                    void this.startProxyAndLoad();
                })
                .catch((err) => this.outputChannel.appendLine(`[preview] waitForServerReady error: ${err}`));
        } catch (error) {
            this.outputChannel.appendLine(`[preview] Failed to start: ${error}`);
            this.showInstallError();
            this.cleanup();
        }
    }

    /** Create the webview with a loading screen */
    private openWebviewWithLoading(): void {
        if (this.webviewPanel) {
            this.webviewPanel.reveal(vscode.ViewColumn.Beside);
            this.webviewPanel.webview.html = this.getWebviewHtml();
            return;
        }

        this.webviewPanel = vscode.window.createWebviewPanel(
            VIEW_TYPES.preview,
            Strings.previewPanelTitle,
            { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        this.webviewPanel.webview.html = this.getWebviewHtml();
        this.webviewPanel.onDidDispose(() => {
            this.webviewPanel = undefined;
            if (!this.isStopping && this.previewProcess) {
                void this.stopPreview();
            }
            this.stopContinuousServerPolling();
        });
    }

    /** Replace the webview HTML with the live iframe content */
    private updateWebviewContent(url: string): void {
        if (!this.webviewPanel) {
            this.openWebviewWithLoading();
        }
        if (this.webviewPanel) {
            this.webviewPanel.title = Strings.previewPanelTitle;
            this.webviewPanel.webview.html = this.getWebviewHtml();
            // Post message after the DOM is set
            setTimeout(() => this.webviewPanel?.webview.postMessage({ command: 'setSrc', url }), 0);
        }
    }

    /** Stop the preview process */
    public async stopPreview(): Promise<void> {
        if (this.isStopping) return;
        this.isStopping = true;

        if (this.previewProcess?.pid) {
            const pid = this.previewProcess.pid;
            this.outputChannel.appendLine(`[preview] Stopping process ${pid}`);
            await new Promise<void>((resolve) => {
                if (process.platform === 'win32') {
                    cp.exec(`taskkill /pid ${pid} /t /f`, () => resolve());
                } else {
                    this.previewProcess!.once('exit', () => resolve());
                    this.previewProcess!.kill('SIGTERM');
                }
            });
        }

        await this.cleanup();
        this.isStopping = false;
    }

    public isPreviewRunning(): boolean {
        return !!this.previewProcess;
    }

    public getCurrentPreviewFile(): string | undefined {
        return this.currentFilePath;
    }

    private async cleanup(): Promise<void> {
        this.previewProcess = undefined;
        this.currentFilePath = undefined;
        if (this.webviewPanel) {
            try {
                this.webviewPanel.dispose();
            } catch { }
            this.webviewPanel = undefined;
        }
        this.stopContinuousServerPolling();
        await this.stopProxy();
    }

    /** Polls the preview server until it starts or we time out */
    private async waitForServerReady(url: string, tries = 20, delayMs = 300): Promise<boolean> {
        const tryOnce = (): Promise<boolean> =>
            new Promise<boolean>((resolve) => {
                const req = http.get(url, { timeout: delayMs }, (res) => {
                    res.resume();
                    resolve(true);
                });
                req.on('timeout', () => {
                    req.destroy();
                    resolve(false);
                });
                req.on('error', () => resolve(false));
            });

        for (let i = 0; i < tries; i++) {
            const ok = await tryOnce();
            if (ok) return true;
            await new Promise(r => setTimeout(r, delayMs));
        }
        return false;
    }

    private startContinuousServerPolling(): void {
        this.stopContinuousServerPolling();
        this.serverReadyTimer = setInterval(async () => {
            const ready = await this.waitForServerReady(this.url, 1, 200);
            if (ready) {
                this.outputChannel.appendLine('[preview] Server became ready. Updating Webview.');
                await this.startProxyAndLoad();
                this.stopContinuousServerPolling();
            }
        }, 1000);
    }

    private stopContinuousServerPolling(): void {
        if (this.serverReadyTimer) {
            clearInterval(this.serverReadyTimer);
            this.serverReadyTimer = undefined;
        }
    }

    /** Start a tiny HTTP proxy (X-Frame-Options/CSP) */
    private async startProxyAndLoad(): Promise<void> {
        await this.stopProxy();
        const target = new URL(this.url);
        const server = http.createServer((req, res) => {
            if (!req.url) { res.statusCode = 400; return res.end('Bad Request'); }
            const options: http.RequestOptions = {
                protocol: target.protocol,
                hostname: target.hostname,
                port: target.port,
                method: req.method,
                path: req.url,
                headers: { ...req.headers, host: `${target.hostname}:${target.port}` },
            };
            const proxyReq = http.request(options, (proxyRes) => {
                // Copy headers but strip frame-blocking
                const headers: http.IncomingHttpHeaders = { ...proxyRes.headers };
                delete headers['x-frame-options'];
                delete headers['content-security-policy'];
                res.writeHead(proxyRes.statusCode || 200, headers as any);
                proxyRes.pipe(res);
            });
            proxyReq.on('error', (err) => {
                this.outputChannel.appendLine(`[preview-proxy] error: ${err}`);
                if (!res.headersSent) res.writeHead(502);
                res.end('Proxy error');
            });
            req.pipe(proxyReq);
        });

        // Proxy WebSocket/SSE upgrades by forwarding the original request to upstream
        server.on('upgrade', (req, clientSocket, head) => {
            const upstream = net.connect(Number(target.port), target.hostname, () => {
                // Write the original upgrade request to upstream
                const pathWithQuery = req.url || '/';
                upstream.write(`GET ${pathWithQuery} HTTP/1.1\r\n`);
                upstream.write(`Host: ${target.hostname}:${target.port}\r\n`);
                for (const [k, v] of Object.entries(req.headers)) {
                    if (!k || k.toLowerCase() === 'host') continue;
                    upstream.write(`${k}: ${Array.isArray(v) ? v.join(', ') : v}\r\n`);
                }
                upstream.write(`\r\n`);
                if (head && head.length) upstream.write(head);
                // Pipe both ways
                upstream.pipe(clientSocket);
                clientSocket.pipe(upstream);
            });
            upstream.on('error', () => clientSocket.destroy());
        });

        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => resolve());
        });

        const address = server.address();
        if (typeof address === 'object' && address && address.port) {
            this.proxyServer = server;
            this.proxyPort = address.port;
            const proxyUrl = `http://127.0.0.1:${address.port}`;
            this.outputChannel.appendLine(`[preview-proxy] listening at ${proxyUrl}`);
            this.updateWebviewContent(proxyUrl);
        } else {
            server.close();
            throw new Error('Failed to start proxy server');
        }
    }

    private async stopProxy(): Promise<void> {
        if (!this.proxyServer) return;
        await new Promise<void>((resolve) => this.proxyServer!.close(() => resolve()));
        this.proxyServer = undefined;
        this.proxyPort = undefined;
    }

    private showInstallError(): void {
        vscode.window.showErrorMessage(
            Strings.previewInstallErrorTitle,
            Strings.previewInstallGuide
        ).then(selection => {
            if (selection === Strings.previewInstallGuide) {
                void vscode.env.openExternal(vscode.Uri.parse('https://github.com/iamgio/quarkdown'));
            }
        });
    }
}
