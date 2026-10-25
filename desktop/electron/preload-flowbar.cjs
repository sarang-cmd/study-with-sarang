'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// The bar can only show what it is given and report three button presses. It cannot reach anything else.
contextBridge.exposeInMainWorld('flowbar', {
  onUi: (callback) => {
    const handler = (_event, ui) => callback(ui);
    ipcRenderer.on('flowbar:ui', handler);
    ipcRenderer.send('flowbar:ready');
    return () => ipcRenderer.removeListener('flowbar:ui', handler);
  },
  action: (name) => ipcRenderer.send('flowbar:action', String(name)),
});
