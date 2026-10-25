'use strict';
/**
 * The small Flow bar: a frameless, see-through, always-on-top window that never takes keyboard focus, so what you were typing in
 * keeps working. It shows only while Flow is listening, thinking or answering, and sits on the screen where your pointer is.
 */
const WIDTH = 560;
const HEIGHT = 250;
const SHOW_DELAY = 140; // A quick Ctrl+C style tap should not flash a bar

function createFlowBar({ BrowserWindow, screen, preload, url, isMac = process.platform === 'darwin', setTimer = setTimeout, clearTimer = clearTimeout }) {
  let win = null;
  let loaded = false;
  let last = null;
  let showTimer = null;
  let hideTimer = null;
  let visible = false;

  function ensure() {
    if (win && !win.isDestroyed()) return win;
    loaded = false;
    win = new BrowserWindow({
      width: WIDTH, height: HEIGHT, show: false, frame: false, transparent: true, resizable: false, movable: false, minimizable: false, maximizable: false,
      fullscreenable: false, skipTaskbar: true, focusable: false, hasShadow: false, alwaysOnTop: true, backgroundColor: '#00000000', title: 'Flow',
      webPreferences: { preload, contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false, devTools: false },
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    if (isMac) { try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch { /* Optional. */ } }
    win.setIgnoreMouseEvents(true);
    win.webContents.on('did-finish-load', () => { loaded = true; if (last) push(); });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    win.on('closed', () => { win = null; loaded = false; visible = false; });
    void win.loadURL(url);
    return win;
  }

  function place(ui) {
    const w = ensure();
    let display;
    try { display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()); } catch { display = screen.getPrimaryDisplay(); }
    const area = display.workArea;
    const x = Math.round(area.x + (area.width - WIDTH) / 2);
    const y = ui.place === 'top' ? area.y + 28 : ui.place === 'center' ? Math.round(area.y + (area.height - HEIGHT) / 2) : area.y + area.height - HEIGHT - 20;
    w.setBounds({ x, y, width: WIDTH, height: HEIGHT });
  }

  function push() { if (win && !win.isDestroyed() && loaded && last) win.webContents.send('flowbar:ui', last); }

  function reveal() {
    const w = ensure();
    place(last);
    if (!visible) { visible = true; w.showInactive(); }
  }
  function conceal() {
    if (!win || win.isDestroyed()) return;
    visible = false;
    try { win.hide(); } catch { /* Gone. */ }
  }

  return {
    update(ui) {
      last = ui;
      if (!ui || ui.phase === 'idle') {
        if (showTimer) { clearTimer(showTimer); showTimer = null; }
        push();
        if (visible && !hideTimer) hideTimer = setTimer(() => { hideTimer = null; if (last?.phase === 'idle') conceal(); }, 260);
        return;
      }
      if (hideTimer) { clearTimer(hideTimer); hideTimer = null; }
      ensure();
      push();
      const interactive = ui.phase === 'confirm' || (ui.phase === 'listening' && ui.mode === 'handsfree') || ui.phase === 'done' || ui.phase === 'error';
      try { if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!interactive, { forward: true }); } catch { /* Gone. */ }
      if (visible) { place(ui); return; }
      if (ui.phase === 'listening') { if (!showTimer) showTimer = setTimer(() => { showTimer = null; if (last && last.phase !== 'idle') reveal(); }, SHOW_DELAY); return; }
      reveal();
    },
    last: () => last,
    isVisible: () => visible,
    webContentsId: () => (win && !win.isDestroyed() ? win.webContents.id : -1),
    destroy() { if (showTimer) clearTimer(showTimer); if (hideTimer) clearTimer(hideTimer); if (win && !win.isDestroyed()) win.destroy(); win = null; },
  };
}

module.exports = { createFlowBar, WIDTH, HEIGHT, SHOW_DELAY };
