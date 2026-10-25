'use strict';
/**
 * Optional "what else is happening on this PC" helper, Windows only. It runs activity-listener.ps1, which only
 * reads status flags (which apps use the microphone, which recorders run, which apps play media).
 * It starts only when the user turns auto-pause on, and stops when they turn it off.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn: realSpawn } = require('node:child_process');

const names = (value) => (Array.isArray(value) ? value : []).map((item) => String(item).slice(0, 160)).slice(0, 40);
const recorderList = (text) => String(text ?? '').split(',').map((item) => item.trim().toLowerCase().replace(/[^a-z0-9 ._\-]/g, '')).filter(Boolean).slice(0, 60);

function createActivity({ dir, platform = process.platform, spawn = realSpawn, scriptSource, onState, onStatus }) {
  let child = null; let buffer = ''; let recorders = ''; let status = platform === 'win32' ? 'off' : 'unsupported';
  const supported = platform === 'win32';
  const setStatus = (next, message = '') => { status = next; try { onStatus?.({ status, message }); } catch { /* UI is gone. */ } };

  function handleLine(line) {
    let m; try { m = JSON.parse(line); } catch { return; }
    if (!m || typeof m.type !== 'string') return;
    if (m.type === 'ready') setStatus('on', m.media === false ? 'Windows media sessions are not available here, so videos in other apps cannot be detected.' : '');
    else if (m.type === 'state') { try { onState({ mic: names(m.mic), recorders: names(m.recorders), media: names(m.media) }); } catch { /* Ignore. */ } }
  }

  function stop() {
    const current = child; child = null; buffer = '';
    if (current) { try { current.kill(); } catch { /* Already exited. */ } }
    if (supported && status !== 'error') setStatus('off');
  }

  function start(recorderText) {
    if (!supported) return false;
    const list = recorderList(recorderText).join(',');
    if (child && list === recorders) return true;
    if (child) stop();
    recorders = list;
    try {
      fs.mkdirSync(dir, { recursive: true });
      const script = path.join(dir, 'activity-listener.ps1');
      fs.writeFileSync(script, '\ufeff' + scriptSource());
      child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Recorders', recorders, '-ParentPid', String(process.pid)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const mine = child; let errText = '';
      mine.stdout.setEncoding('utf8');
      mine.stdout.on('data', (chunk) => {
        buffer += chunk; let index;
        while ((index = buffer.indexOf('\n')) !== -1) { const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1); if (line) handleLine(line); }
      });
      mine.stderr?.on('data', (chunk) => { errText = (errText + chunk).slice(-300); });
      mine.on('error', () => { if (child === mine) { child = null; setStatus('error', 'Could not start Windows PowerShell for auto-pause.'); } });
      mine.on('exit', () => { if (child === mine) { child = null; if (errText.trim()) setStatus('error', `Auto-pause helper stopped: ${errText.trim().slice(0, 160)}`); else if (status !== 'error') setStatus('off'); } });
      return true;
    } catch (error) { child = null; setStatus('error', String(error?.message ?? error).slice(0, 200)); return false; }
  }

  return { supported, start, stop, running: () => child !== null, status: () => status };
}

module.exports = { createActivity, recorderList };
