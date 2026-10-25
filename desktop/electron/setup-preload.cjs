'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('setup', {
  info: () => ipcRenderer.invoke('setup:info'),
  chooseDir: (current) => ipcRenderer.invoke('setup:choose-dir', current),
  install: (options) => ipcRenderer.invoke('setup:install', options),
  uninstall: (options) => ipcRenderer.invoke('setup:uninstall', options),
  finish: (open) => ipcRenderer.invoke('setup:finish', Boolean(open)),
  runPortable: () => ipcRenderer.invoke('setup:run-portable'),
  minimize: () => ipcRenderer.send('setup:minimize'),
  close: () => ipcRenderer.send('setup:close'),
  onProgress: (callback) => ipcRenderer.on('setup:progress', (_event, payload) => callback(payload)),
});
