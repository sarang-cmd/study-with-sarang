// Checks what would be deployed, without uploading anything: feeds, hashes, links, and how the routes treat the important addresses.
// Run: node site/test-site.mjs   (uses small fake installers in a temporary folder)
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.join(here, '..');
const mdRoot = process.env.SARANG_MD_ROOT || path.join(root, '..', 'Sarang.md');
const require = createRequire(import.meta.url);
const pass = (m) => console.log(`PASS ${m}`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'site-test-'));
const assets = path.join(tmp, 'assets'); fs.mkdirSync(assets);
const ver = (file) => JSON.parse(fs.readFileSync(file, 'utf8')).version;
const sv = ver(path.join(root, 'desktop', 'package.json')); const mv = ver(path.join(mdRoot, 'desktop', 'package.json'));
fs.writeFileSync(path.join(assets, `Study-with-Sarang-${sv}.exe`), Buffer.concat([Buffer.from('MZ'), crypto.randomBytes(3000)]));
fs.writeFileSync(path.join(assets, `Sarang-md-${mv}.exe`), Buffer.concat([Buffer.from('MZ'), crypto.randomBytes(4000)]));
const fakeStudy = path.join(tmp, 'study-dist'); const fakeMd = path.join(tmp, 'md-dist');
for (const d of [fakeStudy, fakeMd]) { fs.mkdirSync(path.join(d, 'assets'), { recursive: true }); fs.writeFileSync(path.join(d, 'index.html'), '<!doctype html><title>app</title>'); }
const out = path.join(tmp, 'out');
const printed = execFileSync('node', [path.join(here, 'build.mjs'), '--study-web', fakeStudy, '--md-web', fakeMd, '--assets', assets, '--out', out, '--published', '2026-10-25T10:00:00.000Z'], { encoding: 'utf8' });
const built = JSON.parse(printed);
const site = (k) => path.join(out, k, '.vercel', 'output');
const feed = (k) => JSON.parse(fs.readFileSync(path.join(site(k), 'static', 'updates', 'latest.json'), 'utf8'));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// ---- the feeds, read by the apps' own update code
const studyCore = require(path.join(root, 'desktop', 'electron', 'update-core.cjs'));
const mdCore = require(path.join(mdRoot, 'desktop', 'electron', 'update-core.cjs'));
const sf = feed('study'); const mf = feed('md');
const sr = studyCore.pickRelease(sf, 'https://study-with-sarang.vercel.app/updates/latest.json');
assert.ok(sr, 'Study reads its own feed'); assert.equal(sr.version, sv); assert.equal(sr.file.sha256, sf.windows.sha256); assert.equal(sr.file.size, sf.windows.size);
assert.match(sr.file.url, /^https:\/\/study-with-sarang\.vercel\.app\/downloads\/Study-with-Sarang-\d+\.\d+\.\d+\.exe$/);
const mr = mdCore.pickRelease(mf, 'https://sarang-md.vercel.app/updates/latest.json');
assert.ok(mr, 'Sarang.md reads its own feed'); assert.equal(mr.version, mv); assert.equal(mr.file.sha256, mf.windows.sha256);
assert.match(mr.file.url, /^https:\/\/sarang-md\.vercel\.app\/downloads\/Sarang-md-\d+\.\d+\.\d+\.exe$/);
assert.equal(sf.web.version, ver(path.join(root, 'web', 'package.json'))); assert.equal(mf.web.version, ver(path.join(mdRoot, 'package.json')));
pass('both feeds are read by the apps\' own updaters, with the right files and web versions');

// ---- hashes and files
const sExe = path.join(site('study'), 'static', 'downloads', sf.windows.file); const mExe = path.join(site('md'), 'static', 'downloads', mf.windows.file);
assert.equal(sha(sExe), sf.windows.sha256); assert.equal(fs.statSync(sExe).size, sf.windows.size); assert.equal(sha(mExe), mf.windows.sha256);
assert.equal(built.study.sha256, sf.windows.sha256);
const zip = path.join(site('study'), 'static', 'downloads', sf.extension.file); assert.equal(sha(zip), sf.extension.sha256);
const names = execFileSync('python3', ['-c', 'import zipfile,sys;print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', zip], { encoding: 'utf8' }).trim().split('\n');
for (const f of ['manifest.json', 'background.js', 'lib.js', 'popup.html', 'options.html', 'README.txt']) assert.ok(names.includes(`Study-with-Sarang-Helper/${f}`), `${f} in the zip`);
assert.ok(!names.some((n) => n.endsWith('icon.svg')));
assert.equal(sf.extension.version, ver(path.join(root, 'desktop', 'extension', 'manifest.json')));
assert.ok(!fs.existsSync(path.join(site('md'), 'static', 'downloads', sf.extension.file)), 'the helper is hosted once');
const sums = fs.readFileSync(path.join(site('study'), 'static', 'downloads', 'SHA256SUMS.txt'), 'utf8'); assert.ok(sums.includes(`${sf.windows.sha256} *${sf.windows.file}`) && sums.includes(`${sf.extension.sha256} *${sf.extension.file}`));
pass('installers and the helper zip match the published SHA-256, the zip has a folder inside');

