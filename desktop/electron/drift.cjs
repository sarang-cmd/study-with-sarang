'use strict';
/**
 * Drift detection helpers for the desktop app. This file only collects facts and hands them to the page, which decides
 * (see src/lib/drift.ts). Two sources:
 *   - the program in front and its window title (Windows: a small PowerShell reader; macOS: AppleScript; not on Linux),
 *   - the browser helper: a tiny server on 127.0.0.1 that only the optional extension can talk to, with a pairing token.
 * Nothing here uses the network beyond this computer.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn: realSpawn, execFile: realExecFile } = require('node:child_process');
const realHttp = require('node:http');

const clip = (value, n) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
const safeEqual = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const MAX_BODY = 4096;

/** Whether a request may talk to the helper server. Returns '' when fine, or the reason it is refused (and the status). */
function checkRequest({ host, origin, auth }, config) {
  const allowedHosts = [`127.0.0.1:${config.port}`, `localhost:${config.port}`];
  if (!allowedHosts.includes(String(host ?? '').toLowerCase())) return { status: 403, why: 'host' };
  if (origin && !/^(chrome|moz|safari-web)-extension:\/\//.test(origin)) return { status: 403, why: 'origin' };
  if (!config.token || !safeEqual(String(auth ?? '').replace(/^Bearer /, ''), config.token)) return { status: 401, why: 'token' };
  return null;
}

/** One tab report from the extension, cleaned. Returns null when it should be ignored. */
function cleanTab(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.incognito === true) return { ignored: 'private window' };
  const host = clip(body.host, 253).toLowerCase().replace(/^www\./, '');
  if (host && !/^[a-z0-9.-]+$/.test(host)) return null;
  return { host, title: clip(body.title, 160), browser: clip(body.browser, 40).toLowerCase() };
}

