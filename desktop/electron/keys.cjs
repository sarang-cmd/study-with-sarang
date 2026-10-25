'use strict';
/**
 * The Pause/Break key, Windows only. Electron cannot register it as a global shortcut, so this runs
 * keys-listener.ps1, which asks Windows for it with RegisterHotKey and prints one JSON line per press.
 * Other platforms report "unsupported" and the page's own key handler still works while the window is focused.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn: realSpawn } = require('node:child_process');

function createKeys({ dir, platform = process.platform, spawn = realSpawn, scriptSource, onKey, onStatus }) {
  let child = null;
  let buffer = '';
  let status = platform === 'win32' ? 'off' : 'unsupported';
  const supported = platform === 'win32';
  const setStatus = (next, message = '') => { status = next; try { onStatus?.({ status, message }); } catch { /* UI is gone. */ } };

  function handleLine(line) {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'ready') setStatus('on');
    else if (message.type === 'key' && message.key === 'pause') { try { onKey('pause'); } catch { /* Ignore. */ } }
    else if (message.type === 'error') setStatus('error', String(message.message ?? 'The Pause key is unavailable.').slice(0, 200));
  }

  function stop() {
    const current = child; child = null; buffer = '';
    if (current) { try { current.kill(); } catch { /* Already exited. */ } }
    if (supported && status !== 'error') setStatus('off');
  }

  return {
    supported,
    status: () => status,
    start() {
      if (!supported) return false;
      if (child) return true;
      try {
        fs.mkdirSync(dir, { recursive: true });
        const script = path.join(dir, 'keys-listener.ps1');
        fs.writeFileSync(script, '\ufeff' + scriptSource());
        child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-ParentPid', String(process.pid)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const mine = child;
        mine.stdout.setEncoding('utf8');
        mine.stdout.on('data', (chunk) => {
          buffer += chunk;
          let index;
          while ((index = buffer.indexOf('\n')) !== -1) { const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1); if (line) handleLine(line); }
        });
        mine.stderr.on('data', () => { /* Details are not shown. */ });
        mine.on('error', () => { if (child === mine) { child = null; setStatus('error', 'Could not start Windows PowerShell for the Pause key.'); } });
        mine.on('exit', () => { if (child === mine) { child = null; if (status !== 'error') setStatus('off'); } });
        return true;
      } catch (error) {
        child = null;
        setStatus('error', String(error?.message ?? error).slice(0, 200));
        return false;
      }
    },
    stop,
    running: () => child !== null,
  };
}

module.exports = { createKeys };