// ---- the pages
for (const k of ['study', 'md']) {
  const html = fs.readFileSync(path.join(site(k), 'static', 'downloads', 'index.html'), 'utf8');
  for (const needle of [sf.windows.sha256, mf.windows.sha256, sf.extension.sha256, 'Download for Windows', 'Study-with-Sarang-Windows.exe', 'Sarang-md-Windows.exe', 'Study-with-Sarang-Helper.zip', 'Load unpacked', 'SmartScreen']) assert.ok(html.includes(needle), `${k} page mentions ${needle}`);
  assert.ok(!/<script[^>]+src=|<link[^>]+href="https?:|<img/.test(html), 'self-contained: no external scripts, styles or images');
}
const studyPage = fs.readFileSync(path.join(site('study'), 'static', 'downloads', 'index.html'), 'utf8');
assert.ok(studyPage.indexOf('id="study"') < studyPage.indexOf('id="md"'), 'Study first on its own page');
const mdPage = fs.readFileSync(path.join(site('md'), 'static', 'downloads', 'index.html'), 'utf8');
assert.ok(mdPage.indexOf('id="md"') < mdPage.indexOf('id="study"'), 'Sarang.md first on its own page');
pass('both download pages list both apps and the helper with checksums, each leading with its own');

// ---- nothing points at GitHub
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const k of ['study', 'md']) for (const f of walk(site(k))) { if (/\.(html|json|txt)$/.test(f)) assert.ok(!/github\.(com|io)/i.test(fs.readFileSync(f, 'utf8')), `no GitHub in ${path.relative(out, f)}`); }
pass('no GitHub address in any page, feed or route');

// ---- routes: a small model of how Vercel reads the Build Output routes
function resolve(key, url) {
  const routes = JSON.parse(fs.readFileSync(path.join(site(key), 'config.json'), 'utf8')).routes; const stat = path.join(site(key), 'static');
  let pathname = url; const headers = {}; let phase = 'pre';
  const exists = (p) => { const f = path.join(stat, p); return fs.existsSync(f) && fs.statSync(f).isFile() ? true : fs.existsSync(path.join(f, 'index.html')); };
  for (let i = 0; i < routes.length; i += 1) {
    const r = routes[i];
    if (r.handle === 'filesystem') { if (exists(pathname)) return { status: 200, file: pathname, headers }; phase = 'post'; continue; }
    if (r.handle === 'error') break;
    const m = new RegExp(r.src).exec(pathname); if (!m) continue;
    Object.assign(headers, r.headers ?? {});
    if (r.status && r.status >= 300 && r.status < 400) return { status: r.status, location: r.headers.Location, headers };
    if (r.dest) {
      const dest = r.dest.replace(/\$(\d)/g, (_, n) => m[Number(n)] ?? '');
      if (/^https?:/.test(dest)) return { status: 200, proxy: dest, headers };
      pathname = dest; if (r.check && exists(pathname)) return { status: 200, file: pathname, headers };
    }
  }
  return { status: 404, headers };
}
assert.equal(resolve('md', '/study-with-sarang').location, '/study-with-sarang/');
assert.equal(resolve('md', '/study-with-sarang/downloads').location, '/study-with-sarang/downloads/');
assert.equal(resolve('md', '/study-with-sarang/').proxy, 'https://study-with-sarang.vercel.app/');
assert.equal(resolve('md', '/study-with-sarang/assets/x.js').proxy, 'https://study-with-sarang.vercel.app/assets/x.js');
assert.equal(resolve('md', '/study-with-sarang/updates/latest.json').proxy, 'https://study-with-sarang.vercel.app/updates/latest.json');
assert.equal(resolve('md', '/downloads').location, '/downloads/'); assert.equal(resolve('study', '/downloads').location, '/downloads/');
assert.equal(resolve('md', '/').file, '/'); assert.equal(resolve('study', '/').file, '/');
assert.equal(resolve('md', '/downloads/').file, '/downloads/');
const alias = resolve('md', '/downloads/Sarang-md-Windows.exe'); assert.equal(alias.file, `/downloads/${mf.windows.file}`); assert.match(alias.headers['content-disposition'], /attachment; filename="Sarang-md-Windows\.exe"/);
const salias = resolve('study', '/downloads/Study-with-Sarang-Windows.exe'); assert.equal(salias.file, `/downloads/${sf.windows.file}`);
assert.equal(resolve('study', '/downloads/Study-with-Sarang-Helper.zip').file, `/downloads/${sf.extension.file}`);
assert.equal(resolve('study', `/downloads/${sf.windows.file}`).file, `/downloads/${sf.windows.file}`);
assert.equal(resolve('study', '/updates/latest.json').headers['access-control-allow-origin'], '*'); assert.equal(resolve('md', '/updates/latest.json').headers['access-control-allow-origin'], '*');
assert.equal(resolve('md', '/nope').status, 404); assert.equal(resolve('study', '/study-with-sarang/').status, 404, 'the Study site does not loop back to itself');
pass('routes: the Study path is shown on the Sarang.md address, redirects keep the path, stable download names give the newest file, the feeds allow other sites');

// ---- what goes where
for (const k of ['study', 'md']) { const p = JSON.parse(fs.readFileSync(path.join(out, k, '.vercel', 'project.json'), 'utf8')); assert.deepEqual(Object.keys(p).sort(), ['orgId', 'projectId']); }
assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'study', '.vercel', 'project.json'), 'utf8')).projectId, 'prj_ofovF3nsJWRFIbAw52UVkkIYPfMG');
assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'md', '.vercel', 'project.json'), 'utf8')).projectId, 'prj_Tp5IgeDDqITRMEq5bagF04meYqYS');
assert.throws(() => execFileSync('node', [path.join(here, 'build.mjs'), '--study-web', fakeStudy, '--md-web', fakeMd, '--assets', assets, '--out', path.join(root, 'site-out')], { stdio: 'pipe' }), /workspace|Build into/);
pass('project files carry only ids, and building into the workspace is refused');
fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(path.join(root, 'site-out'), { recursive: true, force: true });
console.log('Verified the site build: feeds, hashes, pages, routes.');
