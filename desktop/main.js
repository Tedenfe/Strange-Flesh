'use strict';
const {app, BrowserWindow, Menu, ipcMain, dialog, protocol, net} = require('electron');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const fs = require('node:fs');
const {gameRoot, resolveResource, validatedBounds} = require('./paths');
const {mediaReady, importMedia} = require('./media');

protocol.registerSchemesAsPrivileged([{scheme: 'strangeflesh', privileges: {
    standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true
}}]);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
const verifyIndex = process.argv.indexOf('--verify-install');
const verificationReport = verifyIndex >= 0 && process.argv[verifyIndex + 1] && !process.argv[verifyIndex + 1].startsWith('--')
    ? path.resolve(process.argv[verifyIndex + 1]) : null;
if (verificationReport) {
    const verificationData = path.join(path.dirname(verificationReport), 'electron-verification-data');
    fs.mkdirSync(verificationData, {recursive: true});
    app.setPath('userData', verificationData);
}
let mainWindow;
let importing = false;
const source = gameRoot(path.resolve(__dirname, '..'));
const media = path.join(app.getPath('userData'), 'media-v1.4');
const origin = 'strangeflesh://game';
if (!app.requestSingleInstanceLock()) app.quit();
else {
    app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
    app.whenReady().then(async () => {
        Menu.setApplicationMenu(null);
        protocol.handle('strangeflesh', async request => {
            if (!['GET', 'HEAD'].includes(request.method)) return new Response('', {status: 405});
            try {
                return await net.fetch(pathToFileURL(resolveResource(request.url, source, media)).href);
            } catch { return new Response('Resource unavailable', {status: 404}); }
        });
        if (verifyIndex >= 0) {
            for (const file of ['StrangeFlesh.js', 'index.html', 'fonts/NotoSans.ttf', 'fonts/NotoSansCJK-Regular.otf', 'locales/catalogs.js'])
                if (!fs.existsSync(path.join(source, file))) throw new Error('Missing ' + file);
            const index = await net.fetch(origin + '/index.html');
            if (!index.ok || !(await index.text()).includes('StrangeFlesh();')) throw new Error('Game route failed');
            const setup = await net.fetch(origin + '/desktop/setup.html');
            if (!setup.ok || !(await setup.text()).includes('Choose media ZIP')) throw new Error('Setup route failed');
            const privateResource = await net.fetch(origin + '/desktop/main.js');
            if (privateResource.status !== 404) throw new Error('Private route exposed');
            const font = await net.fetch(origin + '/fonts/alagard-unicode/alagard-12px-unicode.ttf');
            if (!font.ok || (await font.arrayBuffer()).byteLength !== 134568) throw new Error('Font route failed');
            const report = {version: app.getVersion(), electron: process.versions.electron, sourceVerified: true,
                gameRouteVerified: true, setupRouteVerified: true, fontRouteVerified: true, privateRouteBlocked: true,
                mediaReady: await mediaReady(media), guiOpened: false};
            if (verificationReport) fs.writeFileSync(verificationReport, JSON.stringify(report, null, 2) + '\n');
            console.log(JSON.stringify(report));
            app.quit();
            return;
        }
        mainWindow = new BrowserWindow({width: 1280, height: 720, minWidth: 640, minHeight: 360,
            backgroundColor: '#000000', title: 'Strange Flesh', autoHideMenuBar: true,
            webPreferences: {preload: path.join(__dirname, 'preload.js'), contextIsolation: true,
                nodeIntegration: false, sandbox: true, additionalArguments: ['--sf-version=' + app.getVersion()]}});
        // Chromium reports custom standard schemes with the expected origin in URLs;
        // compare protocol and host explicitly to avoid Node URL's opaque origin handling.
        const check = event => {
            const url = new URL(event.senderFrame.url);
            if (event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || url.protocol !== 'strangeflesh:' || url.host !== 'game')
                throw new Error('Untrusted caller');
        };
        ipcMain.on('sf:quit', event => { check(event); app.quit(); });
        ipcMain.on('sf:fullscreen', (event, value) => { check(event); if (typeof value === 'boolean') mainWindow.setFullScreen(value); });
        ipcMain.on('sf:bounds', (event, value) => { check(event); try { mainWindow.setBounds(validatedBounds(value)); } catch {} });
        ipcMain.handle('sf:initial-bounds', event => { check(event); return mainWindow.getBounds(); });
        ipcMain.handle('sf:import', async event => {
            check(event);
            if (new URL(event.senderFrame.url).pathname !== '/desktop/setup.html' || importing) return {ok: false};
            importing = true;
            try {
                const chosen = await dialog.showOpenDialog(mainWindow, {title: 'Choose Strange-Flesh-Media-v1.4.zip',
                    properties: ['openFile'], filters: [{name: 'Media ZIP', extensions: ['zip']}]});
                if (chosen.canceled) return {canceled: true};
                await importMedia(chosen.filePaths[0], media, count => { if (count % 40 === 0) mainWindow.webContents.send('sf:progress', count); });
                await mainWindow.loadURL(origin + '/index.html');
                return {ok: true};
            } catch (error) { return {ok: false, error: error.message}; }
            finally { importing = false; }
        });
        mainWindow.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
        mainWindow.webContents.on('will-navigate', (event, target) => {
            const url = new URL(target);
            if (url.protocol !== 'strangeflesh:' || url.host !== 'game') event.preventDefault();
        });
        mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
        mainWindow.webContents.on('did-finish-load', () => mainWindow.webContents.send('sf:bounds-changed', mainWindow.getBounds()));
        for (const event of ['move', 'resize', 'leave-full-screen']) mainWindow.on(event, () => mainWindow.webContents.send('sf:bounds-changed', mainWindow.getBounds()));
        await mainWindow.loadURL(origin + (await mediaReady(media) ? '/index.html' : '/desktop/setup.html'));
    }).catch(error => { console.error(error); app.exit(1); });
    app.on('window-all-closed', () => app.quit());
}
