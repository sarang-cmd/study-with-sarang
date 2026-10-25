'use strict';
/**
 * The Flow push-to-talk key. On Windows, flowkey-listener.ps1 reports key down and up for any key or chord, including a lone Right Ctrl.
 * Elsewhere (macOS, Linux) Electron cannot see key releases, so a normal global shortcut is registered and each press toggles hands-free listening.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn: realSpawn } = require('node:child_process');

const validVks = (list) => (Array.isArray(list) ? [...new Set(list.filter((v) => Number.isInteger(v) && v > 0 && v < 255))].slice(0, 4) : []);

function createFlowKey({ dir, platform = process.platform, spawn = realSpawn, scriptSource, globalShortcut, onEvent, onStatus }) {
  let child = null;
  let buffer = '';
  let status = 'off';
  let shortcut = '';
  let wanted = null;
  const supportsHold = platform === 'win32';
  const setStatus = (next, message = '') => { status = next; try { onStatus?.({ status, message, hold: supportsHold }); } catch { /* UI is gone. */ } };

  function handleLine(line) {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'ready') setStatus('on');
    else if (['down', 'up', 'abort', 'esc'].includes(message.type)) { try { onEvent(message.type); } catch { /* Ignore. */ } }
    else if (message.type === 'error') setStatus('error', String(message.message ?? 'The Flow key is unavailable.').slice(0, 200));
  }

  function killChild() { const c = child; child = null; buffer = ''; if (c) { try { c.kill(); } catch { /* Already gone. */ } } }
  function clearShortcut() { if (shortcut) { try { globalShortcut?.unregister(shortcut); } catch { /* Ignore. */ } shortcut = ''; } }

  function start(spec) {
    stop(true);
    wanted = spec;
    const vks = validVks(spec?.vks);
    if (supportsHold) {
      if (!vks.length) { setStatus('error', 'No key chosen.'); return false; }
      try {
        fs.mkdirSync(dir, { recursive: true });
        const script = path.join(dir, 'flowkey-listener.ps1');
        fs.writeFileSync(script, '\ufeff' + scriptSource());
        child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Keys', vks.join(','), '-ParentPid', String(process.pid)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const mine = child;
        setStatus('starting');
        mine.stdout.setEncoding('utf8');
        mine.stdout.on('data', (chunk) => {
          buffer += chunk;
          let index;
          while ((index = buffer.indexOf('\n')) !== -1) { const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1); if (line) handleLine(line); }
        });
        mine.stderr.on('data', () => { /* Not shown. */ });
        mine.on('error', () => { if (child === mine) { child = null; setStatus('error', 'Could not start Windows PowerShell for the Flow key.'); } });
        mine.on('exit', () => { if (child === mine) { child = null; if (status !== 'error') setStatus('off'); } });
        return true;
      } catch (error) { child = null; setStatus('error', String(error?.message ?? error).slice(0, 200)); return false; }
    }
    // No key-up events here: toggle with a global shortcut.
    const accelerator = String(spec?.accelerator ?? '');
    if (!accelerator) { setStatus('error', 'No shortcut chosen.'); return false; }
    try {
      const ok = globalShortcut?.register(accelerator, () => { try { onEvent('toggle'); } catch { /* Ignore. */ } });
      if (!ok) { setStatus('error', `Another app is using ${accelerator}.`); return false; }
      shortcut = accelerator; setStatus('on'); return true;
    } catch (error) { setStatus('error', String(error?.message ?? error).slice(0, 200)); return false; }
  }

  function stop(quiet = false) { killChild(); clearShortcut(); if (!quiet && status !== 'error') setStatus('off'); }

  return { supportsHold, status: () => status, start, stop, running: () => child !== null || shortcut !== '', spec: () => wanted };
}

module.exports = { createFlowKey, validVks };
