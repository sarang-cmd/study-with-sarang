'use strict';
const { pick: pickIcon } = require('./icon-ids.cjs');
const fs = require('node:fs');
const path = require('node:path');

const defaults = {
  closeToTray: true,
  startHidden: false,
  alwaysOnTop: false,
  rememberPosition: true,
  globalEnabled: true,
  glass: true,
  trayHintShown: false,
  compact: false,
  dark: false,
  puckPos: null,       // { x, y } of the floating puck
  bounds: null,        // { x, y, width, height, displayId, maximized }
  compactBounds: null, // { x, y, displayId }
  updateRepo: '',      // "owner/repository" on GitHub; empty uses the one built into the app
  updateAuto: true,    // check for updates in the background
  updateSkip: '',      // a version the user chose to skip
  nativeControls: true, // Windows: the system minimize/maximize/close buttons (they bring the Windows 11 snap layouts); false draws the app's own
  snapMigrated: false,  // 2.0: people on the old default were moved once to the system buttons so snapping works
  monitors: { names: {}, seen: {}, onlyOn: '', rules: [] }, // nicknames, "keep on this monitor" and the monitor rules
  appIcon: 'default',  // one of icon-ids.cjs
  mediaKeys: true,     // Play/Pause, Next and Stop media keys control sound
  mediaKeysFollow: true, // Media keys go to whatever played most recently (like a browser) instead of always to this app. Needs a restart.
  pauseKey: true,      // Windows: the Pause/Break key runs pauseKeyCommand
  pauseKeyCommand: 'sound.toggle',
};

const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
function rect(raw, withSize) {
  if (!raw || typeof raw !== 'object') return null;
  const x = num(raw.x), y = num(raw.y);
  if (x === null || y === null) return null;
  const out = { x, y, displayId: num(raw.displayId) ?? 0 };
  if (withSize) {
    const width = num(raw.width), height = num(raw.height);
    if (!width || !height || width < 200 || height < 100 || width > 10000 || height > 10000) return null;
    out.width = width; out.height = height; out.maximized = raw.maximized === true;
  }
  return out;
}

const { sanitizeConfig: sanitizeMonitors } = require('./monitors.cjs');
function sanitize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    closeToTray: bool(r.closeToTray, defaults.closeToTray),
    startHidden: bool(r.startHidden, defaults.startHidden),
    alwaysOnTop: bool(r.alwaysOnTop, defaults.alwaysOnTop),
    rememberPosition: bool(r.rememberPosition, defaults.rememberPosition),
    globalEnabled: bool(r.globalEnabled, defaults.globalEnabled),
    glass: bool(r.glass, defaults.glass),
    trayHintShown: bool(r.trayHintShown, defaults.trayHintShown),
    compact: bool(r.compact, defaults.compact),
    dark: bool(r.dark, defaults.dark),
    puckPos: rect(r.puckPos, false),
    bounds: rect(r.bounds, true),
    compactBounds: rect(r.compactBounds, false),
    updateRepo: typeof r.updateRepo === 'string' && r.updateRepo.length <= 140 ? r.updateRepo : '',
    updateAuto: bool(r.updateAuto, defaults.updateAuto),
    updateSkip: typeof r.updateSkip === 'string' && r.updateSkip.length <= 20 ? r.updateSkip : '',
    nativeControls: bool(r.nativeControls, defaults.nativeControls),
    snapMigrated: bool(r.snapMigrated, false),
    monitors: sanitizeMonitors(r.monitors),
    appIcon: pickIcon(r.appIcon),
    mediaKeys: bool(r.mediaKeys, defaults.mediaKeys),
    mediaKeysFollow: bool(r.mediaKeysFollow, defaults.mediaKeysFollow),
    pauseKey: bool(r.pauseKey, defaults.pauseKey),
    pauseKeyCommand: typeof r.pauseKeyCommand === 'string' && /^[a-z.]+(:.{0,100})?$/.test(r.pauseKeyCommand) ? r.pauseKeyCommand : defaults.pauseKeyCommand,
  };
}

/** Small JSON store with atomic, debounced writes. */
function createStore(dir) {
  const file = path.join(dir, 'settings.json');
  let data;
  try { data = sanitize(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { data = sanitize({}); }
  let timer = null;
  const flush = () => {
    clearTimeout(timer); timer = null;
    try {
      fs.mkdirSync(dir, { recursive: true });
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, file);
    } catch { /* Settings stay in memory for this run. */ }
  };
  return {
    file,
    get: () => data,
    patch(partial) { data = sanitize({ ...data, ...partial }); clearTimeout(timer); timer = setTimeout(flush, 350); return data; },
    flush,
  };
}

module.exports = { createStore, sanitize, defaults };