function createDrift({ dir, platform = process.platform, spawn = realSpawn, execFile = realExecFile, http = realHttp, scriptSource, onSample, onStatus, setIntervalFn = setInterval, clearIntervalFn = clearInterval, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout }) {
  const winSupported = platform === 'win32' || platform === 'darwin';
  let child = null; let buffer = ''; let poll = null; let pollBusy = false; let server = null; let config = { enabled: false, window: true, helper: false, port: 47615, token: '' };
  let status = { window: winSupported ? 'off' : 'unsupported', helper: 'off', message: '', pairing: false }; let lastTabAt = 0; let connectedTimer = null; let pairingUntil = 0; let pairingTimer = null;
  const emit = () => { try { onStatus?.({ ...status }); } catch { /* The page is gone. */ } };
  const setStatus = (patch) => { status = { ...status, ...patch }; emit(); };
  const sample = (s) => { try { onSample?.({ ...s, at: Date.now() }); } catch { /* The page is gone. */ } };

  // ---------------------------------------------------------------- the program in front
  function stopWindow() {
    const current = child; child = null; buffer = '';
    if (current) { try { current.kill(); } catch { /* Gone. */ } }
    if (poll) { clearIntervalFn(poll); poll = null; }
    if (winSupported && status.window !== 'error') setStatus({ window: 'off' });
  }
  function startWindow() {
    if (!winSupported) return;
    if (child || poll) return;
    if (platform === 'win32') {
      try {
        fs.mkdirSync(dir, { recursive: true });
        const script = path.join(dir, 'drift-listener.ps1');
        fs.writeFileSync(script, '\ufeff' + scriptSource());
        child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-ParentPid', String(process.pid)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const mine = child; let err = '';
        mine.stdout.setEncoding('utf8');
        mine.stdout.on('data', (chunk) => {
          buffer += chunk; let i;
          while ((i = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1);
            let m; try { m = JSON.parse(line); } catch { continue; }
            if (m?.type === 'ready') setStatus({ window: 'on', message: '' });
            else if (m?.type === 'window') sample({ src: 'window', app: clip(m.app, 80), title: clip(m.title, 200), host: '' });
          }
        });
        mine.stderr?.on('data', (chunk) => { err = (err + chunk).slice(-300); });
        mine.on('error', () => { if (child === mine) { child = null; setStatus({ window: 'error', message: 'Could not start Windows PowerShell.' }); } });
        mine.on('exit', () => { if (child === mine) { child = null; setStatus(err.trim() ? { window: 'error', message: `The window reader stopped: ${err.trim().slice(0, 160)}` } : { window: 'off' }); } });
      } catch (error) { child = null; setStatus({ window: 'error', message: clip(error?.message ?? error, 200) }); }
      return;
    }
    // macOS: ask System Events for the front app, and its window title when the user allowed it.
    const script = 'tell application "System Events"\nset p to first application process whose frontmost is true\nset n to name of p\nset t to ""\ntry\nset t to name of front window of p\nend try\nreturn n & "|||" & t\nend tell';
    setStatus({ window: 'on', message: '' });
    const once = () => {
      if (pollBusy) return; pollBusy = true;
      execFile('osascript', ['-e', script], { timeout: 4000 }, (error, stdout) => {
        pollBusy = false;
        if (error) { setStatus({ window: 'error', message: 'macOS did not allow reading the front window. Allow Study with Sarang under Privacy and Security > Automation.' }); return; }
        const [app, title] = String(stdout).trim().split('|||');
        sample({ src: 'window', app: clip(app, 80), title: clip(title, 200), host: '' });
      });
    };
    once(); poll = setIntervalFn(once, 1500);
  }

  // ---------------------------------------------------------------- the browser helper
  function stopHelper() {
    if (connectedTimer) { clearIntervalFn(connectedTimer); connectedTimer = null; }
    closePairing();
    const s = server; server = null;
    if (s) { try { s.close(); } catch { /* Closed. */ } }
    setStatus({ helper: 'off' });
  }
  function closePairing() { pairingUntil = 0; if (pairingTimer) { clearTimeoutFn(pairingTimer); pairingTimer = null; } setStatus({ pairing: false }); }
  /** Opens a short window in which the extension may fetch the pairing code with one click. Only the person at this app can open it. */
  function startPairing(ms = 120_000) {
    if (!server) return { ok: false, why: 'Turn on the browser helper first.' };
    pairingUntil = Date.now() + ms;
    if (pairingTimer) clearTimeoutFn(pairingTimer);
    pairingTimer = setTimeoutFn(() => closePairing(), ms);
    setStatus({ pairing: true, message: '' });
    return { ok: true, until: pairingUntil };
  }
  function handle(req, res) {
    const reply = (code, body, origin) => {
      const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
      if (origin) { headers['access-control-allow-origin'] = origin; headers.vary = 'Origin'; headers['access-control-allow-headers'] = 'authorization, content-type'; headers['access-control-allow-methods'] = 'GET, POST, OPTIONS'; }
      res.writeHead(code, headers); res.end(JSON.stringify(body));
    };
    const origin = req.headers.origin && /^(chrome|moz|safari-web)-extension:\/\//.test(req.headers.origin) ? req.headers.origin : '';
    if (req.method === 'OPTIONS') {
      const refused = checkRequest({ host: req.headers.host, origin: req.headers.origin, auth: config.token }, config);
      if (refused && refused.why !== 'token') return reply(refused.status, { error: refused.why });
      return reply(204, {}, origin);
    }
    // Two questions the extension may ask before it holds the pairing code: is the app here, and may I pair now?
    if (req.method === 'GET' && (req.url === '/hello' || req.url === '/pair')) {
      const hostOk = checkRequest({ host: req.headers.host, origin: req.headers.origin, auth: config.token }, config);
      if (hostOk) return reply(hostOk.status, { error: hostOk.why }, origin);
      if (!origin) return reply(403, { error: 'origin' }, origin); // Only a browser extension asks these.
      const open = pairingUntil > Date.now();
      if (req.url === '/hello') return reply(200, { app: 'study-with-sarang', v: 2, pairing: open }, origin);
      if (!open) return reply(403, { error: 'not pairing' }, origin);
      closePairing(); const id = origin.replace(/^[a-z-]+:\/\//, '').slice(0, 40);
      setStatus({ helper: status.helper === 'connected' ? 'connected' : 'listening', message: `Paired with the browser extension ${id.slice(0, 8)}.` });
      return reply(200, { ok: true, token: config.token, port: config.port }, origin);
    }
    const refused = checkRequest({ host: req.headers.host, origin: req.headers.origin, auth: req.headers.authorization }, config);
    if (refused) return reply(refused.status, { error: refused.why }, origin);
    if (req.method === 'GET' && req.url === '/ping') return reply(200, { ok: true, app: 'study-with-sarang', v: 1 }, origin);
    if (req.method === 'POST' && req.url === '/tab') {
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { req.destroy(); return; } chunks.push(c); });
      req.on('end', () => {
        let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(400, { error: 'json' }, origin); }
        const tab = cleanTab(body);
        if (!tab) return reply(400, { error: 'shape' }, origin);
        if (tab.ignored) return reply(200, { ok: true, ignored: tab.ignored }, origin);
        lastTabAt = Date.now();
        if (status.helper !== 'connected') setStatus({ helper: 'connected', message: '' });
        sample({ src: 'tab', app: tab.browser, title: tab.title, host: tab.host, browser: tab.browser });
        reply(200, { ok: true }, origin);
      });
      return undefined;
    }
    return reply(404, { error: 'not found' }, origin);
  }
  function startHelper() {
    if (server) return;
    if (!config.token) { setStatus({ helper: 'error', message: 'No pairing code yet.' }); return; }
    const s = http.createServer(handle); server = s;
    s.on('error', (error) => { if (server === s) { server = null; setStatus({ helper: 'error', message: error?.code === 'EADDRINUSE' ? `Port ${config.port} is used by another program. Choose another port.` : clip(error?.message, 160) }); } });
    s.listen(config.port, '127.0.0.1', () => { if (server === s) setStatus({ helper: 'listening', message: '' }); });
    connectedTimer = setIntervalFn(() => { if (status.helper === 'connected' && Date.now() - lastTabAt > 120_000) setStatus({ helper: 'listening' }); }, 15_000);
  }

  function configure(next) {
    const wasPort = config.port; const wasToken = config.token;
    config = { enabled: next.enabled === true, window: next.window !== false, helper: next.helper === true, port: Number.isInteger(next.port) && next.port >= 1024 && next.port <= 65535 ? next.port : 47615, token: typeof next.token === 'string' && /^[a-f0-9]{32,64}$/.test(next.token) ? next.token : '' };
    if (config.enabled && config.window) startWindow(); else stopWindow();
    if (config.enabled && config.helper) { if (server && (wasPort !== config.port || wasToken !== config.token)) stopHelper(); startHelper(); } else stopHelper();
  }
  function stop() { stopWindow(); stopHelper(); }
  return { configure, stop, status: () => ({ ...status }), supported: winSupported, handle, injectSample: sample, startPairing };
}

