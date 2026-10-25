// Finds and downloads real recordings from freesound.org for the ten ambience slots.
//
//   FREESOUND_TOKEN=xxxx node scripts/fetch-freesound.mjs --list            show the best candidates for every slot
//   FREESOUND_TOKEN=xxxx node scripts/fetch-freesound.mjs                   download the top pick for every missing slot
//   FREESOUND_TOKEN=xxxx node scripts/fetch-freesound.mjs rain=123456       download one chosen sound into one slot
//   node scripts/fetch-freesound.mjs --slots rain,thunder --license cc0     only some slots, only CC0
//
// Get a token (free) at https://freesound.org/apiv2/apply . This uses the high-quality MP3 previews that a token can
// download directly. Full originals need a sign-in (OAuth2); you can always drop those into public/sounds by hand.
// The licence and author of every file are written to public/sounds/credits.json and shown in the app.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, SLOT_IDS } from './sounds-manifest.mjs';

export const QUERIES = {
  rain: ['rain loop', 'rain ambience steady', 'rainfall on roof'],
  thunder: ['distant thunder', 'thunderstorm rumble', 'thunder rolling'],
  waves: ['ocean waves shore', 'sea waves beach ambience', 'waves loop'],
  wind: ['wind ambience', 'wind howling soft', 'wind through trees'],
  fire: ['fireplace crackling', 'campfire crackle loop', 'fire burning'],
  birds: ['birdsong forest morning', 'birds chirping ambience', 'dawn chorus'],
  crickets: ['crickets night ambience', 'cricket chirping loop', 'summer night insects'],
  'coffee-shop': ['coffee shop ambience', 'cafe background chatter', 'restaurant ambience murmur'],
  'singing-bowl': ['singing bowl', 'tibetan bowl', 'meditation bowl drone'],
  'white-noise': ['white noise', 'white noise loop', 'pink noise'],
};
const LICENSES = {
  cc0: 'license:"Creative Commons 0"',
  by: 'license:("Creative Commons 0" OR "Attribution")',
};
export const licenseName = (url = '') => /publicdomain\/zero/.test(url) ? 'CC0' : /\/by\/(\d)/.test(url) ? `CC BY ${url.match(/\/by\/([\d.]+)/)?.[1] ?? ''}`.trim() : /by-nc/.test(url) ? 'CC BY-NC' : /sampling/.test(url) ? 'Sampling+' : url;
export const allowed = (url = '', mode = 'by') => /publicdomain\/zero/.test(url) || (mode === 'by' && /\/licenses\/by\/\d/.test(url));

export async function search(api, token, query, { mode = 'by', min = 60, max = 600, size = 15, fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({ query, page_size: String(size), sort: 'rating_desc', token,
    filter: `duration:[${min} TO ${max}] ${LICENSES[mode]}`, fields: 'id,name,username,license,duration,previews,url,avg_rating,num_ratings,channels' });
  const response = await fetchImpl(`${api}/search/text/?${params}`);
  if (response.status === 401 || response.status === 403) throw new Error('Freesound refused the token. Check FREESOUND_TOKEN.');
  if (!response.ok) throw new Error(`Freesound answered ${response.status}`);
  const data = await response.json();
  return (data.results ?? []).filter((r) => allowed(r.license, mode) && r.previews?.['preview-hq-mp3']);
}

export async function lookup(api, token, id, fetchImpl = fetch) {
  const response = await fetchImpl(`${api}/sounds/${id}/?${new URLSearchParams({ token, fields: 'id,name,username,license,duration,previews,url' })}`);
  if (!response.ok) throw new Error(`Sound ${id}: Freesound answered ${response.status}`);
  return response.json();
}

async function download(url, file, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

export async function main(argv, env = process.env, fetchImpl = fetch, log = console.log) {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dir = path.resolve(env.SOUNDS_DIR ?? path.join(root, 'public', 'sounds'));
  const api = (env.FREESOUND_API ?? 'https://freesound.org/apiv2').replace(/\/+$/, '');
  const token = env.FREESOUND_TOKEN;
  if (!token) { log('Set FREESOUND_TOKEN first. Get one free at https://freesound.org/apiv2/apply'); return 1; }
  const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const list = argv.includes('--list'), force = argv.includes('--force');
  const mode = flag('--license') === 'cc0' ? 'cc0' : 'by';
  const wanted = (flag('--slots') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const chosen = Object.fromEntries(argv.filter((a) => /^[a-z-]+=\d+$/.test(a)).map((a) => a.split('=')));
  mkdirSync(dir, { recursive: true });
  const creditFile = path.join(dir, 'credits.json');
  const credits = existsSync(creditFile) ? JSON.parse(readFileSync(creditFile, 'utf8')) : {};
  const have = new Set(buildManifest(dir).files.map((f) => f.slot));
  const slots = SLOT_IDS.filter((slot) => (wanted.length ? wanted.includes(slot) : true) && (Object.keys(chosen).length ? slot in chosen : true));
  let failed = 0;
  for (const slot of slots) {
    try {
      if (!list && have.has(slot) && !force && !(slot in chosen)) { log(`${slot}: already there (use --force to replace)`); continue; }
      let pick;
      if (chosen[slot]) pick = await lookup(api, token, chosen[slot], fetchImpl);
      else {
        let results = [];
        for (const query of QUERIES[slot]) { results = await search(api, token, query, { mode, fetchImpl, min: slot === 'singing-bowl' ? 30 : 60 }); if (results.length) { if (list) { log(`\n${slot}  (search: ${query})`); results.slice(0, 6).forEach((r) => log(`  ${String(r.id).padEnd(9)} ${Math.round(r.duration)}s  ${licenseName(r.license).padEnd(8)} ${(r.avg_rating ?? 0).toFixed(1)}/5 (${r.num_ratings ?? 0})  ${r.name} by ${r.username}`)); } break; } }
        if (list) { if (!results.length) log(`\n${slot}: nothing found`); continue; }
        // Prefer many ratings, then rating, then a length that makes a seamless loop easy.
        pick = [...results].sort((a, b) => (b.num_ratings ?? 0) - (a.num_ratings ?? 0) || (b.avg_rating ?? 0) - (a.avg_rating ?? 0))[0];
      }
      if (!pick || !pick.previews?.['preview-hq-mp3']) throw new Error('no usable sound');
      if (!allowed(pick.license, mode) && !chosen[slot]) throw new Error('licence not allowed');
      await download(pick.previews['preview-hq-mp3'], path.join(dir, `${slot}.mp3`), fetchImpl);
      credits[slot] = { title: pick.name, author: pick.username, license: licenseName(pick.license), url: pick.url ?? `https://freesound.org/s/${pick.id}/`, freesoundId: pick.id, seconds: pick.duration };
      log(`${slot}: ${pick.name} by ${pick.username} (${licenseName(pick.license)}, ${Math.round(pick.duration)} s)`);
      if (/by-nc|sampling/.test(pick.license ?? '')) log(`  note: ${licenseName(pick.license)} does not allow commercial use`);
    } catch (error) { failed += 1; log(`${slot}: ${error.message}`); }
  }
  if (!list) {
    writeFileSync(creditFile, `${JSON.stringify(credits, null, 2)}\n`);
    writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify(buildManifest(dir), null, 2)}\n`);
    log(`\nDone. ${failed ? `${failed} slot(s) need attention. ` : ''}Run the app or "npm run build" to use them.`);
  }
  return failed ? 2 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
