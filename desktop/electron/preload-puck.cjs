'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// The puck window can show what it is given and report button presses, drags and its own size. It cannot reach anything else.
contextBridge.exposeInMainWorld('puck', {
  onState: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('puck:state', handler);
    ipcRenderer.send('puck:ready');
    return () => ipcRenderer.removeListener('puck:state', handler);
  },
  action: (name) => ipcRenderer.send('puck:action', String(name)),
  drag: (phase, x, y) => ipcRenderer.send('puck:drag', String(phase), Number(x), Number(y)),
  resize: (w, h) => ipcRenderer.send('puck:resize', Number(w), Number(h)),
});
