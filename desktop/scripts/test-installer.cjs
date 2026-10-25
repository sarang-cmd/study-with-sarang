'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const core = require('../electron/installer-core.cjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-inst-'));
const w = (file, text = 'x') => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const source = path.join(tmp, 'extracted');
w(path.join(source, 'Study with Sarang.exe'), 'EXE'.repeat(1000));
w(path.join(source, 'resources', 'app.asar'), 'A'.repeat(50000));
w(path.join(source, 'locales', 'en-US.pak'), 'L'.repeat(2000));

(async () => {
  const calls = []; const events = [];
  const ops = { exeName: 'Study with Sarang.exe', stopRunning: async (p) => calls.push(['stop', path.basename(p)]), createShortcuts: async (a) => calls.push(['shortcuts', a.options.desktop, a.options.startMenu]), register: async (a) => calls.push(['register', a.version]), applyOptions: async (a) => calls.push(['options', a.options.autostart]), removeShortcuts: async () => calls.push(['rmshort']), unregister: async () => calls.push(['unreg']), removeLogin: async () => calls.push(['rmlogin']), scheduleDelete: async (t) => { calls.push(['delete', t.length]); for (const x of t) await core.removeDir(x); } };

  // Fresh install into a new folder.
  const dest = path.join(tmp, 'Programs', 'Study with Sarang');
  const options = { desktop: true, startMenu: false, autostart: true };
  const r = await core.install({ source, dest, appName: 'Study with Sarang', version: '1.1.0', options, ops, onProgress: (p) => events.push(p) });
  assert.equal(r.target, dest); assert.equal(r.files, 3);
  assert.ok(fs.existsSync(path.join(dest, 'resources', 'app.asar')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dest, 'install.json'), 'utf8')).version, '1.1.0');
  assert.equal(fs.readFileSync(path.join(dest, 'resources', 'app.asar'), 'utf8').length, 50000);
  const percents = events.map((e) => e.percent);
  assert.deepEqual(percents, [...percents].sort((a, b) => a - b), 'progress never goes backwards');
  assert.equal(percents.at(-1), 100); assert.ok(events.some((e) => e.total === 3 && e.files === 3));
  assert.deepEqual(calls.map((c) => c[0]), ['stop', 'shortcuts', 'register', 'options']);
  console.log('PASS installs, reports ordered progress and applies the options');

  // Reinstall over an existing install replaces it cleanly (stale files are removed).
  w(path.join(dest, 'old-version-leftover.txt'));
  await core.install({ source, dest, appName: 'Study with Sarang', version: '1.2.0', options, ops });
  assert.ok(!fs.existsSync(path.join(dest, 'old-version-leftover.txt')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dest, 'install.json'), 'utf8')).version, '1.2.0');
  console.log('PASS updating replaces the old files');

  // Never clobber someone else's folder.
  const docs = path.join(tmp, 'Documents'); w(path.join(docs, 'thesis.docx'), 'precious');
  const inside = await core.install({ source, dest: docs, appName: 'Study with Sarang', version: '1', options, ops });
  assert.equal(inside.target, path.join(docs, 'Study with Sarang'));
  assert.equal(fs.readFileSync(path.join(docs, 'thesis.docx'), 'utf8'), 'precious');
  console.log('PASS a folder that holds other files gets its own subfolder');

  const squatter = path.join(tmp, 'Other'); w(path.join(squatter, 'Study with Sarang', 'mine.txt'));
  await assert.rejects(core.install({ source, dest: squatter, appName: 'Study with Sarang', version: '1', options, ops }), /not a Study with Sarang folder/);
  assert.ok(fs.existsSync(path.join(squatter, 'Study with Sarang', 'mine.txt')));
  console.log('PASS refuses to replace a same-named folder that is not an install');

  assert.equal(await core.resolveInstallDir(path.parse(tmp).root, 'Study with Sarang'), path.join(path.parse(tmp).root, 'Study with Sarang'));
  await assert.rejects(core.resolveInstallDir('relative/path', 'X'), /full folder path/);
  await assert.rejects(core.resolveInstallDir(path.join(source, 'sub'), 'X', { source }), /inside the setup folder/);
  assert.equal(await core.resolveInstallDir(tmp, 'X', { source }), path.join(tmp, 'X'), 'a parent of the setup folder gets a subfolder');
  console.log('PASS drive roots, relative paths and nesting in the setup folder are handled');

  const empty = path.join(tmp, 'noexe'); w(path.join(empty, 'readme.txt'));
  await assert.rejects(core.install({ source: empty, dest: path.join(tmp, 'z'), appName: 'Study with Sarang', version: '1', options, ops }), /was not found/);
  assert.ok(!fs.existsSync(path.join(tmp, 'z')), 'nothing is created when the exe is missing');
  console.log('PASS nothing happens when the app file is missing');

  // Uninstall.
  calls.length = 0;
  const data = path.join(tmp, 'AppData', 'Study with Sarang'); w(path.join(data, 'settings.json'));
  await assert.rejects(core.uninstall({ dir: docs, appName: 'Study with Sarang', deleteData: true, dataDir: data, ops }), /does not look like/);
  assert.ok(fs.existsSync(path.join(docs, 'thesis.docx')) && fs.existsSync(data), 'refusing leaves everything alone');
  await core.uninstall({ dir: dest, appName: 'Study with Sarang', deleteData: false, dataDir: data, ops });
  assert.ok(!fs.existsSync(dest) && fs.existsSync(data), 'keeps saved data by default');
  assert.deepEqual(calls.map((c) => c[0]), ['stop', 'rmshort', 'unreg', 'rmlogin', 'delete']);
  await core.uninstall({ dir: inside.target, appName: 'Study with Sarang', deleteData: true, dataDir: data, ops });
  assert.ok(!fs.existsSync(inside.target) && !fs.existsSync(data) && fs.existsSync(path.join(docs, 'thesis.docx')), 'optionally deletes saved data, never the parent folder');
  console.log('PASS uninstall is guarded, keeps data by default and can delete it on request');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('Verified installer core.');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
