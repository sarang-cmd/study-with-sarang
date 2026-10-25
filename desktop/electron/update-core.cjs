'use strict';
/**
 * Update logic without Electron: reading a GitHub release, choosing the right file, downloading it
 * and refusing anything that does not match its SHA-256. The network functions take their transport
 * and host rules as arguments, so tests can point them at a local server.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

const REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const ASSET = /^Study-with-Sarang-(\d+\.\d+\.\d+)\.exe$/;
const HASH = /^[a-f0-9]{64}$/;
const MAX_BYTES = 400 * 1024 * 1024;
// GitHub serves release files from these hosts (after a redirect from github.com).
const GITHUB_HOSTS = new Set(['api.github.com', 'github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'github-releases.githubusercontent.com']);

const cleanRepo = (value) => {
  const text = String(value ?? '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '').replace(/\.git$/i, '');
  return REPO.test(text) ? text : '';
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

const strictHttps = (url) => url.protocol === 'https:' && GITHUB_HOSTS.has(url.hostname);

/**
 * Picks the Windows file and its checksum from a release.
 * The checksum comes from GitHub's own "digest" field or from an uploaded "<file>.sha256" file.
 */
function pickRelease(json) {
  if (!json || typeof json !== 'object' || json.draft || json.prerelease) return null;
  const version = parseVersion(json.tag_name);
  if (!version) return null;
  const assets = Array.isArray(json.assets) ? json.assets : [];
  const file = assets.find((a) => a && typeof a.name === 'string' && ASSET.exec(a.name)?.[1] === version.join('.'));
  const notes = typeof json.body === 'string' ? json.body.replace(/\r/g, '').trim().slice(0, 1500) : '';
  const result = { version: version.join('.'), notes, htmlUrl: typeof json.html_url === 'string' ? json.html_url : '', file: null };
  if (file) {
    const digest = typeof file.digest === 'string' ? /^sha256:([a-f0-9]{64})$/i.exec(file.digest)?.[1]?.toLowerCase() : '';
    const sumAsset = assets.find((a) => a && a.name === `${file.name}.sha256`);
    result.file = {
      name: file.name, url: String(file.browser_download_url ?? ''), size: Number.isFinite(file.size) ? file.size : 0,
      sha256: digest || '', sumUrl: sumAsset ? String(sumAsset.browser_download_url ?? '') : '',
    };
  }
  return result;
}

/** One GET with a few redirects. Every hop must pass `allow`. Resolves with the response stream. */
function get(urlText, { allow = strictHttps, headers = {}, timeoutMs = 20000, hops = 5 } = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(urlText); } catch { reject(new Error('That is not a valid address.')); return; }
    if (!allow(url)) { reject(new Error('The update address is not an allowed GitHub address.')); return; }
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

async function fetchLatest(repo, opts = {}) {
  const base = opts.apiBase || 'https://api.github.com';
  const response = await get(`${base}/repos/${repo}/releases/latest`, { ...opts, headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
  if (response.statusCode === 404) { response.resume(); return { none: true }; }
  if (response.statusCode === 403 || response.statusCode === 429) { response.resume(); throw new Error('GitHub is limiting requests right now. Try again in a little while.'); }
  if (response.statusCode !== 200) { response.resume(); throw new Error(`GitHub answered ${response.statusCode}.`); }
  let json;
  try { json = JSON.parse(await readText(response, 2 * 1024 * 1024)); } catch { throw new Error('GitHub sent an answer the app could not read.'); }
  return { release: pickRelease(json) };
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
  if (!HASH.test(sha256 || '')) throw new Error('This release has no checksum, so the app will not install it.');
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

module.exports = { cleanRepo, parseVersion, compare, pickRelease, fetchLatest, resolveHash, download, get, strictHttps, GITHUB_HOSTS, ASSET, MAX_BYTES };
