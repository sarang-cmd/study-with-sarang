'use strict';
const { Tray, Menu, nativeImage } = require('electron');
const { APP_NAME, isMac, isWin, iconFile } = require('./common.cjs');

function createTray({ run, toggleWindow, getState, getMonitors = () => [], snapLayouts = [], icon = 'default' }) {
  const imageFor = (kind) => {
    const image = isMac
      ? nativeImage.createFromPath(iconFile(kind, 'trayTemplate.png'))
      : nativeImage.createFromPath(iconFile(kind, 'tray.png')).resize({ width: 32, height: 32 });
    if (isMac) image.setTemplateImage(true);
    return image;
  };
  const tray = new Tray(imageFor(icon));
  tray.setToolTip(APP_NAME);
  tray.on('click', () => toggleWindow());
  if (isWin) tray.on('double-click', () => toggleWindow());

  function build() {
    const s = getState();
    const item = (label, command, extra = {}) => ({ label, click: () => run(command), ...extra });
    const template = [
      item(s.windowVisible ? `Hide ${APP_NAME}` : `Show ${APP_NAME}`, 'window.toggle'),
      item(s.compact ? 'Expand to full window' : 'Collapse to mini bar', s.compact ? 'window.expand' : 'window.compact'),
      { type: 'separator' },
      { label: s.mixName ? `Now: ${s.mixName}` : 'Sound', enabled: false },
      item(s.playing ? 'Pause sound' : 'Play sound', 'sound.toggle'),
      item('Next variation', 'sound.next'),
      { label: 'Volume', submenu: [item('Louder', 'volume.up'), item('Quieter', 'volume.down')] },
      { type: 'separator' },
      { label: s.timerLabel ? `Timer: ${s.timerLabel}` : 'Timer', enabled: false },
      item(s.timerRunning ? 'Pause timer' : 'Start timer', 'timer.toggle'),
      item('I drifted', 'timer.drift', { enabled: s.timerRunning }),
      item('Reset timer', 'timer.reset'),
      item('Show or hide the floating puck', 'puck.toggle'),
      { type: 'separator' },
      item('Settings...', 'settings.open'),
      item('Command palette', 'palette.open'),
      { type: 'separator' },
      item('Global shortcuts', 'shortcuts.toggle', { type: 'checkbox', checked: s.globalEnabled }),
      item('Always on top', 'window.pin', { type: 'checkbox', checked: s.alwaysOnTop }),
    ];
    const monitors = getMonitors();
    if (monitors.length > 1) {
      template.push({
        label: 'Move to screen',
        submenu: monitors.map((m, index) => ({ label: `${index + 1}. ${m.name}  ${m.width}x${m.height}${m.current ? '  (here)' : ''}`, type: 'radio', checked: m.current, click: () => run(`window.moveto:${m.id}`) })),
      });
    }
    if (snapLayouts.length) template.push({ label: 'Snap window', submenu: snapLayouts.map((l) => ({ label: l.label, click: () => run(`window.snap:${l.id}`) })) });
    if (s.canAutostart) template.push({ label: 'Open at login', type: 'checkbox', checked: s.openAtLogin, click: () => run('app.login:toggle') });
    if (s.updatesOn) template.push(item(s.updateVersion ? `Update to ${s.updateVersion}...` : 'Check for updates', 'app.update'));
    template.push({ type: 'separator' }, item('Quit', 'app.quit'));
    return Menu.buildFromTemplate(template);
  }

  return {
    update() {
      const s = getState();
      const parts = [APP_NAME];
      if (s.mixName && s.playing) parts.push(s.mixName);
      if (s.timerRunning && s.timerLabel) parts.push(s.timerLabel);
      tray.setToolTip(parts.join(' · '));
      tray.setContextMenu(build());
    },
    /** The same menu as the tray icon, popped at the cursor (the mini bar is too small for the page's own menu). */
    popup(window) { try { build().popup({ window }); } catch { /* Menu is optional. */ } },
    setIcon(kind) { try { tray.setImage(imageFor(kind)); } catch { /* Keep the current icon. */ } },
    destroy() { tray.destroy(); },
  };
}

module.exports = { createTray };
