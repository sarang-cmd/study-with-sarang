'use strict';
/**
 * Discord Rich Presence over Discord's local IPC (a named pipe on Windows, a unix socket elsewhere).
 * No library, no network: it speaks to the Discord app running on this same computer. Presence is only
 * sent after the user turns it on and enters their own application ID.
 */
const net = require('node:net');
const path = require('node:path');

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };

function encodeFrame(op, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const out = Buffer.alloc(8 + body.length);
  out.writeInt32LE(op, 0); out.writeInt32LE(body.length, 4); body.copy(out, 8);
  return out;
}

/** Splits a stream into frames. Returns { frames, rest }. Bad or oversized frames are dropped. */
function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (buffer.length - offset >= 8) {
    const op = buffer.readInt32LE(offset); const length = buffer.readInt32LE(offset + 4);
    if (length < 0 || length > 1 << 20) return { frames, rest: Buffer.alloc(0) };
    if (buffer.length - offset - 8 < length) break;
    let data = null;
    try { data = JSON.parse(buffer.subarray(offset + 8, offset + 8 + length).toString('utf8')); } catch { /* Ignore. */ }
    frames.push({ op, data });
    offset += 8 + length;
  }
  return { frames, rest: buffer.subarray(offset) };
}

function pipePaths(platform = process.platform, env = process.env) {
  const out = [];
  for (let i = 0; i < 10; i++) {
    if (platform === 'win32') out.push(`\\\\?\\pipe\\discord-ipc-${i}`);
    else {
      const base = env.XDG_RUNTIME_DIR || env.TMPDIR || env.TMP || env.TEMP || '/tmp';
      out.push(path.join(base, `discord-ipc-${i}`));
      if (platform === 'linux') { out.push(path.join(base, 'snap.discord', `discord-ipc-${i}`), path.join(base, 'app', 'com.discordapp.Discord', `discord-ipc-${i}`)); }
    }
  }
  return out;
}

const isAppId = (value) => /^\d{17,20}$/.test(String(value ?? ''));
const text = (value, max) => (typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim().slice(0, max) : undefined);

/** A picture is the name of an uploaded asset, or a plain https address (the app logo on its website). Nothing else gets through. */
function picture(value) {
  const v = text(value, 256);
  if (!v) return undefined;
  if (/^[a-z0-9_]{1,64}$/.test(v)) return v;
  try { const u = new URL(v); if (u.protocol === 'https:' && !u.username && !u.password && u.hostname.endsWith('.vercel.app') && !u.search && !u.hash) return u.toString(); } catch { /* Not an address. */ }
  return undefined;
}
/** Accepts only the fields Discord needs, with sizes it allows. */
function sanitizeActivity(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const a = { details: text(raw.details, 128), state: text(raw.state, 128) };
  if (!a.details) return null;
  if (raw.type === 2 || raw.type === 3) a.type = raw.type;
  if (raw.timestamps && typeof raw.timestamps === 'object') {
    const t = {};
    if (Number.isFinite(raw.timestamps.start)) t.start = Math.floor(raw.timestamps.start);
    if (Number.isFinite(raw.timestamps.end)) t.end = Math.floor(raw.timestamps.end);
    if (Object.keys(t).length) a.timestamps = t;
  }
  if (raw.assets && typeof raw.assets === 'object') {
    const assets = {};
    const large = picture(raw.assets.large_image);
    if (large) { assets.large_image = large; assets.large_text = text(raw.assets.large_text, 128) ?? 'Study with Sarang'; }
    const small = picture(raw.assets.small_image);
    if (small) { assets.small_image = small; const st = text(raw.assets.small_text, 128); if (st) assets.small_text = st; }
    if (Object.keys(assets).length) a.assets = assets;
  }
  if (Array.isArray(raw.buttons)) {
    const buttons = [];
    for (const b of raw.buttons.slice(0, 1)) {
      const label = text(b?.label, 32); let url = null;
      try { const u = new URL(String(b?.url)); if (u.protocol === 'https:' && !u.username && !u.password && u.toString().length <= 512) url = u.toString(); } catch { /* Not a link. */ }
      if (label && url) buttons.push({ label, url });
    }
    if (buttons.length) a.buttons = buttons;
  }
  return a;
}

