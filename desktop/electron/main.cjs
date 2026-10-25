'use strict';
const { app } = require('electron');
const path = require('node:path');
const common = require('./common.cjs');
const { detect } = require('./mode.cjs');

/**
 * Media keys. By default they follow the browser model: the operating system sends Play/Pause to whichever app played
 * most recently, so a video in another window can be paused and resumed with the key even while this app is open in the
 * background. That needs Chromium's media-key handling switched on; the old behavior (this app grabs the key always)
 * switches it off and registers the key globally instead. It is decided here, before the app is ready, so changing
 * the setting needs a restart.
 */
function mediaFollowWanted() {
  try {
    const raw = JSON.parse(require('node:fs').readFileSync(path.join(common.userDataDir(), 'settings.json'), 'utf8'));
    return raw.mediaKeys !== false && raw.mediaKeysFollow !== false;
  } catch { return true; }
}
common.runtime.mediaFollow = mediaFollowWanted();
// Chromium keeps timers and audio running when the window is hidden, minimized or covered.
app.commandLine.appendSwitch('disable-features', ['CalculateNativeWinOcclusion', ...(common.runtime.mediaFollow ? [] : ['HardwareMediaKeyHandling', 'MediaSessionService'])].join(','));
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setAppUserModelId(common.APP_ID);

const mode = detect({ packaged: app.isPackaged, windowsStore: Boolean(process.windowsStore) });

if (mode === 'app') {
  app.setPath('userData', common.userDataDir());
  require('./app.cjs').start();
} else {
  // Setup and uninstall use a scratch profile so they never fight with a running copy.
  app.setPath('userData', path.join(require('node:os').tmpdir(), `study-with-sarang-${mode}-${process.pid}`));
  require('./installer.cjs').run(mode, () => require('./app.cjs').startAfterSetup());
}
