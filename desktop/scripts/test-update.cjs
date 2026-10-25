'use strict';
// Update logic: release parsing, safe downloads, the updater's decisions and the rollback of a failed install.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const core = require('../electron/update-core.cjs');
const { createUpdater } = require('../electron/updater.cjs');
const installer = require('../electron/installer-core.cjs');
const { startMockFeed } = require('./_mock-feed.cjs');
const { sanitize } = require('../electron/settings.cjs');

const pass = (m) => console.log(`PASS ${m}`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-update-'));
const local = { allow: (u) => u.hostname === '127.0.0.1' };
let feed = '';

(async () => {
  // Versions and repository names
  assert.equal(core.compare('1.2.0', '1.1.9'), 1); assert.equal(core.compare('v1.10.0', '1.9.0'), 1); assert.equal(core.compare('1.2.0', '1.2.0'), 0); assert.equal(core.compare('1.0.0', '1.0.1'), -1);
  assert.equal(core.parseVersion('1.2'), null); assert.equal(core.parseVersion('1.2.3-beta'), null); assert.equal(core.compare('nope', '1.0.0'), 0);
  assert.equal(core.cleanFeed(' https://study-with-sarang.vercel.app/updates/latest.json#x '), 'https://study-with-sarang.vercel.app/updates/latest.json'); assert.equal(core.cleanFeed('http://a.vercel.app/x'), ''); assert.equal(core.cleanFeed('https://evil.test/updates/latest.json'), ''); assert.equal(core.cleanFeed('https://u:p@a.vercel.app/x'), ''); assert.equal(core.cleanFeed('o/r'), ''); assert.equal(core.cleanFeed(''), '');
  pass('version order and feed addresses');

  // Hosts: only https vercel.app addresses by default, including after a redirect
  assert.equal(core.strictHttps(new URL('https://study-with-sarang.vercel.app/x')), true); assert.equal(core.strictHttps(new URL('http://study-with-sarang.vercel.app/x')), false);
  assert.equal(core.strictHttps(new URL('https://vercel.app.evil.test/x')), false); assert.equal(core.strictHttps(new URL('https://evil.test/vercel.app')), false); assert.equal(core.strictHttps(new URL('https://notvercel.app/x')), false);
  await assert.rejects(core.get('http://127.0.0.1:1/x'), /allowed/);
  pass('only https vercel.app addresses are allowed');

  const gh = await startMockFeed();
  try {
    feed = `${gh.url}/updates/latest.json`;
    // Reading the feed
    let r = (await core.fetchLatest(feed, local)).release;
    assert.equal(r.version, '9.9.9'); assert.equal(r.file.name, 'Study-with-Sarang-9.9.9.exe'); assert.equal(r.file.size, gh.state.body.length); assert.match(r.notes, /calmer/); assert.equal(r.file.sha256, gh.state.sha);
    gh.state.none = true; assert.equal((await core.fetchLatest(feed, local)).none, true); gh.state.none = false;
    gh.state.rateLimit = true; await assert.rejects(core.fetchLatest(feed, local), /answered 503/); gh.state.rateLimit = false;
    assert.equal(core.pickRelease({ version: '2.0.0', windows: { file: 'evil.exe', sha256: 'a'.repeat(64) } }).file, null);
    assert.equal(core.pickRelease({ version: '2.0.0', windows: { file: 'Study-with-Sarang-1.0.0.exe' } }).file, null);
    assert.equal(core.pickRelease({ version: 'next' }), null); assert.equal(core.pickRelease(null), null);
    assert.equal(core.pickRelease({ version: '2.0.0', windows: { file: 'Study-with-Sarang-2.0.0.exe', sha256: 'zz' } }, 'https://a.vercel.app/updates/latest.json').file.sha256, '');
    assert.equal(core.pickRelease({ version: '2.0.0', windows: { file: 'Study-with-Sarang-2.0.0.exe', sha256: 'a'.repeat(64) } }, 'https://a.vercel.app/updates/latest.json').file.url, 'https://a.vercel.app/updates/Study-with-Sarang-2.0.0.exe');
    pass('feed parsing ignores versions and files that are not ours');

    // The checksum comes from the feed and nothing is installed without one
    gh.state.noHash = true; r = (await core.fetchLatest(feed, local)).release; assert.equal(await core.resolveHash(r.file, local), ''); gh.state.noHash = false;
    r = (await core.fetchLatest(feed, local)).release; assert.equal(await core.resolveHash(r.file, local), gh.state.sha);
    pass('the SHA-256 is read from the feed');

    // Downloads, including the failure cases
    const dest = path.join(tmp, 'dl', 'Study-with-Sarang-9.9.9.exe');
    const steps = []; r = (await core.fetchLatest(feed, local)).release;
    const out = await core.download({ url: r.file.url, dest, sha256: gh.state.sha, size: r.file.size, onProgress: (p) => steps.push(p), ...local });
    assert.equal(out.bytes, gh.state.body.length); assert.ok(fs.readFileSync(dest).equals(gh.state.body)); assert.equal(steps.at(-1), 100); assert.ok(!fs.existsSync(`${dest}.part`));
    pass('a verified file is downloaded through a redirect');
    fs.rmSync(path.dirname(dest), { recursive: true });
    await assert.rejects(core.download({ url: r.file.url, dest, sha256: 'b'.repeat(64), size: r.file.size, ...local }), /checksum/);
    assert.ok(!fs.existsSync(dest) && !fs.existsSync(`${dest}.part`), 'a mismatching file is deleted');
    await assert.rejects(core.download({ url: r.file.url, dest, sha256: '', size: r.file.size, ...local }), /no checksum/);
    gh.state.mode = 'notexe'; await assert.rejects(core.download({ url: r.file.url, dest, sha256: gh.state.sha, size: r.file.size, ...local }), /not a Windows program/);
    gh.state.mode = 'truncate'; await assert.rejects(core.download({ url: r.file.url, dest, sha256: gh.state.sha, size: r.file.size, ...local }));
    gh.state.mode = 'ok'; assert.ok(!fs.existsSync(dest) && !fs.existsSync(`${dest}.part`));
    await assert.rejects(core.download({ url: r.file.url, dest, sha256: gh.state.sha, size: r.file.size + 1, ...local }), /size/);
    pass('wrong checksum, wrong type, short or odd-sized downloads are refused and cleaned up');

    // The updater
    const settings = sanitize({ updateRepo: feed });
    let data = settings; const store = { get: () => data, patch: (p) => { data = sanitize({ ...data, ...p }); return data; } };
    const events = []; const toasts = []; const spawned = []; let quit = 0; let installDir = path.join(tmp, 'installed');
    const make = (extra = {}) => createUpdater({
      version: '1.2.0', store, send: (s) => events.push(s.status), notify: (m) => toasts.push(m), openExternal: () => {}, installDir: () => installDir, canSelfUpdate: () => true,
      quit: () => { quit += 1; }, spawn: (...a) => { spawned.push(a); return { unref() {}, on() {} }; }, tmpdir: path.join(tmp, 'tmpdir'), net: local, ...extra,
    });
    let u = make();
    assert.equal((await u.check()).status, 'available'); assert.equal(u.get().latest, '9.9.9'); assert.equal(u.get().canUpdate, true); assert.equal(toasts.length, 1);
    await u.check(); assert.equal(toasts.length, 1, 'the same version does not notify twice');
    gh.state.latest = '1.2.0'; assert.equal((await u.check()).status, 'uptodate');
    gh.state.latest = '1.1.0'; assert.equal((await u.check()).status, 'uptodate'); gh.state.latest = '9.9.9';
    await u.check();
    const result = await u.install();
    assert.equal(result.status, 'launching'); assert.equal(spawned.length, 1);
    assert.equal(spawned[0][0], path.join(tmp, 'tmpdir', 'swa-update', 'Study-with-Sarang-9.9.9.exe')); assert.deepEqual(spawned[0][1], ['--update', `--update-dir=${installDir}`]);
    await new Promise((r2) => setTimeout(r2, 900)); assert.equal(quit, 1);
    pass('the updater finds, downloads and hands over to the new setup, then quits');

    // Bad checksum leaves the app running and offers a retry
    spawned.length = 0; quit = 0; u = make(); gh.state.mode = 'badhash'; await u.check();
    const bad = await u.install(); assert.equal(bad.status, 'available'); assert.match(bad.error, /checksum/); assert.equal(spawned.length, 0); await new Promise((r2) => setTimeout(r2, 800)); assert.equal(quit, 0);
    gh.state.mode = 'ok';
    pass('a bad download never starts the installer and the app keeps running');

    // Skip, not installed, not configured, validation
    u = make(); await u.check(); await u.skip(); assert.equal(data.updateSkip, '9.9.9');
    u = make(); const quiet = await u.check(); assert.equal(quiet.dismissed, true); assert.equal((await u.check({ manual: true })).dismissed, false);
    u = make({ canSelfUpdate: () => false }); await u.check(); assert.equal(u.get().canUpdate, false); spawned.length = 0; await u.install(); assert.equal(spawned.length, 0);
    u = make({ installDir: () => null }); await u.check(); const nodir = await u.install(); assert.equal(nodir.status, 'error');
    data = sanitize({}); u = make(); assert.equal((await u.check()).status, 'unconfigured');
    assert.match(u.setConfig({ repo: 'not a feed' }).error, /vercel\.app/); assert.equal(u.setConfig({ repo: `${gh.url}/updates/latest.json` }).repo, `${gh.url}/updates/latest.json`); assert.equal(data.updateRepo, `${gh.url}/updates/latest.json`);
    u = make(); u.setConfig({ auto: false }); assert.equal(data.updateAuto, false); data = sanitize({ updateRepo: feed });
    u = make({ disabled: true }); assert.equal(u.get().disabled, true);
    pass('skip, copies that cannot self-update, missing setup and bad feed addresses');

    // Automatic checks run on a timer
    data = sanitize({ updateRepo: feed }); const before = gh.state.hits.length; u = make({ firstCheckMs: 30, intervalMs: 60000 }); u.schedule();
    await new Promise((r2) => setTimeout(r2, 400)); u.stop(); assert.ok(gh.state.hits.length > before, 'the scheduled check ran');
    data = sanitize({ updateRepo: feed, updateAuto: false }); const h2 = gh.state.hits.length; u = make({ firstCheckMs: 30 }); u.schedule(); await new Promise((r2) => setTimeout(r2, 200)); u.stop(); assert.equal(gh.state.hits.length, h2, 'no check when background checks are off');
    pass('background checks follow the setting');
  } finally { await gh.close(); }

  // A failed install puts the old version back
  const source = path.join(tmp, 'new'); fs.mkdirSync(source); fs.writeFileSync(path.join(source, 'Study with Sarang.exe'), 'NEW'); fs.writeFileSync(path.join(source, 'a.txt'), 'new-a');
  const dest = path.join(tmp, 'Programs', 'Study with Sarang'); fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'Study with Sarang.exe'), 'OLD'); fs.writeFileSync(path.join(dest, 'install.json'), JSON.stringify({ version: '1.0.0' })); fs.writeFileSync(path.join(dest, 'old.txt'), 'old');
  const base = { source, dest, appName: 'Study with Sarang', version: '2.0.0', options: {} };
  await assert.rejects(installer.install({ ...base, ops: { exeName: 'Study with Sarang.exe', createShortcuts: async () => { throw new Error('shortcut failed'); } } }), /shortcut failed/);
  assert.equal(fs.readFileSync(path.join(dest, 'Study with Sarang.exe'), 'utf8'), 'OLD'); assert.equal(fs.readFileSync(path.join(dest, 'old.txt'), 'utf8'), 'old'); assert.ok(!fs.existsSync(path.join(dest, 'a.txt'))); assert.ok(!fs.existsSync(`${dest}.previous`));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dest, 'install.json'), 'utf8')).version, '1.0.0');
  pass('a failed update puts the previous version back');
  await installer.install({ ...base, ops: { exeName: 'Study with Sarang.exe' } });
  assert.equal(fs.readFileSync(path.join(dest, 'Study with Sarang.exe'), 'utf8'), 'NEW'); assert.ok(!fs.existsSync(path.join(dest, 'old.txt'))); assert.ok(!fs.existsSync(`${dest}.previous`));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dest, 'install.json'), 'utf8')).version, '2.0.0');
  pass('a good update replaces the files and leaves no backup behind');

  assert.equal(sanitize({ updateRepo: 5, updateAuto: 'x', updateSkip: 'v'.repeat(50) }).updateRepo, ''); assert.equal(sanitize({}).updateAuto, true);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('Verified updates: versions, hosts, checksums, downloads, the updater and rollback.');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
