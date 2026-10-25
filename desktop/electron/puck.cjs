'use strict';
/**
 * The desktop puck: a small frameless window that floats above every other window, so the timer and the sound can be paused or skipped
 * without opening this app. It never takes keyboard focus, so what you were typing in keeps working. It can be dragged by its grip, remembers
 * where you left it, and what it shows and which buttons it has are chosen in Settings (the page sends them with every update).
 */
const ACTIONS = {
  timer: 'timer.toggle', skip: 'timer.skip', sound: 'sound.toggle', next: 'sound.next', drift: 'timer.drift', reset: 'timer.reset', finish: 'timer.finish',
  volup: 'volume.up', voldown: 'volume.down', zen: 'zen.toggle', app: 'window.show',
};
const MIN_W = 60, MAX_W = 760, MIN_H = 30, MAX_H = 160, SHADOW = 24, MARGIN = 16;

const pick = (v, list, d) => (list.includes(v) ? v : d);
function sanitizeSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    desk: pick(r.desk, ['off', 'away', 'running', 'always'], 'off'), corner: pick(r.corner, ['bl', 'br', 'tl', 'tr'], 'bl'),
    idleHide: r.idleHide !== false, opacity: Number.isFinite(r.opacity) ? Math.max(40, Math.min(100, Math.round(r.opacity))) : 100,
  };
}
function sanitizeState(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    state: r.state && typeof r.state === 'object' ? r.state : {}, settings: r.settings && typeof r.settings === 'object' ? r.settings : {},
    dark: r.dark === true, active: r.active === true,
  };
}
/** Should the floating window be on screen? */
function deskVisible(desk, v) {
  if (desk === 'off') return false;
  if (v.idleHide && !v.active) return false;
  if (desk === 'always') return true;
  if (desk === 'running') return v.active;
  return !v.foreground; // "away": only while another window has your attention
}
function defaultPosition(area, size, corner) {
  const left = corner === 'bl' || corner === 'tl';
  const top = corner === 'tl' || corner === 'tr';
  return {
    x: left ? area.x + MARGIN : area.x + area.width - size.width - MARGIN,
    y: top ? area.y + MARGIN : area.y + area.height - size.height - MARGIN,
  };
}
/** Keeps a saved position on a screen that still exists. Returns null when no screen shows enough of it. */
function clampPosition(pos, size, areas, force = false) {
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !areas.length) return null;
  const overlap = (a) => Math.max(0, Math.min(pos.x + size.width, a.x + a.width) - Math.max(pos.x, a.x)) * Math.max(0, Math.min(pos.y + size.height, a.y + a.height) - Math.max(pos.y, a.y));
  let best = areas[0]; let score = -1;
  for (const a of areas) { const o = overlap(a); if (o > score) { score = o; best = a; } }
  if (score < Math.min(size.width * size.height * 0.5, 1200)) {
    if (!force) return null;
    const cx = pos.x + size.width / 2, cy = pos.y + size.height / 2; let d = Infinity; // dragged off every screen: pull it back to the closest one
    for (const a of areas) { const dx = Math.max(a.x - cx, 0, cx - (a.x + a.width)), dy = Math.max(a.y - cy, 0, cy - (a.y + a.height)); if (dx * dx + dy * dy < d) { d = dx * dx + dy * dy; best = a; } }
  }
  return {
    x: Math.round(Math.max(best.x, Math.min(pos.x, best.x + best.width - size.width))),
    y: Math.round(Math.max(best.y, Math.min(pos.y, best.y + best.height - size.height))),
  };
}

