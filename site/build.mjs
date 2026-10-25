#!/usr/bin/env node
/**
 * Builds the two Vercel deployments (Build Output API v3) for the Sarang suite. Nothing is uploaded here.
 *
 *   node site/build.mjs --study-web <dist> --md-web <dist> --assets <dir with the two .exe files> --out <empty dir>
 *
 * Output:
 *   <out>/study/.vercel/output   project "study-with-sarang": the Study web app, /downloads/, /updates/latest.json, the installer and the helper zip
 *   <out>/md/.vercel/output      project "sarang.md": the Sarang.md web app, /downloads/, /updates/latest.json, its installer, and /study-with-sarang/* shown from the other project
 *
 * The big files stay out of the workspace: --assets and --out live in /var/tmp. No token or secret is read or written here.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadsPage, esc } from './downloads-page.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const mdRoot = process.env.SARANG_MD_ROOT || path.join(root, '..', 'Sarang.md');
const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const need = (name) => { const v = arg(name); if (!v) throw new Error(`Missing ${name}`); return path.resolve(v); };
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

export const HOSTS = { study: 'https://study-with-sarang.vercel.app', md: 'https://sarang-md.vercel.app' };
export const PROJECTS = { study: { id: 'prj_ofovF3nsJWRFIbAw52UVkkIYPfMG', name: 'study-with-sarang' }, md: { id: 'prj_Tp5IgeDDqITRMEq5bagF04meYqYS', name: 'sarang.md' } };
const ORG = 'team_59dr7VIo7kdxnmJ9zpqSL0wv';

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const copyDir = (from, to) => fs.cpSync(from, to, { recursive: true });

/** Facts about every file that is published. */
export function collect({ assets, notes }) {
  const studyPkg = readJson(path.join(root, 'desktop', 'package.json'));
  const studyWeb = readJson(path.join(root, 'web', 'package.json'));
  const mdPkg = readJson(path.join(mdRoot, 'desktop', 'package.json'));
  const mdWeb = readJson(path.join(mdRoot, 'package.json'));
  const helper = readJson(path.join(root, 'desktop', 'extension', 'manifest.json'));
  const exe = (name, version) => {
    const file = path.join(assets, `${name}-${version}.exe`);
    if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Build and sign the installer first.`);
    const head = fs.readFileSync(file).subarray(0, 2).toString('latin1');
    if (head !== 'MZ') throw new Error(`${file} is not a Windows program.`);
    return { file: path.basename(file), path: file, size: fs.statSync(file).size, sha256: sha256(file) };
  };
  return {
    study: { version: studyPkg.version, webVersion: studyWeb.version, ...exe('Study-with-Sarang', studyPkg.version), notes: notes.study.notes, webNotes: notes.study.webNotes },
    md: { version: mdPkg.version, webVersion: mdWeb.version, ...exe('Sarang-md', mdPkg.version), notes: notes.md.notes, webNotes: notes.md.webNotes },
    helper: { version: helper.version, notes: notes.helper.notes },
  };
}

/** The helper as a zip with one folder inside, so "Extract all" gives a folder that Load unpacked accepts. */
function zipHelper(version, outFile) {
  const tmp = fs.mkdtempSync(path.join(path.dirname(outFile), 'zip-'));
  const folder = path.join(tmp, 'Study-with-Sarang-Helper');
  copyDir(path.join(root, 'desktop', 'extension'), folder);
  fs.rmSync(path.join(folder, 'icon.svg'), { force: true });
  fs.writeFileSync(path.join(folder, 'README.txt'), `Study with Sarang Helper ${version}\n\n1. Extract this zip so you have a folder called Study-with-Sarang-Helper.\n2. Open chrome://extensions (Edge: edge://extensions, Brave: brave://extensions) and switch on Developer mode.\n3. Choose Load unpacked and pick the Study-with-Sarang-Helper folder.\n4. In Study with Sarang open Settings, Drift detection, Browser helper, press Pair the extension, then press Connect to the app on the helper's page.\n\nThe helper talks only to the app on this computer (127.0.0.1). More: https://sarang-md.vercel.app/study-with-sarang/downloads/\n`);
  execFileSync('python3', ['-c', 'import sys,zipfile,os\nz=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_DEFLATED)\nfor d,_,fs in os.walk(sys.argv[2]):\n  for f in sorted(fs):\n    p=os.path.join(d,f); z.write(p, os.path.relpath(p, sys.argv[3]))\nz.close()', outFile, folder, tmp]);
  fs.rmSync(tmp, { recursive: true, force: true });
  return { file: path.basename(outFile), path: outFile, size: fs.statSync(outFile).size, sha256: sha256(outFile) };
}

const FEED_HEADERS = { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=0, must-revalidate' };

function writeSite({ key, out, webDist, facts, helperZip, published }) {
  const output = path.join(out, key, '.vercel', 'output');
  const stat = path.join(output, 'static');
  fs.rmSync(path.join(out, key), { recursive: true, force: true });
  fs.mkdirSync(stat, { recursive: true });
  copyDir(webDist, stat);
  const downloads = path.join(stat, 'downloads'); fs.mkdirSync(downloads, { recursive: true });
  const own = key === 'study' ? facts.study : facts.md;
  const base = HOSTS[key];
  const urlOf = (host, file) => `${host}/downloads/${file}`;
  // The files this site serves
  fs.copyFileSync(own.path, path.join(downloads, own.file));
  if (key === 'study') fs.copyFileSync(helperZip.path, path.join(downloads, helperZip.file));
  const links = {
    study: { exe: urlOf(HOSTS.study, facts.study.file), alias: `${HOSTS.study}/downloads/Study-with-Sarang-Windows.exe`, page: `${HOSTS.md}/study-with-sarang/downloads/`, site: `${HOSTS.md}/study-with-sarang/` },
    md: { exe: urlOf(HOSTS.md, facts.md.file), alias: `${HOSTS.md}/downloads/Sarang-md-Windows.exe`, page: `${HOSTS.md}/downloads/`, site: `${HOSTS.md}/` },
    helper: { zip: urlOf(HOSTS.study, helperZip.file), alias: `${HOSTS.study}/downloads/Study-with-Sarang-Helper.zip` },
  };
  links.feed = `${base}/updates/latest.json`;
  fs.writeFileSync(path.join(downloads, 'index.html'), downloadsPage({ primary: key, facts, helperZip, links, published }));
  const sums = [[own.sha256, own.file], ...(key === 'study' ? [[helperZip.sha256, helperZip.file]] : [])].map(([h, f]) => `${h} *${f}`).join('\n') + '\n';
  fs.writeFileSync(path.join(downloads, 'SHA256SUMS.txt'), sums);
  // The update feed the desktop apps and the web update note read
  const app = key === 'study' ? { id: 'study-with-sarang', facts: facts.study } : { id: 'sarang-md', facts: facts.md };
  const feed = {
    schema: 1, app: app.id, version: app.facts.version, published, notes: app.facts.notes, page: links[key].page,
    windows: { file: own.file, url: links[key].exe, size: own.size, sha256: own.sha256 },
    web: { version: app.facts.webVersion, notes: app.facts.webNotes },
    ...(key === 'study' ? { extension: { version: helperZip.version, file: helperZip.file, url: links.helper.zip, size: helperZip.size, sha256: helperZip.sha256, notes: facts.helper.notes } } : {}),
  };
  fs.mkdirSync(path.join(stat, 'updates'), { recursive: true });
  fs.writeFileSync(path.join(stat, 'updates', 'latest.json'), JSON.stringify(feed, null, 2) + '\n');
  // Routes
  const attach = (file) => ({ 'content-disposition': `attachment; filename="${file}"`, 'x-content-type-options': 'nosniff', 'access-control-allow-origin': '*' });
  const routes = [];
  routes.push({ src: '^/updates/latest\\.json$', headers: FEED_HEADERS, continue: true });
  routes.push({ src: '^/downloads/SHA256SUMS\\.txt$', headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' }, continue: true });
  routes.push({ src: '^/downloads$', status: 308, headers: { Location: '/downloads/' } });
  if (key === 'md') {
    routes.push({ src: '^/study-with-sarang$', status: 308, headers: { Location: '/study-with-sarang/' } });
    routes.push({ src: '^/study-with-sarang/downloads$', status: 308, headers: { Location: '/study-with-sarang/downloads/' } });
  }
  // Stable names that always give the newest build
  const aliasName = key === 'study' ? 'Study-with-Sarang-Windows.exe' : 'Sarang-md-Windows.exe';
  routes.push({ src: `^/downloads/${aliasName.replace(/\./g, '\\.')}$`, dest: `/downloads/${own.file}`, headers: attach(aliasName), check: true });
  routes.push({ src: `^/downloads/${own.file.replace(/\./g, '\\.')}$`, headers: { ...attach(own.file), 'cache-control': 'public, max-age=31536000, immutable' }, continue: true });
  if (key === 'study') {
    routes.push({ src: '^/downloads/Study-with-Sarang-Helper\\.zip$', dest: `/downloads/${helperZip.file}`, headers: attach('Study-with-Sarang-Helper.zip'), check: true });
    routes.push({ src: `^/downloads/${helperZip.file.replace(/\./g, '\\.')}$`, headers: attach(helperZip.file), continue: true });
  }
  routes.push({ handle: 'filesystem' });
  if (key === 'md') routes.push({ src: '^/study-with-sarang/(.*)$', dest: `${HOSTS.study}/$1` });
  routes.push({ handle: 'error' }, { status: 404, src: '^(?!/api).*$', dest: '/404.html' });
  fs.writeFileSync(path.join(stat, '404.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:480px;margin:18vh auto;padding:0 20px;color:#161616"><h1 style="font-size:22px">That page is not here</h1><p>Try the <a href="${esc(links.md.site)}">Sarang.md</a> site, <a href="${esc(links.study.site)}">Study with Sarang</a>, or the <a href="${esc(links[key].page)}">downloads</a>.</p></body>`);
  fs.writeFileSync(path.join(output, 'config.json'), JSON.stringify({ version: 3, routes }, null, 2) + '\n');
  fs.writeFileSync(path.join(out, key, '.vercel', 'project.json'), JSON.stringify({ projectId: PROJECTS[key].id, orgId: ORG }) + '\n');
  return { feed, dir: path.join(out, key) };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const out = need('--out'); const assets = need('--assets');
  if (out.startsWith(root) || out.startsWith(mdRoot)) throw new Error('Build into /var/tmp, not into the workspace: the files are large.');
  fs.mkdirSync(out, { recursive: true });
  const notes = readJson(path.join(here, 'releases.json'));
  const facts = collect({ assets, notes });
  const helperZip = { ...zipHelper(facts.helper.version, path.join(out, `Study-with-Sarang-Helper-${facts.helper.version}.zip`)), version: facts.helper.version };
  const published = arg('--published') || new Date().toISOString();
  const study = writeSite({ key: 'study', out, webDist: need('--study-web'), facts, helperZip, published });
  const md = writeSite({ key: 'md', out, webDist: need('--md-web'), facts, helperZip, published });
  console.log(JSON.stringify({ study: { dir: study.dir, version: facts.study.version, sha256: facts.study.sha256 }, md: { dir: md.dir, version: facts.md.version, sha256: facts.md.sha256 }, helper: { version: helperZip.version, sha256: helperZip.sha256 } }, null, 2));
}
