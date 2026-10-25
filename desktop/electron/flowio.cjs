'use strict';
/**
 * The two things the page may ask the desktop shell to do for Flow and for sounds:
 *   - make a web request without the browser's cross-origin limits (only https, or http on this computer), and
 *   - read a sound file from the "sounds" folder in the app's data folder.
 * Both validate everything again, because they are reachable from the page.
 */
const fs = require('node:fs');
const path = require('node:path');

const MAX_BODY = 30 * 1024 * 1024;
const MAX_REPLY = 40 * 1024 * 1024;
const SLOT_IDS = ['rain', 'thunder', 'waves', 'wind', 'fire', 'birds', 'crickets', 'coffee-shop', 'singing-bowl', 'white-noise'];
const EXTENSIONS = ['mp3', 'ogg', 'wav', 'flac', 'm4a', 'aac', 'opus', 'webm'];
const MAX_SOUND = 160 * 1024 * 1024;

function allowedUrl(raw) {
  let url;
  try { url = new URL(String(raw)); } catch { return null; }
  if (url.username || url.password) return null;
  if (url.protocol === 'https:') return url;
  if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return url;
  return null;
}

/** @param fetchImpl (url, init) => Promise<Response> */
async function netFetch(fetchImpl, request, { timeoutMs = 60000 } = {}) {
  if (!request || typeof request !== 'object') throw new Error('Bad request');
  const url = allowedUrl(request.url);
  if (!url) throw new Error('Only https addresses (or http on this computer) are allowed.');
  const method = request.method === 'GET' ? 'GET' : 'POST';
  const headers = {};
  if (request.headers && typeof request.headers === 'object') {
    for (const [name, value] of Object.entries(request.headers)) {
      if (typeof value !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(name)) continue;
      if (/^(host|content-length|connection|cookie|origin|referer)$/i.test(name)) continue;
      headers[name] = value.slice(0, 4096);
    }
  }
  let body;
  if (method === 'POST' && request.body !== undefined) {
    if (typeof request.body === 'string') body = request.body;
    else if (request.body instanceof ArrayBuffer || ArrayBuffer.isView(request.body)) body = Buffer.from(request.body.buffer ?? request.body, request.body.byteOffset ?? 0, request.body.byteLength);
    else throw new Error('Bad body');
    if (Buffer.byteLength(body) > MAX_BODY) throw new Error('The recording is too large to send.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url.toString(), { method, headers, body, signal: controller.signal, redirect: 'follow', credentials: 'omit', cache: 'no-store' });
    const chunks = []; let size = 0;
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength; if (size > MAX_REPLY) { controller.abort(); throw new Error('The reply was too large.'); }
        chunks.push(Buffer.from(value));
      }
    } else { const buf = Buffer.from(await response.arrayBuffer()); size = buf.length; chunks.push(buf); }
    const out = {};
    response.headers.forEach((value, key) => { out[key.toLowerCase()] = value; });
    return { status: response.status, headers: out, body: Buffer.concat(chunks, size) };
  } finally { clearTimeout(timer); }
}

// ---------------------------------------------------------------------------------------------- sound files
const README = `Study with Sarang: your own sounds
==================================

Drop a recording into this folder and it replaces the generated sound of the same name the next time you press play.
Name the file after the sound:

  rain, thunder, waves, wind, fire, birds, crickets, coffee-shop, singing-bowl, white-noise

with one of these endings: ${EXTENSIONS.map((e) => '.' + e).join(' ')}   (for example rain.mp3 or coffee-shop.ogg)

Tips
  - Longer is better: 1 to 5 minutes before it repeats. The app blends the end into the start, so the loop has no click.
  - Use recordings you have the right to use. Free ones with credits: freesound.org (look for CC0 or CC BY).
  - Settings > Sounds shows which file is used for each sound and lets you remove or replace it.
`;

function soundsDir(userData) { return path.join(userData, 'sounds'); }

function ensureSoundsDir(userData) {
  const dir = soundsDir(userData);
  fs.mkdirSync(dir, { recursive: true });
  const readme = path.join(dir, 'README.txt');
  if (!fs.existsSync(readme)) { try { fs.writeFileSync(readme, README); } catch { /* Read-only. */ } }
  return dir;
}

function listSounds(userData) {
  const dir = soundsDir(userData);
  try {
    return fs.readdirSync(dir).filter((name) => {
      const m = /^(.+)\.([a-z0-9]+)$/i.exec(name);
      return m && SLOT_IDS.includes(m[1].toLowerCase()) && EXTENSIONS.includes(m[2].toLowerCase());
    });
  } catch { return []; }
}

async function readSound(userData, slot) {
  if (typeof slot !== 'string' || !SLOT_IDS.includes(slot)) return null;
  const dir = soundsDir(userData);
  let names;
  try { names = fs.readdirSync(dir); } catch { return null; }
  for (const ext of EXTENSIONS) {
    const name = names.find((n) => n.toLowerCase() === `${slot}.${ext}`);
    if (!name) continue;
    const file = path.join(dir, name);
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size === 0 || stat.size > MAX_SOUND) continue;
      return { name, bytes: await fs.promises.readFile(file) };
    } catch { /* Try the next ending. */ }
  }
  return null;
}

module.exports = { netFetch, allowedUrl, readSound, listSounds, ensureSoundsDir, soundsDir, SLOT_IDS, EXTENSIONS, README };
