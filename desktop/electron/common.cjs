'use strict';
const path = require('node:path');
const { app } = require('electron');

const APP_NAME = 'Study with Sarang';
const APP_ID = 'com.sarang.studywithsarang';
const PROTOCOL = 'study-with-sarang';
// The app is served from this host over https. ".localhost" is reserved for loopback, so it
// can never reach a real server, and a real https origin lets YouTube embeds and their
// postMessage API work. Saved mixes and the time log live under this one stable origin.
const HOST = 'app.study-with-sarang.localhost';
const ORIGIN = `https://${HOST}`;

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

/** Same folder for the installed app, the portable run and the installer's settings writes. */
const userDataDir = () => path.join(app.getPath('appData'), APP_NAME);
const rootDir = path.join(__dirname, '..');
const asset = (...parts) => path.join(rootDir, 'assets', ...parts);
/** Window, taskbar and tray artwork for the chosen app icon (see icon-ids.cjs). */
const iconFile = (kind, name) => asset('icons', kind || 'default', name);

/** Windows 11 22H2 (build 22621) or newer supports the Mica backdrop. */
function supportsMica() {
  if (!isWin) return false;
  const build = Number((require('node:os').release().split('.')[2]) || 0);
  return build >= 22621;
}

/** Facts decided once at startup, before the app is ready. */
const runtime = { mediaFollow: false };

module.exports = { runtime, APP_NAME, APP_ID, PROTOCOL, HOST, ORIGIN, isWin, isMac, userDataDir, rootDir, asset, iconFile, supportsMica };
