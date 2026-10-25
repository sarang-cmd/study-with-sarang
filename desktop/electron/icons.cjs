'use strict';
// The app icon the person picked, applied to every place Windows lets a program change it.
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { app, shell, nativeImage } = require('electron');
const common = require('./common.cjs');

const { IDS, valid, pick } = require('./icon-ids.cjs');
/** Window, taskbar and shortcut artwork. Windows wants .ico; other systems take the PNG. */
const windowIcon = (id) => common.iconFile(pick(id), common.isWin ? 'icon.ico' : 'icon.png');
const image = (id) => { try { return nativeImage.createFromPath(common.iconFile(pick(id), 'icon.png')).resize({ width: 256, height: 256 }); } catch { return undefined; } };

/** The file that is running: the portable build reports its real path, not the folder it unpacks to. */
const exePath = () => process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
const same = (a, b) => !!a && !!b && path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/** Every shortcut that may point at this app: the ones the installer makes, plus ones the person pinned. */
function shortcutPaths() {
  const list = [];
  const add = (dir) => { try { for (const f of fs.readdirSync(dir)) if (f.toLowerCase().endsWith('.lnk')) list.push(path.join(dir, f)); } catch { /* Folder missing. */ } };
  const appData = app.getPath('appData');
  add(path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'));
  add(app.getPath('desktop'));
  add(path.join(appData, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar'));
  add(path.join(appData, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'StartMenu'));
  return list;
}

/** Windows only. Gives each shortcut to this app the chosen icon. Returns how many were changed. */
function refreshShortcuts(id) {
  if (!common.isWin || !app.isPackaged) return 0;
  let changed = 0;
  try {
    const dir = path.join(common.userDataDir(), 'icons'); fs.mkdirSync(dir, { recursive: true });
    const ico = path.join(dir, `app-${pick(id)}.ico`);
    fs.copyFileSync(common.iconFile(pick(id), 'icon.ico'), ico);
    for (const link of shortcutPaths()) {
      try {
        const info = shell.readShortcutLink(link);
        if (!same(info.target, exePath())) continue;
        shell.writeShortcutLink(link, 'update', { icon: ico, iconIndex: 0 });
        changed += 1;
      } catch { /* Not ours, or not readable. */ }
    }
    if (changed) execFile('ie4uinit.exe', ['-show'], { windowsHide: true, timeout: 8000 }, () => {}); // asks Explorer to redraw icons
  } catch { /* Shortcuts are a bonus. */ }
  return changed;
}

module.exports = { IDS, valid, pick, windowIcon, image, refreshShortcuts, shortcutPaths };
