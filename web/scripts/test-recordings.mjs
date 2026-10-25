// Tests the sound tooling: the manifest builder and the Freesound fetcher (against a local mock of the API).
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildManifest } from './sounds-manifest.mjs';
import { allowed, licenseName, main } from './fetch-freesound.mjs';

const tmp = mkdtempSync(path.join(os.tmpdir(), 'swa-sounds-'));
const big = Buffer.alloc(4096, 1);

// Manifest: only known slots with real files, mp3 before wav, credits attached, junk ignored.
writeFileSync(path.join(tmp, 'rain.mp3'), big); writeFileSync(path.join(tmp, 'rain.wav'), big); writeFileSync(path.join(tmp, 'wind.ogg'), big);
writeFileSync(path.join(tmp, 'fire.mp3'), Buffer.alloc(10)); writeFileSync(path.join(tmp, 'cats.mp3'), big);
writeFileSync(path.join(tmp, 'credits.json'), JSON.stringify({ rain: { title: 'Rain\nloop', author: 'a', license: 'CC0', freesoundId: 5, seconds: 61.4 }, wind: 'junk' }));
let m = buildManifest(tmp);
assert.deepEqual(m.files.map((f) => f.slot), ['rain', 'wind']);
assert.equal(m.files[0].file, 'rain.mp3'); assert.equal(m.files[0].title, 'Rain loop'); assert.equal(m.files[0].freesoundId, 5); assert.equal(m.files[0].seconds, 61);
assert.equal(m.files[1].license, undefined);
writeFileSync(path.join(tmp, 'credits.json'), '{broken'); assert.equal(buildManifest(tmp).files.length, 2);
assert.equal(buildManifest(path.join(tmp, 'nope')).files.length, 0);

// Licences.
assert.equal(licenseName('http://creativecommons.org/publicdomain/zero/1.0/'), 'CC0');
assert.equal(licenseName('https://creativecommons.org/licenses/by/4.0/'), 'CC BY 4.0');
assert.equal(licenseName('http://creativecommons.org/licenses/by-nc/3.0/'), 'CC BY-NC');
assert.ok(allowed('http://creativecommons.org/publicdomain/zero/1.0/', 'cc0'));
assert.ok(!allowed('http://creativecommons.org/licenses/by/4.0/', 'cc0'));
assert.ok(allowed('http://creativecommons.org/licenses/by/4.0/', 'by'));
assert.ok(!allowed('http://creativecommons.org/licenses/by-nc/4.0/', 'by'));

// A mock Freesound.
const queries = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.searchParams.get('token') !== 'good' && !url.pathname.startsWith('/audio')) { res.writeHead(401).end('{}'); return; }
  if (url.pathname.startsWith('/audio/')) { res.writeHead(200, { 'content-type': 'audio/mpeg' }).end(Buffer.alloc(5000, 7)); return; }
  const preview = (id) => ({ 'preview-hq-mp3': `http://127.0.0.1:${server.address().port}/audio/${id}.mp3` });
  if (url.pathname === '/api/search/text/') {
    queries.push(url.searchParams.get('query'));
    const query = url.searchParams.get('query');
    const results = query === 'rain loop' ? [
      { id: 1, name: 'Few ratings', username: 'u1', license: 'http://creativecommons.org/licenses/by/4.0/', duration: 120, previews: preview(1), avg_rating: 5, num_ratings: 2, url: 'https://freesound.org/s/1/' },
      { id: 2, name: 'Popular rain', username: 'u2', license: 'http://creativecommons.org/publicdomain/zero/1.0/', duration: 200, previews: preview(2), avg_rating: 4.5, num_ratings: 40, url: 'https://freesound.org/s/2/' },
      { id: 3, name: 'Non-commercial', username: 'u3', license: 'http://creativecommons.org/licenses/by-nc/4.0/', duration: 90, previews: preview(3), avg_rating: 5, num_ratings: 99, url: 'https://freesound.org/s/3/' },
    ] : [];
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ results })); return;
  }
  const one = url.pathname.match(/\/api\/sounds\/(\d+)\//);
  if (one) { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id: Number(one[1]), name: 'Chosen', username: 'me', license: 'http://creativecommons.org/licenses/by/3.0/', duration: 75, previews: preview(one[1]), url: `https://freesound.org/s/${one[1]}/` })); return; }
  res.writeHead(404).end('{}');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const env = { FREESOUND_TOKEN: 'good', FREESOUND_API: `http://127.0.0.1:${server.address().port}/api`, SOUNDS_DIR: path.join(tmp, 'out') };
const out = [];
const log = (t) => out.push(t);

assert.equal(await main([], { ...env, FREESOUND_TOKEN: '' }, fetch, log), 1);
assert.equal(await main(['--list', '--slots', 'rain'], env, fetch, log), 0);
assert.ok(out.some((l) => l.includes('Popular rain')));
assert.ok(!existsSync(path.join(tmp, 'out', 'rain.mp3')), 'list never downloads');

// Download rain: the licence filter drops BY-NC even with the most ratings, the popular CC0 one wins.
out.length = 0;
const code = await main(['--slots', 'rain'], env, fetch, log);
assert.equal(code, 0);
const credits = JSON.parse(readFileSync(path.join(tmp, 'out', 'credits.json'), 'utf8'));
assert.equal(credits.rain.freesoundId, 2); assert.equal(credits.rain.license, 'CC0'); assert.equal(credits.rain.author, 'u2');
assert.equal(readFileSync(path.join(tmp, 'out', 'rain.mp3')).length, 5000);
assert.deepEqual(JSON.parse(readFileSync(path.join(tmp, 'out', 'manifest.json'), 'utf8')).files.map((f) => f.slot), ['rain']);

// Running again skips what exists; a missing slot reports instead of crashing.
out.length = 0;
assert.equal(await main(['--slots', 'rain,thunder'], env, fetch, log), 2);
assert.ok(out.some((l) => l.includes('rain: already there')));
assert.ok(out.some((l) => l.startsWith('thunder:')));

// A chosen id goes to the named slot.
assert.equal(await main(['wind=777'], env, fetch, log), 0);
assert.equal(JSON.parse(readFileSync(path.join(tmp, 'out', 'credits.json'), 'utf8')).wind.freesoundId, 777);
assert.equal(JSON.parse(readFileSync(path.join(tmp, 'out', 'credits.json'), 'utf8')).wind.license, 'CC BY 3.0');

// A bad token is explained.
out.length = 0;
assert.equal(await main(['--slots', 'fire'], { ...env, FREESOUND_TOKEN: 'bad' }, fetch, log), 2);
assert.ok(out.some((l) => l.includes('refused the token')));

server.close();
console.log('recordings tooling: all passed');
