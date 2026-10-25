'use strict';
/**
 * The animated setup and uninstall window. The same executable is the app, the installer and the
 * uninstaller (see mode.cjs). Installs for the current user only, so no admin prompt is needed.
 */
const { app, BrowserWindow, dialog, ipcMain, shell, nativeTheme } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const common = require('./common.cjs');
const core = require('./installer-core.cjs');

const { APP_NAME, APP_ID, PROTOCOL } = common;
const UNINSTALL_KEY = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_ID}`;
const PROTOCOL_KEY = `HKCU\\Software\\Classes\\${PROTOCOL}`;
const DRY = process.env.SWA_SETUP_DRY === '1'; // Tests: skip anything that touches Windows itself.
const exeFile = path.basename(process.execPath);
const sourceDir = () => process.env.SWA_SETUP_SOURCE || path.dirname(process.execPath);
const programsDir = () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs');
const defaultDir = () => process.env.SWA_INSTALL_DIR || path.join(programsDir(), APP_NAME);
const startMenuLink = () => path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${APP_NAME}.lnk`);
const desktopLink = () => path.join(app.getPath('desktop'), `${APP_NAME}.lnk`);
// "--update --update-dir=<folder>": started by the installed app after it downloaded a newer setup.
const updateArg = () => { const raw = process.argv.find((item) => item.startsWith('--update-dir=')); return raw ? raw.slice('--update-dir='.length) : ''; };
const updateTarget = () => {
  if (!process.argv.includes('--update')) return null;
  const dir = updateArg();
  return dir && path.isAbsolute(dir) && readInstalled(dir) ? path.resolve(dir) : null;
};
const q = (value) => String(value).replace(/'/g, "''");

function reg(args) {
  return new Promise((resolve) => execFile('reg.exe', args, { windowsHide: true }, (error) => resolve(!error)));
}

function readInstalled(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, core.MARKER), 'utf8')); } catch { return null; }
}

