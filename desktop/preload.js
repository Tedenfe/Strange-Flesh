'use strict';
const {contextBridge, ipcRenderer} = require('electron');
let bounds = {x: 0, y: 0, width: 1280, height: 720};
ipcRenderer.on('sf:bounds-changed', (_event, value) => { bounds = value; });
ipcRenderer.invoke('sf:initial-bounds').then(value => { bounds = value; }).catch(() => {});
contextBridge.exposeInMainWorld('strangeFleshDesktop', {
    version: (process.argv.find(arg => arg.startsWith('--sf-version=')) || '').slice(13),
    quit: () => ipcRenderer.send('sf:quit'),
    getWindowBounds: () => ({...bounds}),
    setFullscreen: value => ipcRenderer.send('sf:fullscreen', value),
    setWindowBounds: value => ipcRenderer.send('sf:bounds', value),
    importMedia: () => ipcRenderer.invoke('sf:import'),
    onImportProgress: callback => { ipcRenderer.on('sf:progress', (_event, count) => callback(count)); }
});
