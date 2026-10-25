'use strict';
const { app, BrowserWindow, Menu, globalShortcut, ipcMain, nativeTheme, net, screen, shell, session, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const common = require('./common.cjs');
const icons = require('./icons.cjs');
const commands = require('./commands.cjs');
const mediaLib = require('./media.cjs');
const { createStore } = require('./settings.cjs');
const { createShortcutManager, readKeyboardRepeat } = require('./shortcuts.cjs');
const { createVoice } = require('./voice.cjs');
const { createActivity } = require('./activity.cjs');
const { createDrift, exportExtension } = require('./drift.cjs');
const { createDiscord } = require('./discord.cjs');
const { createKeys } = require('./keys.cjs');
const { createFlowKey } = require('./flowkey.cjs');
const { createFlowBar } = require('./flowbar.cjs');
const { createPuck } = require('./puck.cjs');
const flowio = require('./flowio.cjs');
const { createTray } = require('./tray.cjs');
const { createUpdater } = require('./updater.cjs');
const { restoreBounds, compactDefault } = require('./placement.cjs');
const monitorsLib = require('./monitors.cjs');

const { APP_NAME, HOST, ORIGIN, PROTOCOL, isWin, isMac } = common;
const TITLEBAR_H = 36;
const COMPACT = { width: 460, height: 104 };
const FULL_DEFAULT = { width: 1180, height: 820 };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.map': 'application/json' };
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:", "font-src 'self' data:", "connect-src 'self' https: http://127.0.0.1:* http://localhost:*", "worker-src 'self' blob:",
  'frame-src https://www.youtube-nocookie.com https://www.youtube.com', "object-src 'none'", "base-uri 'self'", "form-action 'none'",
].join('; ');

let store, win, tray, shortcuts, voice, updater, keys, activity, drift, discord, flowKey, flowBar, puck;
let flowActive = false;
let flowKeyStatus = { status: 'off', message: '', hold: process.platform === 'win32' };
let keysMessage = '';
let rendererReady = false;
let quitting = false;
let queue = [];
let report = { playing: false, mixName: '', timerRunning: false, timerLabel: '', phase: 'focus' };
let shortcutResults = [];
let voiceStatus = { status: 'off' };
let compact = false;
let boundsTimer = null;

const installed = () => app.isPackaged && fs.existsSync(path.join(path.dirname(process.execPath), 'install.json'));
const canAutostart = () => (installed() && isWin) || Boolean(process.windowsStore) || (isMac && app.isPackaged);
const loginArgs = ['--login'];
const getLogin = () => { try { return canAutostart() && app.getLoginItemSettings({ path: process.execPath, args: loginArgs }).openAtLogin; } catch { return false; } };
const setLogin = (open) => { try { app.setLoginItemSettings({ openAtLogin: open, path: process.execPath, args: loginArgs }); } catch { /* Not permitted here. */ } };
const glassActive = () => store.get().glass && (isMac || common.supportsMica());

// ----------------------------------------------------------------------------- state to the page
function snapshot() {
  const s = store.get();
  return {
    compact, pinned: s.alwaysOnTop, maximized: Boolean(win?.isMaximized()), fullscreen: Boolean(win?.isFullScreen()), visible: Boolean(win?.isVisible()),
    globalEnabled: s.globalEnabled, shortcutResults, voice: voiceStatus,
    behavior: {
      closeToTray: s.closeToTray, startHidden: s.startHidden, alwaysOnTop: s.alwaysOnTop, rememberPosition: s.rememberPosition, glass: s.glass, openAtLogin: getLogin(),
      nativeControls: s.nativeControls, appIcon: s.appIcon, mediaKeys: s.mediaKeys, mediaKeysFollow: s.mediaKeysFollow, mediaFollowActive: common.runtime.mediaFollow, pauseKey: s.pauseKey, pauseKeyCommand: s.pauseKeyCommand,
    },
    pauseKeyStatus: keys ? keys.status() : 'off', pauseKeyMessage: keysMessage,
  };
}
const send = (channel, payload) => { if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(channel, payload); };
const pushState = () => { send('swa:state', snapshot()); refreshTray(); };
const trayState = () => ({ ...report, compact, windowVisible: Boolean(win?.isVisible()), globalEnabled: store.get().globalEnabled, alwaysOnTop: store.get().alwaysOnTop, canAutostart: canAutostart(), openAtLogin: getLogin(), updateVersion: updater?.get().status === 'available' ? updater.get().latest : '', updatesOn: updater ? !updater.get().disabled : false });
const refreshTray = () => { try { tray?.update(); } catch { /* Tray is optional. */ } };