/** Real Windows operations. In dry runs they do nothing, so the flow can be exercised on any OS. */
function makeOps({ mode }) {
  if (DRY) return { exeName: exeFile, async scheduleDelete(targets) { for (const t of targets) await core.removeDir(t); } };
  const isWin = process.platform === 'win32';
  return {
    exeName: exeFile,
    async stopRunning(where) {
      if (!isWin) return;
      // Ask nicely first. The installed app understands this command line.
      const exe = where;
      if (fs.existsSync(exe)) { try { spawn(exe, ['--cmd=app.quit'], { detached: true, stdio: 'ignore', windowsHide: true }).unref(); } catch { /* ignore */ } }
      await new Promise((r) => setTimeout(r, 1400));
      // Then end only processes that run from that exact file. This setup's own processes (same file when
      // uninstalling) are excluded by id, by parent and by their scratch profile folder.
      const script = `$p='${q(exe)}'; $me=${process.pid}; Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $p -and $_.ProcessId -ne $me -and $_.ParentProcessId -ne $me -and "$($_.CommandLine)" -notmatch 'study-with-sarang-(setup|uninstall)-' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
      await new Promise((resolve) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script], { windowsHide: true, timeout: 10000 }, () => resolve()));
      await new Promise((r) => setTimeout(r, 400));
    },
    async createShortcuts({ exe, target, options }) {
      if (!isWin) return;
      const base = { target: exe, cwd: target, icon: exe, iconIndex: 0, appUserModelId: APP_ID, description: 'Ambient sound, focus timer and a calm place to study' };
      if (options.startMenu) { fs.mkdirSync(path.dirname(startMenuLink()), { recursive: true }); shell.writeShortcutLink(startMenuLink(), 'create', base); }
      else fs.rmSync(startMenuLink(), { force: true });
      if (options.desktop) shell.writeShortcutLink(desktopLink(), 'create', base);
      else fs.rmSync(desktopLink(), { force: true });
    },
    async register({ exe, target, version, bytes }) {
      if (!isWin) return;
      const set = (key, name, type, data) => reg(['add', key, '/v', name, '/t', type, '/d', String(data), '/f']);
      await set(UNINSTALL_KEY, 'DisplayName', 'REG_SZ', APP_NAME);
      await set(UNINSTALL_KEY, 'DisplayVersion', 'REG_SZ', version);
      await set(UNINSTALL_KEY, 'Publisher', 'REG_SZ', 'Sarang');
      await set(UNINSTALL_KEY, 'DisplayIcon', 'REG_SZ', exe);
      await set(UNINSTALL_KEY, 'InstallLocation', 'REG_SZ', target);
      await set(UNINSTALL_KEY, 'UninstallString', 'REG_SZ', `"${exe}" --uninstall`);
      await set(UNINSTALL_KEY, 'QuietUninstallString', 'REG_SZ', `"${exe}" --uninstall`);
      await set(UNINSTALL_KEY, 'EstimatedSize', 'REG_DWORD', Math.round(bytes / 1024));
      await set(UNINSTALL_KEY, 'NoModify', 'REG_DWORD', 1);
      await set(UNINSTALL_KEY, 'NoRepair', 'REG_DWORD', 1);
      // study-with-sarang://cmd/... links, used by Stream Deck "Website" buttons and browsers.
      await set(PROTOCOL_KEY, '', 'REG_SZ', `URL:${APP_NAME}`);
      await set(PROTOCOL_KEY, 'URL Protocol', 'REG_SZ', '');
      await set(`${PROTOCOL_KEY}\\DefaultIcon`, '', 'REG_SZ', `"${exe}",0`);
      await set(`${PROTOCOL_KEY}\\shell\\open\\command`, '', 'REG_SZ', `"${exe}" "%1"`);
    },
    async applyOptions({ exe, options }) {
      if (updateTarget()) return; // Updating keeps the choices already made in the app.
      // Same file the app reads, so "start hidden" and "open at sign-in" are already set on first run.
      const dir = common.userDataDir(); fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, 'settings.json'); let settings = {};
      try { settings = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first install */ }
      settings.startHidden = Boolean(options.startHidden);
      fs.writeFileSync(file, JSON.stringify(settings, null, 2));
      app.setLoginItemSettings({ openAtLogin: Boolean(options.autostart), path: exe, args: ['--login'] });
    },
    async removeShortcuts() { fs.rmSync(startMenuLink(), { force: true }); fs.rmSync(desktopLink(), { force: true }); },
    async unregister() { if (!isWin) return; await reg(['delete', UNINSTALL_KEY, '/f']); await reg(['delete', PROTOCOL_KEY, '/f']); },
    async removeLogin() { try { app.setLoginItemSettings({ openAtLogin: false, path: path.join(process.env.SWA_UNINSTALL_DIR || path.dirname(process.execPath), exeFile), args: ['--login'] }); } catch { /* ignore */ } },
    async scheduleDelete(targets) {
      if (!isWin) { for (const t of targets) await core.removeDir(t); return; }
      // This process runs from the folder being removed, so a detached helper deletes it after we exit.
      const parts = targets.map((t) => `rmdir /s /q "${t}"`).join(' & ');
      spawn('cmd.exe', ['/d', '/s', '/c', `"ping 127.0.0.1 -n 4 >nul & ${parts}"`], { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true }).unref();
    },
  };
}

function run(mode, startApp) {
  let win = null; let installedExe = null; let continuing = false;
  const ops = makeOps({ mode });
  const uninstallDir = process.env.SWA_UNINSTALL_DIR || path.dirname(process.execPath);

  app.on('window-all-closed', () => { if (!continuing) app.quit(); });
  nativeTheme.themeSource = 'dark';

  function send(payload) { if (win && !win.isDestroyed()) win.webContents.send('setup:progress', payload); }

  ipcMain.handle('setup:info', () => {
    const update = updateTarget(); const dir = update || defaultDir(); const existing = readInstalled(dir);
    return { mode, update: Boolean(update), version: app.getVersion(), dir, existing: existing?.version || null, platform: process.platform, canRunOnce: !process.env.SWA_SETUP_SOURCE };
  });
  ipcMain.handle('setup:choose-dir', async (_e, current) => {
    const result = await dialog.showOpenDialog(win, { title: 'Choose where to install', defaultPath: typeof current === 'string' ? current : undefined, properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    // A parent folder was chosen, so put the app in its own folder inside it.
    const picked = result.filePaths[0];
    return path.basename(picked) === APP_NAME ? picked : path.join(picked, APP_NAME);
  });
  ipcMain.handle('setup:install', async (_e, raw) => {
    const update = updateTarget();
    if (update) installedExe = path.join(update, exeFile);
    const options = update ? updateOptions(update) : { desktop: Boolean(raw?.desktop), startMenu: Boolean(raw?.startMenu), autostart: Boolean(raw?.autostart), startHidden: Boolean(raw?.startHidden), launch: Boolean(raw?.launch) };
    try {
      const result = await core.install({ source: sourceDir(), dest: update || (typeof raw?.dir === 'string' ? raw.dir : defaultDir()), appName: APP_NAME, version: app.getVersion(), options: { ...options, allowMissingExe: DRY }, ops, onProgress: send, minDurationMs: Number(process.env.SWA_SETUP_MIN_MS ?? 3200) });
      installedExe = result.exe;
      // Nothing opens by itself: the app starts only when the person presses the button on the last page.
      return { ok: true, exe: result.exe };
    } catch (error) {
      return { ok: false, error: friendly(error) };
    }
  });
  ipcMain.handle('setup:uninstall', async (_e, raw) => {
    try {
      await core.uninstall({ dir: uninstallDir, appName: APP_NAME, deleteData: Boolean(raw?.deleteData), dataDir: common.userDataDir(), ops, onProgress: send });
      return { ok: true };
    } catch (error) { return { ok: false, error: friendly(error) }; }
  });
  function launchInstalled() {
    if (!installedExe) return { ok: false, error: 'Nothing was installed.' };
    try { const child = spawn(installedExe, [], { detached: true, stdio: 'ignore' }); child.on('error', () => {}); child.unref(); return { ok: true }; } catch (error) { return { ok: false, error: friendly(error) }; }
  }
  ipcMain.handle('setup:finish', (_e, open) => { const r = open ? launchInstalled() : { ok: true }; if (r.ok) setTimeout(() => app.quit(), 250); return r; });
  ipcMain.handle('setup:run-portable', () => { continuing = true; if (win && !win.isDestroyed()) win.destroy(); startApp(); return { ok: true }; });
  ipcMain.on('setup:minimize', () => win?.minimize());
  ipcMain.on('setup:close', () => win?.close());

  app.whenReady().then(() => {
    win = new BrowserWindow({
      width: 860, height: 580, frame: false, resizable: false, maximizable: false, fullscreenable: false, show: false,
      backgroundColor: '#09090b', title: `${APP_NAME} Setup`, icon: common.asset('icon.png'), center: true, roundedCorners: true,
      webPreferences: { preload: path.join(__dirname, 'setup-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
    });
    win.setMenu?.(null);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    win.once('ready-to-show', () => win.show());
    win.loadFile(path.join(__dirname, 'setup', 'index.html'));
    if (process.env.SWA_SETUP_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' });
  });
}

/** An update keeps what the person chose: shortcuts that exist stay, ones they deleted stay deleted. */
function updateOptions(dir) {
  const prior = readInstalled(dir)?.options || {};
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(path.join(common.userDataDir(), 'settings.json'), 'utf8')); } catch { /* Defaults. */ }
  let autostart = Boolean(prior.autostart);
  try { if (process.platform === 'win32') autostart = app.getLoginItemSettings({ path: path.join(dir, exeFile), args: ['--login'] }).openAtLogin; } catch { /* Keep the earlier choice. */ }
  return { desktop: fs.existsSync(desktopLink()), startMenu: fs.existsSync(startMenuLink()), autostart, startHidden: typeof settings.startHidden === 'boolean' ? settings.startHidden : Boolean(prior.startHidden), launch: false };
}

function friendly(error) {
  const code = error?.code;
  if (code === 'EACCES' || code === 'EPERM') return 'Windows would not let setup write there. Pick a folder inside your user profile, or close the app if it is running.';
  if (code === 'ENOENT') return 'The new files could not be found. Download the setup again and run it once.';
  if (code === 'ENOSPC') return 'There is not enough free disk space.';
  if (code === 'EBUSY') return 'A file is in use. Close Study with Sarang and try again.';
  return error?.message || 'Something went wrong.';
}

module.exports = { run };