function createPuck({ BrowserWindow, screen, preload, url, store, onAction, isMac = process.platform === 'darwin' }) {
  let win = null; let loaded = false; let last = null; let visible = false; let foreground = false; let size = { width: 320, height: 64 };
  let dragFrom = null;

  const areas = () => { try { return screen.getAllDisplays().map((d) => d.workArea); } catch { return []; } };
  const settings = () => sanitizeSettings(last?.settings);

  function position() {
    const saved = store?.get().puckPos;
    const clamped = saved ? clampPosition(saved, size, areas()) : null;
    if (clamped) return clamped;
    let display; try { display = screen.getPrimaryDisplay(); } catch { display = null; }
    return display ? defaultPosition(display.workArea, size, settings().corner) : { x: 40, y: 40 };
  }
  function ensure() {
    if (win && !win.isDestroyed()) return win;
    loaded = false;
    win = new BrowserWindow({
      width: size.width, height: size.height, show: false, frame: false, transparent: true, resizable: false, movable: false, minimizable: false, maximizable: false,
      fullscreenable: false, skipTaskbar: true, focusable: false, hasShadow: false, alwaysOnTop: true, backgroundColor: '#00000000', title: 'Puck',
      webPreferences: { preload, contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false, devTools: false },
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    if (isMac) { try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch { /* Optional. */ } }
    win.webContents.on('did-finish-load', () => { loaded = true; push(); });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    win.on('closed', () => { win = null; loaded = false; visible = false; });
    void win.loadURL(url);
    return win;
  }
  function push() { if (win && !win.isDestroyed() && loaded && last) win.webContents.send('puck:state', { state: last.state, settings: last.settings, dark: last.dark }); }
  function evaluate() {
    const s = settings();
    const want = deskVisible(s.desk, { foreground, active: !!last?.active, idleHide: s.idleHide });
    if (want) {
      const w = ensure();
      if (!visible) { const p = position(); w.setBounds({ x: p.x, y: p.y, width: size.width, height: size.height }); visible = true; w.showInactive(); }
    } else if (visible && win && !win.isDestroyed()) { visible = false; try { win.hide(); } catch { /* Gone. */ } }
  }

  return {
    update(raw) { last = sanitizeState(raw); push(); evaluate(); },
    setForeground(value) { foreground = !!value; evaluate(); },
    ready() { push(); },
    resize(w, h) {
      if (!Number.isFinite(w) || !Number.isFinite(h)) return;
      size = { width: Math.max(MIN_W, Math.min(MAX_W, Math.round(w) + SHADOW)), height: Math.max(MIN_H, Math.min(MAX_H, Math.round(h) + SHADOW)) };
      if (win && !win.isDestroyed() && visible) {
        const b = win.getBounds(); const p = clampPosition({ x: b.x, y: b.y }, size, areas(), true) ?? { x: b.x, y: b.y };
        win.setBounds({ x: p.x, y: p.y, width: size.width, height: size.height });
      }
    },
    drag(phase, sx, sy) {
      if (!win || win.isDestroyed() || !Number.isFinite(sx) || !Number.isFinite(sy)) return;
      if (phase === 'start') { const b = win.getBounds(); dragFrom = { x: b.x, y: b.y, sx, sy }; return; }
      if (!dragFrom) return;
      const x = Math.round(dragFrom.x + sx - dragFrom.sx); const y = Math.round(dragFrom.y + sy - dragFrom.sy);
      const p = clampPosition({ x, y }, size, areas(), true) ?? { x, y };
      win.setBounds({ x: p.x, y: p.y, width: size.width, height: size.height });
      if (phase === 'end') { dragFrom = null; store?.patch({ puckPos: { x: p.x, y: p.y, displayId: 0 } }); }
    },
    resetPosition() { store?.patch({ puckPos: null }); if (visible && win && !win.isDestroyed()) { const p = position(); win.setBounds({ x: p.x, y: p.y, width: size.width, height: size.height }); } },
    commandFor: (name) => ACTIONS[name] ?? null,
    run(name) { const command = ACTIONS[name]; if (command && onAction) onAction(name, command); },
    last: () => last, isVisible: () => visible, webContentsId: () => (win && !win.isDestroyed() ? win.webContents.id : -1),
    bounds: () => (win && !win.isDestroyed() ? win.getBounds() : null),
    destroy() { if (win && !win.isDestroyed()) win.destroy(); win = null; visible = false; },
  };
}

module.exports = { createPuck, deskVisible, defaultPosition, clampPosition, sanitizeSettings, sanitizeState, ACTIONS, SHADOW };