// ----------------------------------------------------------------------------- app:// content
function mimeOf(file) { return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'; }
function serveApp(ses) {
  const root = path.join(common.rootDir, 'dist');
  ses.protocol.handle('https', async (request) => {
    let url;
    try { url = new URL(request.url); } catch { return new Response('Bad request', { status: 400 }); }
    if (url.hostname !== HOST) return net.fetch(request, { bypassCustomProtocolHandlers: true });
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.normalize(path.join(root, rel));
    if (file !== root && !file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    try {
      const data = await fs.promises.readFile(file);
      const headers = { 'content-type': mimeOf(file), 'cache-control': 'no-cache' };
      if (file.endsWith('.html')) headers['content-security-policy'] = CSP;
      return new Response(data, { headers });
    } catch { return new Response('Not found', { status: 404 }); }
  });
}

// ----------------------------------------------------------------------------- window
function displayList() { return screen.getAllDisplays().map((d) => ({ id: d.id, workArea: d.workArea })); }
function currentDisplayId() { try { return screen.getDisplayMatching(win.getBounds()).id; } catch { return screen.getPrimaryDisplay().id; } }

function symbolColor(dark) { return dark ? '#f3f3f3' : '#161616'; }
const nativeControls = () => store.get().nativeControls === true;
function applyTheme(dark) {
  nativeTheme.themeSource = dark ? 'dark' : 'light';
  if (isWin && nativeControls() && win && !win.isDestroyed()) { try { win.setTitleBarOverlay({ color: '#00000000', symbolColor: symbolColor(dark), height: compact ? TITLEBAR_H : TITLEBAR_H }); } catch { /* Older Windows. */ } }
}

function createWindow({ show }) {
  const s = store.get();
  compact = s.compact;
  const dark = s.dark;
  const saved = compact ? s.compactBounds : s.bounds;
  const displays = displayList();
  const primaryId = screen.getPrimaryDisplay().id;
  let bounds;
  if (s.rememberPosition || compact) {
    bounds = compact
      ? (saved ? restoreBounds({ ...saved, width: COMPACT.width, height: COMPACT.height }, displays, primaryId, COMPACT) : compactDefault(screen.getPrimaryDisplay(), COMPACT))
      : restoreBounds(saved, displays, primaryId, FULL_DEFAULT);
  } else bounds = restoreBounds(null, displays, primaryId, FULL_DEFAULT);
  if (compact) { bounds.width = Math.max(340, Math.min(900, saved?.width ?? COMPACT.width)); bounds.height = COMPACT.height; }
  const glass = glassActive();
  const options = {
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    minWidth: compact ? 340 : 400, minHeight: compact ? COMPACT.height : 540,
    show: false, title: APP_NAME, autoHideMenuBar: true, backgroundColor: glass ? '#00000000' : (dark ? '#0b0b0b' : '#ffffff'),
    icon: icons.windowIcon(s.appIcon),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false,
      backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required', spellcheck: false, devTools: !app.isPackaged,
    },
  };
  if (isWin) {
    options.titleBarStyle = 'hidden';
    // Own buttons (default) or the system ones drawn over the title strip.
    if (s.nativeControls) options.titleBarOverlay = { color: '#00000000', symbolColor: symbolColor(dark), height: TITLEBAR_H };
    if (glass) options.backgroundMaterial = 'mica';
  } else if (isMac) {
    options.titleBarStyle = 'hiddenInset';
    options.trafficLightPosition = { x: 16, y: 11 };
    if (glass) { options.vibrancy = 'under-window'; options.visualEffectState = 'followWindow'; }
  }
  win = new BrowserWindow(options);
  if (compact) { win.setMaximumSize(900, COMPACT.height); win.setMaximizable(false); }
  if (s.alwaysOnTop) win.setAlwaysOnTop(true, 'floating');
  if (!compact && s.rememberPosition && s.bounds?.maximized) win.maximize();

  win.once('ready-to-show', () => { if (show) { win.show(); } refreshTray(); });
  win.on('close', (event) => {
    if (quitting || !store.get().closeToTray) return;
    event.preventDefault();
    win.hide();
    pushState();
    if (!store.get().trayHintShown) {
      store.patch({ trayHintShown: true });
      try { new Notification({ title: `${APP_NAME} is still running`, body: 'Sound and the timer keep going. Use the tray icon to bring it back or quit.', silent: true, icon: icons.image(store.get().appIcon) }).show(); } catch { /* No notifications. */ }
    }
  });
  for (const name of ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'show', 'hide', 'minimize', 'restore']) win.on(name, () => { saveBoundsSoon(); pushState(); });
  win.on('moved', () => { saveBoundsSoon(); enforceMonitor(); }); win.on('resized', saveBoundsSoon); win.on('move', saveBoundsSoon); win.on('resize', saveBoundsSoon);
  win.on('closed', () => { win = null; rendererReady = false; puck?.setForeground(false); });
  const syncPuck = () => puck?.setForeground(!!win && !win.isDestroyed() && win.isVisible() && !win.isMinimized() && win.isFocused());
  for (const name of ['focus', 'blur', 'show', 'hide', 'minimize', 'restore']) win.on(name, syncPuck);

  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url }) => { if (/^https:\/\//i.test(url)) void shell.openExternal(url); return { action: 'deny' }; });
  wc.on('will-navigate', (event, url) => { if (!url.startsWith(`${ORIGIN}/`) && url !== ORIGIN) { event.preventDefault(); if (/^https:\/\//i.test(url)) void shell.openExternal(url); } });
  wc.on('render-process-gone', () => { rendererReady = false; try { wc.reload(); } catch { /* Window closing. */ } });
  // SWA_CLASSIC=1 opens the 2.0 look (everything on, no session questions): the older UI tests were written for it.
  void win.loadURL(`${ORIGIN}/index.html${process.env.SWA_CLASSIC === '1' ? '?v2defaults' : ''}`);
  return win;
}

function saveBoundsSoon() {
  clearTimeout(boundsTimer);
  boundsTimer = setTimeout(() => {
    if (!win || win.isDestroyed() || win.isMinimized() || win.isFullScreen() || !win.isVisible()) return;
    const maximized = win.isMaximized();
    const b = maximized ? win.getNormalBounds() : win.getBounds();
    const displayId = currentDisplayId();
    if (compact) store.patch({ compactBounds: { x: b.x, y: b.y, width: b.width, displayId } });
    else store.patch({ bounds: { x: b.x, y: b.y, width: b.width, height: b.height, displayId, maximized } });
  }, 400);
}

function showWindow() {
  if (!win) createWindow({ show: true });
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
}
function toggleWindow() { if (win?.isVisible() && !win.isMinimized() && win.isFocused()) win.hide(); else showWindow(); }

function enterCompact() {
  if (compact || !win) return;
  if (win.isFullScreen()) win.setFullScreen(false);
  if (win.isMaximized()) win.unmaximize();
  const b = win.getBounds();
  store.patch({ bounds: { x: b.x, y: b.y, width: b.width, height: b.height, displayId: currentDisplayId(), maximized: false }, compact: true });
  compact = true;
  const saved = store.get().compactBounds;
  const target = saved ? restoreBounds({ ...saved, width: COMPACT.width, height: COMPACT.height }, displayList(), screen.getPrimaryDisplay().id, COMPACT)
    : compactDefault(screen.getDisplayMatching(b), COMPACT);
  win.setMinimumSize(340, COMPACT.height); win.setMaximumSize(900, COMPACT.height); win.setMaximizable(false);
  win.setBounds({ x: target.x, y: target.y, width: Math.max(340, Math.min(900, saved?.width ?? COMPACT.width)), height: COMPACT.height });
  pushState();
}
function exitCompact() {
  if (!compact || !win) return;
  compact = false;
  store.patch({ compact: false });
  win.setMaximumSize(0, 0); win.setMinimumSize(400, 540); win.setMaximizable(true);
  const target = restoreBounds(store.get().bounds, displayList(), screen.getPrimaryDisplay().id, FULL_DEFAULT);
  win.setBounds({ x: target.x, y: target.y, width: target.width, height: target.height });
  if (store.get().bounds?.maximized) win.maximize();
  win.show(); win.focus();
  pushState();
}
// ----------------------------------------------------------------------------- monitors and snapping
function monitorList() {
  const displays = screen.getAllDisplays();
  let currentId; try { currentId = win && !win.isDestroyed() ? screen.getDisplayMatching(win.getBounds()).id : screen.getPrimaryDisplay().id; } catch { currentId = screen.getPrimaryDisplay().id; }
  return monitorsLib.describe(displays, { primaryId: screen.getPrimaryDisplay().id, currentId, names: store.get().monitors.names });
}
/** A screen by its session id, its stable key, or "primary". */
function resolveDisplay(arg) {
  const all = screen.getAllDisplays();
  if (arg === 'primary') return screen.getPrimaryDisplay();
  const byId = all.find((d) => String(d.id) === String(arg));
  if (byId) return byId;
  const m = monitorList().find((x) => x.key === arg);
  return m ? all.find((d) => d.id === m.id) ?? null : null;
}
function pushMonitors() { send('swa:monitors', monitorsPayload()); refreshTray(); }
function rememberMonitors() {
  const cfg = store.get().monitors; let changed = false; const seen = { ...cfg.seen };
  for (const m of monitorList()) { const prev = seen[m.key]; if (!prev || prev.name !== m.name || prev.width !== m.width || prev.height !== m.height) { seen[m.key] = { name: m.name, width: m.width, height: m.height }; changed = true; } }
  if (changed) store.patch({ monitors: monitorsLib.sanitizeConfig({ ...cfg, seen }) });
}
function monitorsPayload() { rememberMonitors(); return { list: monitorList(), config: store.get().monitors, snapLayouts: monitorsLib.LAYOUTS.map((id) => ({ id, label: monitorsLib.LAYOUT_LABELS[id] })) }; }
function moveToDisplay(arg, { show = true } = {}) {
  const display = resolveDisplay(arg);
  if (!display || !win || win.isDestroyed()) return false;
  const wa = display.workArea;
  const b = win.getBounds();
  const wasMax = win.isMaximized() && !compact;
  const width = Math.min(b.width, wa.width), height = Math.min(b.height, wa.height);
  if (win.isFullScreen()) return false;
  if (wasMax) win.unmaximize();
  win.setBounds(compact
    ? compactDefault(display, { width, height })
    : { x: Math.round(wa.x + (wa.width - width) / 2), y: Math.round(wa.y + (wa.height - height) / 2), width, height });
  if (wasMax) win.maximize();
  if (show) showWindow();
  saveBoundsSoon(); pushMonitors();
  return true;
}
/** Window layouts that work with any window buttons (the system snap layouts need the system buttons on Windows 11). */
function snapWindow(layout) {
  if (!win || win.isDestroyed() || compact || win.isFullScreen()) return false;
  const display = screen.getDisplayMatching(win.getBounds());
  const bounds = monitorsLib.snapBounds(display.workArea, layout);
  if (!bounds) return false;
  if (win.isMaximized()) win.unmaximize();
  win.setBounds(bounds);
  // The window has a smallest size. If a quarter or third is smaller than that, keep the window against the edge it was snapped to.
  const got = win.getBounds(); const wa = display.workArea; const fix = { ...got };
  if (/right/.test(layout)) fix.x = wa.x + wa.width - got.width;
  if (/bottom/.test(layout)) fix.y = wa.y + wa.height - got.height;
  if (fix.x !== got.x || fix.y !== got.y) win.setBounds(fix);
  showWindow(); saveBoundsSoon();
  return true;
}
function applyThen(then) {
  if (then === 'zen' || then === 'zen-full') { dispatchToPage({ id: 'zen.open', arg: '' }); if (then === 'zen-full' && win && !win.isDestroyed()) win.setFullScreen(true); }
  else if (then === 'zen-off') { if (win && !win.isDestroyed() && win.isFullScreen()) win.setFullScreen(false); dispatchToPage({ id: 'zen.close', arg: '' }); }
  else if (then === 'compact') enterCompact();
  else if (then === 'expand') exitCompact();
  else if (typeof then === 'string' && then.startsWith('snap:')) snapWindow(then.slice(5));
}
function runMonitorRules(event) {
  const list = monitorList();
  const plan = monitorsLib.planRules(store.get().monitors.rules, event, list);
  for (const step of plan) {
    if (step.target) { if (!win) createWindow({ show: true }); if (win?.isFullScreen()) { win.setFullScreen(false); } moveToDisplay(step.target); }
    if (step.then !== 'none') setTimeout(() => applyThen(step.then), step.target ? 500 : 0);
  }
  return plan.length;
}
const media = mediaLib.createMedia({ selfId: 'com.sarang.studywithsarang' });
let enforceTimer = null;
/** "Keep the app on one monitor": if the window ended up elsewhere and that monitor is connected, bring it back. */
function enforceMonitor() {
  clearTimeout(enforceTimer);
  enforceTimer = setTimeout(() => {
    if (!win || win.isDestroyed() || win.isFullScreen() || win.isMinimized() || !win.isVisible()) return;
    const list = monitorList(); const cur = list.find((m) => m.current);
    const target = monitorsLib.enforceTarget(store.get().monitors.onlyOn, list, cur?.key);
    if (target) moveToDisplay(target, { show: false });
  }, 700);
}
function watchDisplays() {
  const keyOf = (d) => { const m = monitorList().find((x) => x.id === d.id); return m ? m.key : monitorsLib.baseKey(d); };
  screen.on('display-added', (_e, d) => { setTimeout(() => { runMonitorRules({ type: 'connect', key: keyOf(d) }); enforceMonitor(); pushMonitors(); }, 900); });
  screen.on('display-removed', (_e, d) => { const key = monitorsLib.baseKey(d); setTimeout(() => { runMonitorRules({ type: 'disconnect', key }); pushMonitors(); }, 400); });
  screen.on('display-metrics-changed', () => { enforceMonitor(); pushMonitors(); });
}
/** Little labels on every screen for two seconds, so you can tell which is which. */
function identifyMonitors() {
  const list = monitorList(); const all = screen.getAllDisplays();
  list.forEach((m, i) => {
    const d = all.find((x) => x.id === m.id); if (!d) return;
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const html = `<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Segoe UI,system-ui,sans-serif"><div style="background:#0b0b0b;color:#fff;border-radius:22px;padding:18px 30px;text-align:center;border:1px solid #444"><div style="font-size:64px;font-weight:700;line-height:1">${i + 1}</div><div style="font-size:18px;margin-top:6px">${esc(m.name)}</div><div style="font-size:12px;opacity:.65;margin-top:3px">${m.width} x ${m.height}${m.primary ? ' · Windows main display' : ''}</div></div></body></html>`;
    const w = new BrowserWindow({ x: d.workArea.x + Math.round(d.workArea.width / 2 - 190), y: d.workArea.y + Math.round(d.workArea.height / 2 - 100), width: 380, height: 200, show: false, frame: false, transparent: true, focusable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, resizable: false, title: 'Monitor label', webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, devTools: false } });
    w.setIgnoreMouseEvents(true); w.webContents.on('will-navigate', (e) => e.preventDefault());
    void w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).then(() => { if (!w.isDestroyed()) w.showInactive(); });
    setTimeout(() => { try { if (!w.isDestroyed()) w.destroy(); } catch { /* Gone. */ } }, 2600);
  });
}
function setPinned(value) {
  store.patch({ alwaysOnTop: value });
  win?.setAlwaysOnTop(value, 'floating');
  pushState();
}

// ----------------------------------------------------------------------------- commands
function dispatchToPage(command) {
  if (rendererReady && win) send('swa:command', command);
  else { queue.push(command); if (queue.length > 20) queue.shift(); }
}
function run(text, source = 'app') {
  const command = typeof text === 'string' ? commands.parse(text) : text;
  if (!command) return;
  const { id, arg } = command;
  switch (id) {
    case 'window.show': showWindow(); return;
    case 'window.hide': win?.hide(); return;
    case 'window.toggle': toggleWindow(); return;
    case 'window.minimize': win?.minimize(); return;
    case 'window.maximize': if (win && !compact) { if (win.isMaximized()) win.unmaximize(); else win.maximize(); } return;
    case 'window.close': win?.close(); return;
    case 'window.compact': if (arg === 'toggle' && compact) exitCompact(); else enterCompact(); return;
    case 'window.expand': exitCompact(); return;
    case 'window.pin': setPinned(arg === 'on' ? true : arg === 'off' ? false : !store.get().alwaysOnTop); return;
    case 'window.moveto': moveToDisplay(arg); return;
    case 'window.snap': if (monitorsLib.LAYOUTS.includes(arg)) snapWindow(arg); return;
    case 'shortcuts.toggle': setGlobalEnabled(!store.get().globalEnabled); return;
    case 'shortcuts.enable': setGlobalEnabled(true); return;
    case 'shortcuts.disable': setGlobalEnabled(false); return;
    case 'app.login': if (canAutostart()) { setLogin(arg === 'on' ? true : arg === 'off' ? false : !getLogin()); pushState(); } return;
    case 'app.quit': if (source !== 'link') { quitting = true; app.quit(); } return;
    case 'app.update': if (source !== 'link') checkForUpdates(); return;
    case 'media.pause': case 'media.play': case 'media.toggle': case 'media.next': case 'media.prev': case 'media.stop':
      void media.control(id.slice(6)).then((r) => send('swa:command', { id: 'toast', arg: mediaLib.describe(r, id.slice(6)) }));
      return;
    case 'system.volume': {
      const [dir, count] = String(arg).split(':');
      void media.volume(dir, Number(count) || 5).then((r) => { if (r && r.ok === false) send('swa:command', { id: 'toast', arg: r.message || 'System volume is not available.' }); });
      return;
    }
    default: dispatchToPage({ id, arg });
  }
}
function applyAppIcon() {
  const kind = store.get().appIcon;
  try { if (win && !win.isDestroyed()) win.setIcon(icons.windowIcon(kind)); } catch { /* Keep the current icon. */ }
  tray?.setIcon(kind);
  if (isMac) { try { const img = icons.image(kind); if (img) app.dock?.setIcon(img); } catch { /* Keep the dock icon. */ } }
  icons.refreshShortcuts(kind);
}
function syncPauseKey() {
  if (!keys) return;
  const s = store.get();
  if (s.pauseKey && s.globalEnabled) keys.start(); else keys.stop();
  pushState();
}
function setGlobalEnabled(value) {
  store.patch({ globalEnabled: value });
  shortcuts.setEnabled(value);
  syncPauseKey();
  pushState();
  send('swa:command', { id: 'toast', arg: value ? 'Global shortcuts on' : 'Global shortcuts off' });
}

// ----------------------------------------------------------------------------- startup
function start() {
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  const first = commands.fromArgv(process.argv);
  const loginLaunch = process.argv.includes('--login') || process.argv.includes('--hidden');

  app.on('second-instance', (_event, argv) => {
    const found = commands.fromArgv(argv);
    if (found?.command) run(found.command, found.source);
    else if (!found) showWindow();
  });
  app.on('open-url', (event, url) => { event.preventDefault(); const command = commands.fromUrl(url); if (command) run(command, 'link'); });
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => { flowKey?.stop(true); flowBar?.destroy(); puck?.destroy(); shortcuts?.dispose(); voice?.stop(); keys?.stop(); activity?.stop(); drift?.stop(); discord?.stop(); store?.flush(); });
  app.on('window-all-closed', () => { /* The app lives in the tray. */ });
  app.on('activate', () => showWindow());

  void app.whenReady().then(() => boot({ first, loginLaunch }));
}

function startAfterSetup() {
  // "Run without installing": behave like a normal launch inside this same process.
  app.setPath('userData', common.userDataDir());
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  app.on('second-instance', (_e, argv) => { const f = commands.fromArgv(argv); if (f?.command) run(f.command, f.source); else showWindow(); });
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => { flowKey?.stop(true); flowBar?.destroy(); puck?.destroy(); shortcuts?.dispose(); voice?.stop(); keys?.stop(); activity?.stop(); drift?.stop(); discord?.stop(); store?.flush(); });
  boot({ first: null, loginLaunch: false });
}

function boot({ first, loginLaunch }) {
  store = createStore(common.userDataDir());
  nativeTheme.themeSource = store.get().dark ? 'dark' : 'light';
  if (installed() && isWin) { try { app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, []); } catch { /* Links are optional. */ } }
  else if (isMac && app.isPackaged) app.setAsDefaultProtocolClient(PROTOCOL);

  const ses = session.defaultSession;
  serveApp(ses);
  // YouTube refuses embeds that arrive without a Referer (Error 153), and requests served from a custom
  // protocol handler carry none. Identify the app the way YouTube's embed rules ask.
  ses.webRequest.onBeforeSendHeaders({ urls: ['https://*.youtube.com/*', 'https://*.youtube-nocookie.com/*'] }, (details, callback) => {
    const headers = details.requestHeaders;
    if (!headers.Referer && /\/embed\//.test(details.url)) headers.Referer = ORIGIN + '/';
    callback({ requestHeaders: headers });
  });
  // The page may use the microphone (Flow listens only while you hold its key), and nothing else beyond full screen and copying.
  const fromApp = (url) => typeof url === 'string' && url.startsWith(`${ORIGIN}/`);
  const audioOnly = (details) => !details?.mediaTypes || (Array.isArray(details.mediaTypes) && details.mediaTypes.length > 0 && details.mediaTypes.every((type) => type === 'audio'));
  ses.setPermissionRequestHandler((wc, permission, callback, details) => callback(permission === 'fullscreen' || permission === 'clipboard-sanitized-write' || (permission === 'media' && fromApp(details?.requestingUrl) && audioOnly(details) && wc === win?.webContents)));
  ses.setPermissionCheckHandler((wc, permission, origin, details) => permission === 'fullscreen' || permission === 'clipboard-sanitized-write' || (permission === 'media' && (origin === ORIGIN || fromApp(details?.requestingUrl)) && (details?.mediaType ? details.mediaType === 'audio' : true) && wc === win?.webContents));

  shortcuts = createShortcutManager({
    globalShortcut,
    repeat: readKeyboardRepeat(),
    onFire: (command) => run(command, 'shortcut'),
    onResults: (results) => { shortcutResults = results; send('swa:state', snapshot()); },
  });
  shortcuts.setEnabled(store.get().globalEnabled);
  keys = createKeys({
    dir: path.join(common.userDataDir(), 'keys'),
    scriptSource: () => fs.readFileSync(path.join(__dirname, 'keys-listener.ps1'), 'utf8'),
    onKey: () => { const c = store.get().pauseKeyCommand; if (store.get().globalEnabled) run(c, 'shortcut'); },
    onStatus: ({ message }) => { keysMessage = message; send('swa:state', snapshot()); },
  });
  voice = createVoice({
    dir: path.join(common.userDataDir(), 'voice'),
    scriptSource: () => fs.readFileSync(path.join(__dirname, 'voice-listener.ps1'), 'utf8'),
    diagnoseSource: () => fs.readFileSync(path.join(__dirname, 'voice-diagnose.ps1'), 'utf8'),
    onEvent: (event) => {
      if (event.type === 'status') voiceStatus = event;
      send('swa:voice', event);
    },
  });
  activity = createActivity({
    dir: path.join(common.userDataDir(), 'activity'),
    scriptSource: () => fs.readFileSync(path.join(__dirname, 'activity-listener.ps1'), 'utf8'),
    onState: (state) => send('swa:activity', state),
    onStatus: (status) => send('swa:activity-status', status),
  });
  drift = createDrift({
    dir: path.join(common.userDataDir(), 'drift'),
    scriptSource: () => fs.readFileSync(path.join(__dirname, 'drift-listener.ps1'), 'utf8'),
    onSample: (sample) => send('swa:drift-sample', sample),
    onStatus: (status) => send('swa:drift-status', status),
  });
  discord = createDiscord({ onStatus: (status) => send('swa:discord-status', status) });
  flowKey = createFlowKey({
    dir: path.join(common.userDataDir(), 'flowkey'),
    scriptSource: () => fs.readFileSync(path.join(__dirname, 'flowkey-listener.ps1'), 'utf8'),
    globalShortcut,
    onEvent: (type) => { if (type === 'esc' && !flowActive) return; send('swa:flow-key', type); },
    onStatus: (status) => { flowKeyStatus = status; send('swa:flow-status', status); },
  });
  if (store.get().appIcon !== 'default') setTimeout(() => icons.refreshShortcuts(store.get().appIcon), 4000); // pinned shortcuts made before this run
  flowBar = createFlowBar({ BrowserWindow, screen, preload: path.join(__dirname, 'preload-flowbar.cjs'), url: `${ORIGIN}/index.html#flowbar` });
  puck = createPuck({
    BrowserWindow, screen, preload: path.join(__dirname, 'preload-puck.cjs'), url: `${ORIGIN}/index.html#puck`, store,
    onAction: (name, command) => {
      if (name === 'app') { showWindow(); return; }
      if (name === 'zen') showWindow();
      dispatchToPage({ id: command, arg: '' });
    },
  });

  if (isMac) {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
  } else Menu.setApplicationMenu(null);

  setupUpdater();
  registerIpc();
  tray = createTray({ run: (command) => run(command, 'tray'), toggleWindow, getState: trayState, getMonitors: monitorList, snapLayouts: monitorsLib.LAYOUTS.map((id) => ({ id, label: monitorsLib.LAYOUT_LABELS[id] })), icon: store.get().appIcon });
  const wantsWindow = first?.command ? first.command.id.startsWith('window.') : true;
  const hidden = (loginLaunch && store.get().startHidden) || (first?.command && !wantsWindow);
  if (isWin && !store.get().snapMigrated) store.patch({ nativeControls: true, snapMigrated: true }); // 2.0: the system buttons bring the Windows 11 snap layouts back
  createWindow({ show: !hidden });
  watchDisplays();
  enforceMonitor();
  setTimeout(() => runMonitorRules({ type: 'start' }), 1500);
  syncPauseKey();
  if (first?.command) run(first.command, first.source); // Routes window/app commands here and page commands to the renderer once it is ready.
  tray.update();
  updater.schedule();
}

// ----------------------------------------------------------------------------- updates
function toast(body) {
  try {
    if (!Notification.isSupported()) return;
    const note = new Notification({ title: APP_NAME, body, icon: icons.image(store.get().appIcon) });
    note.on('click', () => showWindow());
    note.show();
  } catch { /* Notifications are optional. */ }
}
function setupUpdater() {
  // Development and tests can point the check at a local stand-in for GitHub. Packaged builds never can.
  const test = !app.isPackaged && process.env.SWA_UPDATE_API ? { apiBase: process.env.SWA_UPDATE_API, allow: () => true } : {};
  const pkg = (() => { try { return require('../package.json'); } catch { return {}; } })();
  updater = createUpdater({
    version: app.getVersion(), store, net: test, defaultRepo: pkg.swaUpdate?.repo ?? '', disabled: Boolean(process.windowsStore),
    send: (state) => { send('swa:update', state); refreshTray(); }, notify: toast,
    openExternal: (url) => { if (/^https:\/\/github\.com\//.test(url)) void shell.openExternal(url); },
    installDir: () => (!app.isPackaged && process.env.SWA_UPDATE_FAKE_INSTALL) || (installed() ? path.dirname(process.execPath) : null),
    canSelfUpdate: () => installed() && isWin && !process.windowsStore || Boolean(test.apiBase && process.env.SWA_UPDATE_FAKE_INSTALL),
    quit: () => { quitting = true; app.quit(); },
    spawn: process.env.SWA_UPDATE_SPAWN_LOG && !app.isPackaged
      ? (command, args) => { fs.appendFileSync(process.env.SWA_UPDATE_SPAWN_LOG, `${JSON.stringify([command, args])}\n`); return { unref() {}, on() {} }; }
      : (...args) => require('node:child_process').spawn(...args),
    tmpdir: process.env.SWA_UPDATE_TMP && !app.isPackaged ? process.env.SWA_UPDATE_TMP : require('node:os').tmpdir(),
    firstCheckMs: Number(process.env.SWA_UPDATE_FIRST_MS) > 0 && !app.isPackaged ? Number(process.env.SWA_UPDATE_FIRST_MS) : 25000,
  });
}
async function checkForUpdates() {
  showWindow();
  const state = await updater.check({ manual: true });
  if (state.status === 'uptodate') toast(`You have the latest version (${state.current}).`);
  else if (state.status === 'unconfigured') toast('Set the GitHub repository in Settings, Window and updates, to check for updates.');
  else if (state.status === 'error') toast(`Update check failed: ${state.error}`);
}

// ----------------------------------------------------------------------------- IPC
function trusted(event) {
  try { return event.senderFrame?.url?.startsWith(`${ORIGIN}/`) === true; } catch { return false; }
}
function sanitizeFlowUi(ui) {
  const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, n) : '');
  const oneOf = (v, list, d) => (list.includes(v) ? v : d);
  const confirm = ui.confirm && typeof ui.confirm === 'object' ? { heard: str(ui.confirm.heard, 200), guess: str(ui.confirm.guess, 80), guessLabel: str(ui.confirm.guessLabel, 120), canAsk: ui.confirm.canAsk === true } : null;
  return {
    phase: oneOf(ui.phase, ['idle', 'listening', 'thinking', 'confirm', 'done', 'error'], 'idle'), mode: oneOf(ui.mode, ['hold', 'handsfree'], 'hold'),
    text: str(ui.text, 240), message: str(ui.message, 600), level: Number.isFinite(ui.level) ? Math.max(0, Math.min(1, ui.level)) : 0,
    bars: Array.isArray(ui.bars) ? ui.bars.slice(0, 64).map((x) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0)) : [], confirm,
    style: oneOf(ui.style, ['wave', 'bars', 'orb', 'ring'], 'wave'), place: oneOf(ui.place, ['bottom', 'top', 'center'], 'bottom'), size: oneOf(ui.size, ['small', 'medium', 'large'], 'medium'),
    showText: ui.showText !== false, dark: ui.dark === true, key: str(ui.key, 40), seq: Number.isFinite(ui.seq) ? ui.seq : 0,
  };
}
function registerIpc() {
  ipcMain.handle('swa:get-info', (event) => {
    if (!trusted(event)) return null;
    const exe = installed() ? process.execPath : null;
    return {
      platform: process.platform, version: app.getVersion(), packaged: app.isPackaged, installed: installed(), store: Boolean(process.windowsStore),
      canAutostart: canAutostart(), glass: glassActive(), glassWanted: store.get().glass, glassSupported: isMac || common.supportsMica(),
      titlebar: (!app.isPackaged && process.env.SWA_PREVIEW_TITLEBAR) || (isWin ? (store.get().nativeControls ? 'overlay' : 'custom') : isMac ? 'inset' : 'none'), titlebarHeight: TITLEBAR_H, exePath: exe, protocol: PROTOCOL, noTour: process.env.SWA_NO_TOUR === '1',
      voiceSupported: voice.supported, state: snapshot(),
    };
  });
  ipcMain.on('swa:ready', (event) => {
    if (!trusted(event)) return;
    rendererReady = true;
    const pending = queue; queue = [];
    pushState();
    for (const command of pending) send('swa:command', command);
  });
  ipcMain.on('swa:run', (event, text) => { if (trusted(event) && typeof text === 'string') run(text, 'page'); });
  ipcMain.handle('swa:set-behavior', (event, patch) => {
    if (!trusted(event) || !patch || typeof patch !== 'object') return null;
    const next = {};
    for (const key of ['closeToTray', 'startHidden', 'rememberPosition', 'glass', 'nativeControls', 'mediaKeys', 'mediaKeysFollow', 'pauseKey']) if (typeof patch[key] === 'boolean') next[key] = patch[key];
    if (icons.valid(patch.appIcon)) next.appIcon = patch.appIcon;
    if (typeof patch.pauseKeyCommand === 'string' && commands.parse(patch.pauseKeyCommand)) next.pauseKeyCommand = patch.pauseKeyCommand;
    if (Object.keys(next).length) store.patch(next);
    if (next.appIcon) applyAppIcon();
    if ('pauseKey' in next) syncPauseKey();
    if (typeof patch.alwaysOnTop === 'boolean') setPinned(patch.alwaysOnTop);
    if (typeof patch.openAtLogin === 'boolean' && canAutostart()) setLogin(patch.openAtLogin);
    pushState();
    return snapshot();
  });
  ipcMain.handle('swa:monitors-get', (event) => (trusted(event) ? monitorsPayload() : null));
  ipcMain.handle('swa:monitors-set', (event, config) => {
    if (!trusted(event)) return null;
    store.patch({ monitors: monitorsLib.sanitizeConfig(config) });
    enforceMonitor(); pushMonitors();
    return monitorsPayload();
  });
  ipcMain.on('swa:monitors-identify', (event) => { if (trusted(event)) identifyMonitors(); });
  ipcMain.handle('swa:set-shortcuts', (event, list) => (trusted(event) ? shortcuts.setBindings(list) : []));
  ipcMain.on('swa:theme', (event, dark) => { if (!trusted(event)) return; store.patch({ dark: dark === true }); applyTheme(dark === true); });
  ipcMain.on('swa:report', (event, state) => {
    if (!trusted(event) || !state || typeof state !== 'object') return;
    report = {
      playing: state.playing === true, mixName: String(state.mixName ?? '').slice(0, 60), timerRunning: state.timerRunning === true,
      timerLabel: String(state.timerLabel ?? '').slice(0, 30), phase: state.phase === 'focus' ? 'focus' : 'break',
    };
    refreshTray();
  });
  ipcMain.on('swa:voice-start', (event, config) => { if (trusted(event) && config && typeof config === 'object') voice.start(sanitizeVoiceConfig(config)); });
  ipcMain.on('swa:voice-stop', (event) => { if (trusted(event)) voice.stop(); });
  ipcMain.handle('swa:voice-diagnose', (event) => (trusted(event) ? voice.diagnose() : null));
  ipcMain.on('swa:activity-config', (event, config) => {
    if (!trusted(event) || !config || typeof config !== 'object') return;
    if (config.enabled === true) activity.start(config.recorders); else activity.stop();
  });
  ipcMain.on('swa:drift-config', (event, config) => { if (trusted(event) && config && typeof config === 'object') drift.configure(config); });
  ipcMain.handle('swa:drift-extension', async (event) => {
    if (!trusted(event)) return null;
    try { const folder = exportExtension(path.join(__dirname, '..', 'extension'), path.join(common.userDataDir(), 'browser-helper')); await shell.openPath(folder); return folder; } catch (error) { return null; }
  });
  if (process.env.SWA_TEST === '1') ipcMain.on('swa:drift-test', (event, sample) => { if (trusted(event) && sample && typeof sample === 'object') drift.injectSample(sample); });
  ipcMain.on('swa:discord-update', (event, payload) => {
    if (!trusted(event) || !payload || typeof payload !== 'object') return;
    const config = payload.config && typeof payload.config === 'object' ? { enabled: payload.config.enabled === true, appId: String(payload.config.appId ?? '').slice(0, 24) } : { enabled: false, appId: '' };
    discord.update(config, payload.activity);
  });
  ipcMain.handle('swa:flow-config', (event, config) => {
    if (!trusted(event) || !config || typeof config !== 'object') return null;
    if (config.enabled === true) flowKey.start({ vks: config.vks, accelerator: config.accelerator }); else { flowKey.stop(); flowActive = false; flowBar.update({ phase: 'idle' }); }
    return flowKeyStatus;
  });
  ipcMain.on('swa:flow-ui', (event, ui) => {
    if (!trusted(event) || !ui || typeof ui !== 'object') return;
    flowActive = typeof ui.phase === 'string' && ui.phase !== 'idle';
    flowBar.update(sanitizeFlowUi(ui));
  });
  ipcMain.on('swa:puck-update', (event, payload) => { if (trusted(event)) puck.update(payload); });
  ipcMain.on('swa:puck-reset', (event) => { if (trusted(event)) puck.resetPosition(); });
  const fromPuck = (event) => event.sender.id === puck.webContentsId();
  ipcMain.on('puck:ready', (event) => { if (fromPuck(event)) puck.ready(); });
  ipcMain.on('puck:action', (event, name) => { if (fromPuck(event) && typeof name === 'string') puck.run(name); });
  ipcMain.on('puck:drag', (event, phase, x, y) => { if (fromPuck(event) && ['start', 'move', 'end'].includes(phase)) puck.drag(phase, x, y); });
  ipcMain.on('puck:resize', (event, w, h) => { if (fromPuck(event)) puck.resize(w, h); });
  ipcMain.on('flowbar:ready', (event) => { if (event.sender.id === flowBar.webContentsId()) flowBar.update(flowBar.last?.()); });
  ipcMain.on('flowbar:action', (event, name) => {
    if (event.sender.id !== flowBar.webContentsId() || !['run', 'ask', 'cancel', 'stop'].includes(name)) return;
    send('swa:flow-bar', name);
  });
  ipcMain.handle('swa:net-fetch', (event, request) => { if (!trusted(event)) throw new Error('Not allowed'); return flowio.netFetch((url, init) => net.fetch(url, { ...init, bypassCustomProtocolHandlers: true }), request); });
  ipcMain.handle('swa:sound-read', (event, slot) => (trusted(event) ? flowio.readSound(common.userDataDir(), slot) : null));
  ipcMain.handle('swa:sound-list', (event) => (trusted(event) ? flowio.listSounds(common.userDataDir()) : []));
  ipcMain.handle('swa:sound-folder', async (event) => { if (!trusted(event)) return ''; const dir = flowio.ensureSoundsDir(common.userDataDir()); await shell.openPath(dir); return dir; });
  ipcMain.handle('swa:integration-status', (event) => (trusted(event) ? { activity: { supported: activity.supported, status: activity.status() }, drift: { supported: drift.supported, ...drift.status() }, discord: { status: discord.status() } } : null));
  ipcMain.on('swa:popup-menu', (event) => { if (trusted(event) && win && !win.isDestroyed()) tray?.popup(win); });
  ipcMain.handle('swa:update-get', (event) => (trusted(event) ? updater.get() : null));
  ipcMain.handle('swa:update-check', (event) => (trusted(event) ? updater.check({ manual: true }) : null));
  ipcMain.handle('swa:update-install', (event) => (trusted(event) ? updater.install() : null));
  ipcMain.handle('swa:update-skip', (event) => (trusted(event) ? updater.skip() : null));
  ipcMain.handle('swa:update-dismiss', (event) => (trusted(event) ? updater.dismiss() : null));
  ipcMain.handle('swa:update-config', (event, config) => (trusted(event) ? updater.setConfig(config) : null));
  // System notifications. The page decides when (not in front, not in quiet hours); this only shows them and reports what happened.
  const osNote = (title, body, wait) => new Promise((resolve) => {
    const result = { supported: false, shown: false, error: '', appId: common.APP_ID, shortcut: null, flashed: false };
    try { result.supported = Notification.isSupported(); } catch { /* Unknown. */ }
    try { if (isWin) result.shortcut = fs.existsSync(path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${APP_NAME}.lnk`)); } catch { /* Unknown. */ }
    try { if (win && !win.isDestroyed() && (!win.isFocused() || !win.isVisible() || win.isMinimized())) { win.flashFrame(true); result.flashed = true; } } catch { /* Optional. */ }
    if (!result.supported) { result.error = 'This system does not offer notifications to the app.'; resolve(result); return; }
    let done = false; const finish = () => { if (!done) { done = true; resolve(result); } };
    try {
      const note = new Notification({ title: String(title).slice(0, 120), body: String(body).slice(0, 300), icon: icons.image(store.get().appIcon), silent: true });
      note.on('click', () => showWindow());
      note.on('show', () => { result.shown = true; finish(); });
      note.on('failed', (_e, err) => { result.error = String(err || 'failed').slice(0, 160); finish(); });
      note.show();
      if (!wait) { result.shown = true; finish(); } else setTimeout(finish, 2500);
    } catch (error) { result.error = String(error && error.message || error).slice(0, 160); finish(); }
  });
  ipcMain.on('swa:notify', (event, title, body) => {
    if (!trusted(event) || typeof title !== 'string' || typeof body !== 'string') return;
    void osNote(title, body, false);
  });
  ipcMain.handle('swa:media', async (event, action) => {
    if (!trusted(event) || typeof action !== 'string' || !mediaLib.ACTIONS.has(action)) return null;
    const result = await media.control(action);
    return { result, text: mediaLib.describe(result, action) };
  });
  ipcMain.handle('swa:notify-test', (event, title, body) => (trusted(event) && typeof title === 'string' && typeof body === 'string' ? osNote(title, body, true) : null));
  ipcMain.on('swa:relaunch', (event) => { if (!trusted(event)) return; quitting = true; app.relaunch(); app.quit(); });
}

const phraseList = (value) => (Array.isArray(value) ? value : []).map((item) => String(item).replace(/[^\p{L}\p{N} '\-]/gu, ' ').replace(/\s+/g, ' ').trim()).filter((item) => item && item.length <= 60).slice(0, 800);
function sanitizeVoiceConfig(raw) {
  const p = raw.phrases && typeof raw.phrases === 'object' ? raw.phrases : {};
  const w = raw.wake && typeof raw.wake === 'object' ? raw.wake : {};
  return {
    languages: (Array.isArray(raw.languages) ? raw.languages : ['en', 'de']).map(String).filter((l) => /^[a-z]{2}$/.test(l)).slice(0, 4),
    phrases: { en: phraseList(p.en), de: phraseList(p.de) },
    wake: { en: phraseList([w.en])[0] ?? 'Flow', de: phraseList([w.de])[0] ?? 'Flow' },
    wakes: phraseList(Array.isArray(raw.wakes) ? raw.wakes : []).slice(0, 4),
    useWake: raw.useWake !== false,
    dictation: raw.dictation === true,
  };
}

module.exports = { start, startAfterSetup, run, sanitizeVoiceConfig };
