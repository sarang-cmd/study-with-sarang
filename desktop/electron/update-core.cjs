'use strict';
/**
 * Update logic without Electron: reading the update feed (a small JSON file the website publishes), choosing the
 * right file, downloading it and refusing anything that does not match its SHA-256. The network functions take
 * their transport and host rules as arguments, so tests can point them at a local server.
 *
 * The feed lives on the app's own website (Vercel), for example https://study-with-sarang.vercel.app/updates/latest.json:
 *   { "app": "...", "version": "2.2.0", "notes": "...", "windows": { "file": "...exe", "url": "...", "size": 1, "sha256": "..." } }
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

const ASSET = /^Study-with-Sarang-(\d+\.\d+\.\d+)\.exe$/;
const HASH = /^[a-f0-9]{64}$/;
const MAX_BYTES = 400 * 1024 * 1024;
// The website and its downloads are served from Vercel. Anything else is refused unless a test passes its own rule.
const allowedHost = (hostname) => /(^|\.)vercel\.app$/i.test(hostname);

/** A feed address: https, an allowed host, no credentials. Returns the cleaned address or an empty string. */
const cleanFeed = (value, { allow } = {}) => {
  try {
    const url = new URL(String(value ?? '').trim());
    if (url.username || url.password) return '';
    if (allow ? !allow(url) : url.protocol !== 'https:' || !allowedHost(url.hostname)) return '';
    url.hash = '';
    return url.toString();
  } catch { return ''; }
};

/** "v1.2.3" or "1.2.3" to [1, 2, 3]; null when it is not a plain release number. */
function parseVersion(text) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(text ?? '').trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}
function compare(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}

const strictHttps = (url) => url.protocol === 'https:' && allowedHost(url.hostname);

/** Reads the feed. Returns null when it is not a usable release. The checksum must be a 64-character SHA-256. */
function pickRelease(json, feedUrl = '') {
  if (!json || typeof json !== 'object') return null;
  const version = parseVersion(json.version);
  if (!version) return null;
  const notes = typeof json.notes === 'string' ? json.notes.replace(/\r/g, '').trim().slice(0, 1500) : '';
  const resolve = (value) => { try { return new URL(String(value ?? ''), feedUrl || undefined).toString(); } catch { return ''; } };
  const page = json.page ? resolve(json.page) : feedUrl ? resolve('/downloads') : '';
  const result = { version: version.join('.'), notes, htmlUrl: page, file: null };
  const w = json.windows;
  if (w && typeof w === 'object' && ASSET.exec(String(w.file ?? ''))?.[1] === version.join('.')) {
    const sha = typeof w.sha256 === 'string' ? w.sha256.toLowerCase() : '';
    result.file = { name: w.file, url: resolve(w.url || w.file), size: Number.isFinite(w.size) ? w.size : 0, sha256: HASH.test(sha) ? sha : '', sumUrl: '' };
  }
  return result;
}

/** One GET with a few redirects. Every hop must pass `allow`. Resolves with the response stream. */
function get(urlText, { allow = strictHttps, headers = {}, timeoutMs = 20000, hops = 5 } = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(urlText); } catch { reject(new Error('That is not a valid address.')); return; }
    if (!allow(url)) { reject(new Error('The update address is not an allowed address.')); return; }
    const client = url.protocol === 'http:' ? http : https;
    const request = client.get(url, { headers: { 'User-Agent': 'Study-with-Sarang-updater', ...headers }, timeout: timeoutMs }, (response) => {
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        response.resume();
        if (hops <= 0) { reject(new Error('Too many redirects.')); return; }
        get(new URL(response.headers.location, url).toString(), { allow, headers, timeoutMs, hops: hops - 1 }).then(resolve, reject);
        return;
      }
      resolve(response);
    });
    request.on('timeout', () => request.destroy(new Error('The connection timed out.')));
    request.on('error', reject);
  });
}

async function readText(response, limit) {
  const chunks = []; let size = 0;
  for await (const chunk of response) { size += chunk.length; if (size > limit) { response.destroy(); throw new Error('The answer was too large.'); } chunks.push(chunk); }
  return Buffer.concat(chunks).toString('utf8');
}

async function fetchLatest(feed, opts = {}) {
  const response = await get(feed, { ...opts, headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } });
  if (response.statusCode === 404) { response.resume(); return { none: true }; }
  if (response.statusCode !== 200) { response.resume(); throw new Error(`The update server answered ${response.statusCode}.`); }
  let json;
  try { json = JSON.parse(await readText(response, 256 * 1024)); } catch { throw new Error('The update server sent an answer the app could not read.'); }
  return { release: pickRelease(json, feed) };
}

async function resolveHash(file, opts = {}) {
  if (file.sha256 && HASH.test(file.sha256)) return file.sha256;
  if (!file.sumUrl) return '';
  const response = await get(file.sumUrl, opts);
  if (response.statusCode !== 200) { response.resume(); return ''; }
  const text = await readText(response, 4096);
  const found = /\b([a-fA-F0-9]{64})\b/.exec(text);
  return found ? found[1].toLowerCase() : '';
}

/** Downloads to `dest`, checks size, the "MZ" header and the SHA-256, and only then renames it into place. */
async function download({ url, dest, sha256, size, onProgress, signal, ...opts }) {
  if (!HASH.test(sha256 || '')) throw new Error('This update has no checksum, so the app will not install it.');
  const response = await get(url, opts);
  if (response.statusCode !== 200) { response.resume(); throw new Error(`The download failed (${response.statusCode}).`); }
  const total = Number(response.headers['content-length']) || size || 0;
  if (total > MAX_BYTES) { response.destroy(); throw new Error('The file is larger than expected.'); }
  if (size && total && size !== total) { response.destroy(); throw new Error('The file size does not match the release.'); }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(part);
  let got = 0; let head = null; let lastReport = 0;
  try {
    for await (const chunk of response) {
      if (signal?.aborted) throw new Error('Cancelled.');
      if (!head) head = chunk.subarray(0, 2).toString('latin1');
      got += chunk.length;
      if (got > MAX_BYTES) throw new Error('The file is larger than expected.');
      hash.update(chunk);
      if (!out.write(chunk)) await new Promise((resolve) => out.once('drain', resolve));
      const now = Date.now();
      if (total && now - lastReport > 120) { lastReport = now; onProgress?.(Math.min(99, Math.round((got / total) * 100))); }
    }
    await new Promise((resolve, reject) => { out.end(); out.once('finish', resolve); out.once('error', reject); });
  } catch (error) {
    out.destroy(); fs.rmSync(part, { force: true }); throw error;
  }
  if (total && got !== total) { fs.rmSync(part, { force: true }); throw new Error('The download ended early. Try again.'); }
  if (head !== 'MZ') { fs.rmSync(part, { force: true }); throw new Error('The download is not a Windows program.'); }
  if (hash.digest('hex') !== sha256.toLowerCase()) { fs.rmSync(part, { force: true }); throw new Error('The download does not match its checksum, so it was thrown away.'); }
  fs.rmSync(dest, { force: true });
  fs.renameSync(part, dest);
  onProgress?.(100);
  return { file: dest, bytes: got };
}

module.exports = { cleanFeed, parseVersion, compare, pickRelease, fetchLatest, resolveHash, download, get, strictHttps, allowedHost, ASSET, MAX_BYTES };
