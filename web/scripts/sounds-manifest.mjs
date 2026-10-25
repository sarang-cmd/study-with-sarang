// Builds public/sounds/manifest.json from the files that are in public/sounds, so the app knows what is bundled.
// Runs automatically before every build (see "prebuild"). Credits come from public/sounds/credits.json when it exists.
// Usage: node scripts/sounds-manifest.mjs [folder]
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SLOT_IDS = ['rain', 'thunder', 'waves', 'wind', 'fire', 'birds', 'crickets', 'coffee-shop', 'singing-bowl', 'white-noise'];
export const EXTENSIONS = ['mp3', 'ogg', 'wav', 'flac', 'm4a', 'aac', 'opus', 'webm'];

export function buildManifest(dir) {
  let credits = {};
  const creditFile = path.join(dir, 'credits.json');
  if (existsSync(creditFile)) { try { credits = JSON.parse(readFileSync(creditFile, 'utf8')); } catch { console.warn('credits.json is not valid JSON, ignoring it'); } }
  const files = existsSync(dir) ? readdirSync(dir) : [];
  const out = [];
  for (const slot of SLOT_IDS) {
    // The first extension in the list wins when a slot has several files.
    const file = EXTENSIONS.map((ext) => `${slot}.${ext}`).find((name) => files.includes(name) && statSync(path.join(dir, name)).size > 1024);
    if (!file) continue;
    const c = credits[slot] && typeof credits[slot] === 'object' ? credits[slot] : {};
    const text = (v, n = 200) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : undefined);
    out.push({ slot, file, title: text(c.title), author: text(c.author, 80), license: text(c.license, 60), url: text(c.url, 300),
      freesoundId: Number.isInteger(c.freesoundId) ? c.freesoundId : undefined, seconds: typeof c.seconds === 'number' ? Math.round(c.seconds) : undefined });
  }
  return { version: 1, files: out };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sounds'));
  const manifest = buildManifest(dir);
  writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`sounds: ${manifest.files.length} of ${SLOT_IDS.length} recordings bundled${manifest.files.length ? ` (${manifest.files.map((f) => f.slot).join(', ')})` : ', the generated sounds are used'}`);
  const missing = manifest.files.filter((f) => !f.license).map((f) => f.slot);
  if (missing.length) console.warn(`sounds: no credit information for ${missing.join(', ')}. Add it to public/sounds/credits.json if the licence needs attribution.`);
}
