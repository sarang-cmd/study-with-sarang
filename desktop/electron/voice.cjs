'use strict';
/**
 * Voice mode, Windows only: runs voice-listener.ps1 (Windows' own offline recognizer) and
 * relays what it hears. Other platforms report "unsupported".
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn: realSpawn } = require('node:child_process');

function createVoice({ dir, platform = process.platform, spawn = realSpawn, scriptSource, diagnoseSource, onEvent, readyTimeoutMs = 20000 }) {
  let child = null;
  let buffer = '';
  let readyTimer = null;
  let sawError = false;
  let errText = '';
  const supported = platform === 'win32';

  const emit = (event) => { try { onEvent(event); } catch { /* UI is gone. */ } };

  function handleLine(line) {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'ready') { clearTimeout(readyTimer); emit({ type: 'status', status: 'listening', language: String(message.language ?? ''), culture: String(message.culture ?? '') }); }
    else if (message.type === 'heard') emit({ type: 'heard', text: String(message.text ?? '').slice(0, 200), confidence: Number(message.confidence) || 0 });
    else if (message.type === 'rejected') emit({ type: 'rejected', text: String(message.text ?? '').slice(0, 200), confidence: Number(message.confidence) || 0 });
    else if (message.type === 'hypothesis') emit({ type: 'hypothesis', text: String(message.text ?? '').slice(0, 200) });
    else if (message.type === 'level') emit({ type: 'level', level: Math.max(0, Math.min(100, Math.round(Number(message.level) || 0))) });
    else if (message.type === 'error') { sawError = true; clearTimeout(readyTimer); emit({ type: 'status', status: 'error', code: String(message.code ?? 'failed'), message: String(message.message ?? 'Voice mode could not start.').slice(0, 240) }); }
  }

  function stop(silent) {
    clearTimeout(readyTimer);
    const current = child; child = null; buffer = '';
    if (current) { try { current.kill(); } catch { /* Already exited. */ } }
    if (!silent) emit({ type: 'status', status: 'off' });
  }

  return {
    supported,
    start(config) {
      stop(true);
      if (!supported) { emit({ type: 'status', status: 'unsupported', message: 'Voice mode needs Windows speech recognition. It is not available on this system yet.' }); return false; }
      sawError = false; errText = '';
      try {
        fs.mkdirSync(dir, { recursive: true });
        const script = path.join(dir, 'voice-listener.ps1');
        const configFile = path.join(dir, 'voice-config.json');
        fs.writeFileSync(script, '\ufeff' + scriptSource()); // BOM so Windows PowerShell reads UTF-8 correctly.
        fs.writeFileSync(configFile, JSON.stringify(config), 'utf8');
        emit({ type: 'status', status: 'starting' });
        child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-ConfigFile', configFile, '-ParentPid', String(process.pid)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const mine = child;
        mine.stdout.setEncoding('utf8');
        mine.stdout.on('data', (chunk) => {
          buffer += chunk;
          let index;
          while ((index = buffer.indexOf('\n')) !== -1) { const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1); if (line) handleLine(line); }
        });
        mine.stderr.on('data', (chunk) => { errText = (errText + chunk).replace(/\s+/g, ' ').slice(-300); });
        mine.on('error', (error) => { if (child === mine) { child = null; clearTimeout(readyTimer); emit({ type: 'status', status: 'error', code: 'spawn', message: `Could not start Windows PowerShell: ${String(error.message).slice(0, 120)}` }); } });
        mine.on('exit', () => { if (child === mine) { child = null; clearTimeout(readyTimer); if (!sawError) { if (errText.trim()) emit({ type: 'status', status: 'error', code: 'failed', message: `Windows PowerShell stopped: ${errText.trim().slice(0, 200)}` }); else emit({ type: 'status', status: 'off' }); } } });
        readyTimer = setTimeout(() => { if (child === mine) { stop(true); emit({ type: 'status', status: 'error', code: 'timeout', message: `Voice mode did not start within ${Math.round(readyTimeoutMs / 1000)} seconds.${errText.trim() ? ` ${errText.trim().slice(0, 160)}` : ' Run the checks below.'}` }); } }, readyTimeoutMs);
        return true;
      } catch (error) {
        emit({ type: 'status', status: 'error', code: 'failed', message: String(error?.message ?? error).slice(0, 200) });
        return false;
      }
    },
    stop: () => stop(false),
    running: () => child !== null,
    /** One-off checks (recognizers, microphone permission, microphone access). Resolves with an object, never rejects. */
    diagnose() {
      if (!supported) return Promise.resolve({ ok: false, error: 'Voice mode needs Windows.' });
      if (!diagnoseSource) return Promise.resolve({ ok: false, error: 'Diagnostics are not available.' });
      return new Promise((resolve) => {
        let out = ''; let err = ''; let done = false;
        const finish = (value) => { if (!done) { done = true; clearTimeout(timer); resolve(value); } };
        let proc;
        try {
          fs.mkdirSync(dir, { recursive: true });
          const script = path.join(dir, 'voice-diagnose.ps1');
          fs.writeFileSync(script, '\ufeff' + diagnoseSource());
          proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        } catch (error) { finish({ ok: false, error: String(error?.message ?? error).slice(0, 200) }); return; }
        const timer = setTimeout(() => { try { proc.kill(); } catch { /* Gone. */ } finish({ ok: false, error: 'The check took too long.' }); }, 20000);
        proc.stdout.setEncoding('utf8'); proc.stdout.on('data', (chunk) => { out += chunk; });
        proc.stderr?.on('data', (chunk) => { err = (err + chunk).slice(-300); });
        proc.on('error', (error) => finish({ ok: false, error: `Could not start Windows PowerShell: ${String(error.message).slice(0, 120)}` }));
        proc.on('exit', () => {
          const line = out.split('\n').map((l) => l.trim()).filter(Boolean).pop();
          try { const data = JSON.parse(line); finish({ ok: true, ...data }); } catch { finish({ ok: false, error: err.trim() ? `PowerShell reported: ${err.trim().slice(0, 200)}` : 'The check gave no result.' }); }
        });
      });
    },
  };
}

module.exports = { createVoice };