/** Copies the extension folder out of the packaged app so it can be loaded into a browser. Returns the folder. */
function exportExtension(from, to) {
  fs.mkdirSync(to, { recursive: true });
  const walk = (a, b) => {
    for (const entry of fs.readdirSync(a, { withFileTypes: true })) {
      const src = path.join(a, entry.name); const dst = path.join(b, entry.name);
      if (entry.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); walk(src, dst); } else fs.writeFileSync(dst, fs.readFileSync(src));
    }
  };
  walk(from, to);
  return to;
}

const PAGES = { chrome: 'chrome://extensions', edge: 'edge://extensions', brave: 'brave://extensions' };
/** How to open a browser straight at its extensions page. Returns null when that browser is not found. */
function browserCommand(browser, { platform, env, exists }) {
  const page = PAGES[browser]; if (!page) return null;
  if (platform === 'darwin') return { command: 'open', args: ['-a', { chrome: 'Google Chrome', edge: 'Microsoft Edge', brave: 'Brave Browser' }[browser], page] };
  if (platform !== 'win32') return null;
  const roots = [env.LOCALAPPDATA, env.ProgramFiles, env['ProgramFiles(x86)']].filter(Boolean);
  const rel = { chrome: ['Google', 'Chrome', 'Application', 'chrome.exe'], edge: ['Microsoft', 'Edge', 'Application', 'msedge.exe'], brave: ['BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'] }[browser];
  for (const root of roots) { const exe = path.join(root, ...rel); if (exists(exe)) return { command: exe, args: [page] }; }
  return null;
}

/** Keeps a folder the person already loaded into a browser current: copies the bundled helper over it when the bundled version is newer.
 * The browser reads the new files the next time it starts or the extension is reloaded. Returns the new version or ''. */
function refreshExtension(from, to) {
  const read = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version; } catch { return ''; } };
  const have = read(to); const bundled = read(from);
  if (!have || !bundled || have === bundled) return '';
  const num = (v) => String(v).split('.').map((n) => Number(n) || 0);
  const a = num(bundled); const b = num(have);
  for (let i = 0; i < 4; i += 1) { if ((a[i] ?? 0) > (b[i] ?? 0)) { exportExtension(from, to); return bundled; } if ((a[i] ?? 0) < (b[i] ?? 0)) return ''; }
  return '';
}

module.exports = { createDrift, checkRequest, cleanTab, exportExtension, refreshExtension, browserCommand };
