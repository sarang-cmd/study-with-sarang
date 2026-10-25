'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel, callback) => {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

// The only door between the page and the system. Everything is a plain message that the main
// process validates again; the page never gets Node, files or the shell.
contextBridge.exposeInMainWorld('desktop', {
  getInfo: () => ipcRenderer.invoke('swa:get-info'),
  ready: () => ipcRenderer.send('swa:ready'),
  onCommand: (callback) => on('swa:command', callback),
  onState: (callback) => on('swa:state', callback),
  onVoice: (callback) => on('swa:voice', callback),
  command: (command) => ipcRenderer.send('swa:run', String(command)),
  setBehavior: (patch) => ipcRenderer.invoke('swa:set-behavior', patch),
  notify: (title, body) => ipcRenderer.send('swa:notify', String(title).slice(0, 120), String(body).slice(0, 300)),
  media: (action) => ipcRenderer.invoke('swa:media', String(action).slice(0, 20)),
  notifyTest: (title, body) => ipcRenderer.invoke('swa:notify-test', String(title).slice(0, 120), String(body).slice(0, 300)),
  setShortcuts: (list) => ipcRenderer.invoke('swa:set-shortcuts', list),
  setTheme: (dark) => ipcRenderer.send('swa:theme', dark === true),
  report: (state) => ipcRenderer.send('swa:report', state),
  voiceStart: (config) => ipcRenderer.send('swa:voice-start', config),
  voiceStop: () => ipcRenderer.send('swa:voice-stop'),
  voiceDiagnose: () => ipcRenderer.invoke('swa:voice-diagnose'),
  onActivity: (callback) => on('swa:activity', callback),
  onActivityStatus: (callback) => on('swa:activity-status', callback),
  onDriftSample: (callback) => on('swa:drift-sample', callback),
  onDriftStatus: (callback) => on('swa:drift-status', callback),
  driftConfig: (config) => ipcRenderer.send('swa:drift-config', config),
  driftExtension: () => ipcRenderer.invoke('swa:drift-extension'),
  driftTest: (sample) => ipcRenderer.send('swa:drift-test', sample),
  activityConfig: (config) => ipcRenderer.send('swa:activity-config', config),
  discordUpdate: (payload) => ipcRenderer.send('swa:discord-update', payload),
  onDiscordStatus: (callback) => on('swa:discord-status', callback),
  integrationStatus: () => ipcRenderer.invoke('swa:integration-status'),
  readSound: async (slot) => {
    const r = await ipcRenderer.invoke('swa:sound-read', String(slot));
    if (!r) return null;
    const u = r.bytes; // A Uint8Array from the main process; the page wants a plain ArrayBuffer.
    return { name: r.name, bytes: u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) };
  },
  listSounds: () => ipcRenderer.invoke('swa:sound-list'),
  openSoundsFolder: () => ipcRenderer.invoke('swa:sound-folder'),
  flowConfigure: (config) => ipcRenderer.invoke('swa:flow-config', config),
  onFlowKey: (callback) => on('swa:flow-key', callback),
  onFlowStatus: (callback) => on('swa:flow-status', callback),
  flowUi: (ui) => ipcRenderer.send('swa:flow-ui', ui),
  monitorsGet: () => ipcRenderer.invoke('swa:monitors-get'),
  monitorsSet: (config) => ipcRenderer.invoke('swa:monitors-set', config),
  monitorsIdentify: () => ipcRenderer.send('swa:monitors-identify'),
  onMonitors: (callback) => on('swa:monitors', callback),
  puckUpdate: (payload) => ipcRenderer.send('swa:puck-update', payload),
  puckResetPosition: () => ipcRenderer.send('swa:puck-reset'),
  onFlowBar: (callback) => on('swa:flow-bar', callback),
  netFetch: async (request) => {
    const r = await ipcRenderer.invoke('swa:net-fetch', request);
    const u = r.body;
    return { status: r.status, headers: r.headers, body: u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) };
  },
  popupMenu: () => ipcRenderer.send('swa:popup-menu'),
  relaunch: () => ipcRenderer.send('swa:relaunch'),
  update: {
    get: () => ipcRenderer.invoke('swa:update-get'),
    check: () => ipcRenderer.invoke('swa:update-check'),
    install: () => ipcRenderer.invoke('swa:update-install'),
    skip: () => ipcRenderer.invoke('swa:update-skip'),
    dismiss: () => ipcRenderer.invoke('swa:update-dismiss'),
    setConfig: (config) => ipcRenderer.invoke('swa:update-config', config),
    onState: (callback) => on('swa:update', callback),
  },
});