function createDiscord({ platform = process.platform, connect = (p) => net.createConnection(p), onStatus = () => {}, retryMs = 15000, pid = process.pid, paths } = {}) {
  let appId = '';
  let wanted = null;          // The activity we want shown, or null for none
  let socket = null;
  let ready = false;
  let buffer = Buffer.alloc(0);
  let timer = null;
  let enabled = false;
  let nonce = 0;
  let status = 'off';
  const candidates = paths || pipePaths(platform);

  const setStatus = (next, detail) => { if (next !== status) { status = next; try { onStatus({ status, detail: detail ?? '' }); } catch { /* UI gone. */ } } };

  function send(op, payload) { try { socket?.write(encodeFrame(op, payload)); } catch { /* Closed. */ } }

  function push() {
    if (!ready) return;
    send(OP.FRAME, { cmd: 'SET_ACTIVITY', args: { pid, activity: wanted ?? undefined }, nonce: String(++nonce) });
  }

  function drop(retry) {
    const old = socket; socket = null; ready = false; buffer = Buffer.alloc(0);
    if (old) { try { old.removeAllListeners(); old.on('error', () => {}); old.end(); const t = setTimeout(() => { try { old.destroy(); } catch { /* Gone. */ } }, 150); t.unref?.(); } catch { /* Gone. */ } }
    if (enabled && retry) { setStatus('waiting', 'Open the Discord app on this computer.'); clearTimeout(timer); timer = setTimeout(open, retryMs); }
  }

  function tryPath(index) {
    if (!enabled) return;
    if (index >= candidates.length) { drop(true); return; }
    let s;
    try { s = connect(candidates[index]); } catch { tryPath(index + 1); return; }
    let connected = false;
    s.on('error', () => { if (!connected) tryPath(index + 1); else if (socket === s) drop(true); });
    s.on('connect', () => {
      connected = true; socket = s; setStatus('connecting');
      send(OP.HANDSHAKE, { v: 1, client_id: appId });
    });
    s.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const { frames, rest } = decodeFrames(buffer); buffer = rest;
      for (const frame of frames) {
        if (frame.op === OP.PING) send(OP.PONG, frame.data ?? {});
        else if (frame.op === OP.CLOSE) { setStatus('error', String(frame.data?.message ?? 'Discord closed the connection. Check the Application ID.').slice(0, 160)); drop(false); return; }
        else if (frame.op === OP.FRAME && frame.data) {
          if (frame.data.evt === 'READY') { ready = true; setStatus('connected', String(frame.data.data?.user?.username ?? '')); push(); }
          else if (frame.data.evt === 'ERROR') setStatus('error', String(frame.data.data?.message ?? 'Discord refused the update.').slice(0, 160));
        }
      }
    });
    s.on('close', () => { if (connected && socket === s) drop(true); });
  }

  function open() { if (!enabled || socket) return; setStatus('connecting'); tryPath(0); }

  function stop() { enabled = false; clearTimeout(timer); if (ready) { wanted = null; push(); } drop(false); setStatus('off'); }

  return {
    /** config: { enabled, appId }, activity: validated before use. */
    update(config, activity) {
      if (!config || config.enabled !== true) { if (enabled || status !== 'off') stop(); return; }
      if (!isAppId(config.appId)) { if (enabled) stop(); setStatus('error', 'Enter the Application ID from the Discord Developer Portal.'); return; }
      const next = sanitizeActivity(activity);
      if (enabled && appId !== config.appId) stop();
      wanted = next; appId = config.appId;
      if (!enabled) { enabled = true; open(); } else push();
    },
    stop,
    status: () => status,
  };
}

module.exports = { createDiscord, encodeFrame, decodeFrames, pipePaths, sanitizeActivity, isAppId, OP };
