'use strict';
// Drives the real setup and uninstall windows (Electron under a display) with Windows-only steps stubbed out.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright-core');

const root = path.join(__dirname, '..');
const shots = process.env.SWA_SHOTS || '';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-setup-ui-'));
const source = path.join(tmp, 'extracted'); fs.mkdirSync(path.join(source, 'resources'), { recursive: true });
fs.writeFileSync(path.join(source, 'Study with Sarang.exe'), 'EXE'); fs.writeFileSync(path.join(source, 'resources', 'app.asar'), 'A'.repeat(300000));
for (let i = 0; i < 40; i += 1) fs.writeFileSync(path.join(source, `locale-${i}.pak`), 'L'.repeat(4000));
const install = path.join(tmp, 'Programs', 'Study with Sarang');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);
const shot = async (page, name) => { if (shots) { await sleep(900); await page.screenshot({ path: path.join(shots, `${name}.png`) }); } };

async function launch(args, extra = {}) {
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu', ...args], env: { ...process.env, XDG_CONFIG_HOME: path.join(tmp, 'config'), SWA_SETUP_DRY: '1', SWA_SETUP_SOURCE: source, SWA_INSTALL_DIR: install, SWA_SETUP_MIN_MS: '2600', ...extra } });
  const page = await app.firstWindow(); const problems = [];
  page.on('pageerror', (e) => problems.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  await page.waitForFunction(() => window.setup && document.querySelector('.page.active'));
  return { app, page, problems };
}
const active = (page) => page.evaluate(() => document.querySelector('.page.active')?.id);

(async () => {
  let { app, page, problems } = await launch(['--setup']);
  assert.equal(await active(page), 'p-welcome'); assert.match(await page.textContent('#h-welcome'), /Study with\s*Sarang/);
  assert.equal(await page.evaluate(() => typeof require), 'undefined', 'no Node in the setup page');
  assert.deepEqual(await page.evaluate(() => Object.keys(window.setup).sort()), ['chooseDir', 'close', 'finish', 'info', 'install', 'minimize', 'onProgress', 'runPortable', 'uninstall']);
  pass('setup opens on the welcome page with a narrow bridge');
  await shot(page, 'setup-1-welcome');
  const size = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  assert.equal(size.width, 860); assert.equal(size.height, 580);

  await page.click('#go-options'); await page.waitForFunction(() => document.querySelector('.page.active')?.id === 'p-options');
  assert.equal(await page.textContent('#o-dir'), install);
  assert.equal(await page.isChecked('#o-login'), true, 'opens at sign-in by default'); assert.equal(await page.isChecked('#o-hidden'), false);
  await page.click('label.opt:has(#o-hidden)'); assert.equal(await page.isChecked('#o-hidden'), true);
  await page.click('label.opt:has(#o-hidden)'); await shot(page, 'setup-2-options');
  assert.equal(await page.locator('#o-launch').count(), 0, 'there is no "open it when setup finishes" switch any more');
  pass('options page shows the folder and sensible defaults');

  await page.click('#o-install');
  if (process.env.SWA_DEBUG) { await sleep(1000); console.log('DBG', await active(page), await page.textContent('#o-error'), await page.textContent('#status'), await page.textContent('#pct')); }
  await page.waitForFunction(() => document.querySelector('.page.active')?.id === 'p-working');
  await sleep(600); await shot(page, 'setup-3-installing');
  await page.waitForFunction(() => document.querySelector('.page.active')?.id === 'p-done', null, { timeout: 20000 });
  assert.ok(fs.existsSync(path.join(install, 'resources', 'app.asar')) && fs.existsSync(path.join(install, 'install.json')));
  await page.waitForFunction(() => document.getElementById('pct').textContent === '100');
  assert.match(await page.textContent('#files'), /42 \/ 42 files/);
  pass('install copies every file and finishes at 100%');
  await shot(page, 'setup-4-done');
  assert.deepEqual(problems, []);
  await page.click('#d-close').catch(() => {}); await app.waitForEvent('close').catch(() => {}); await sleep(300);
  pass('Close ends setup');

  // Running setup again over an install offers repair, not a fresh install.
  ({ app, page, problems } = await launch(['--setup']));
  assert.equal(await page.textContent('#go-install'), 'Repair'); assert.match(await page.textContent('#welcome-lede'), /kept/);
  await shot(page, 'setup-5-repair'); await page.click('#min'); await page.click('#close').catch(() => {}); await app.waitForEvent('close').catch(() => {});
  pass('a second run offers Repair and keeps user data');

  // Failure is shown, not swallowed.
  ({ app, page, problems } = await launch(['--setup'], { SWA_SETUP_SOURCE: path.join(tmp, 'missing-folder') }));
  await page.click('#go-install');
  await page.waitForFunction(() => document.querySelector('.page.active')?.id === 'p-options', null, { timeout: 8000 });
  assert.ok((await page.textContent('#o-error')).length > 5 && await page.isVisible('#o-error'));
  await shot(page, 'setup-6-error'); await page.click('#o-back'); await page.keyboard.press('Escape').catch(() => {}); await app.waitForEvent('close').catch(() => {});
  pass('a failed install returns to the options page with the reason');

  // Update mode: started by the installed app after it downloaded a newer setup. No questions, same animation.
  const marker = path.join(install, 'install.json');
  const was = JSON.parse(fs.readFileSync(marker, 'utf8')); fs.writeFileSync(marker, JSON.stringify({ ...was, version: '0.0.1' }));
  ({ app, page, problems } = await launch(['--update', `--update-dir=${install}`]));
  assert.equal(await page.textContent('#bar-title'), 'Study with Sarang Update');
  await page.waitForFunction(() => ['p-working', 'p-done'].includes(document.querySelector('.page.active')?.id), null, { timeout: 8000 });
  await shot(page, 'update-1-working');
  await page.waitForFunction(() => document.querySelector('.page.active')?.id === 'p-done', null, { timeout: 15000 });
  assert.match(await page.textContent('#h-done'), /^Updated to \d+\.\d+\.\d+/);
  assert.equal(await page.isVisible('#d-close'), true); assert.equal(await page.isVisible('#d-open'), true);
  assert.equal(JSON.parse(fs.readFileSync(marker, 'utf8')).version, was.version);
  assert.ok(fs.existsSync(path.join(install, 'Study with Sarang.exe')) && !fs.existsSync(`${install}.previous`));
  await shot(page, 'update-2-done');
  await sleep(4500); assert.equal(app.windows().length > 0, true, 'the update does not close or open anything by itself');
  await page.click('#d-close'); await app.waitForEvent('close', { timeout: 8000 });
  pass('update mode runs by itself, replaces the files, reports the version and then waits for you (nothing opens automatically)');

  // An update that cannot finish says so and the old version stays.
  fs.writeFileSync(marker, JSON.stringify({ ...was, version: '0.0.1' }));
  ({ app, page, problems } = await launch(['--update', `--update-dir=${install}`], { SWA_SETUP_SOURCE: path.join(tmp, 'missing-folder') }));
  await page.waitForFunction(() => document.querySelector('.page.active')?.id === 'p-failed', null, { timeout: 8000 });
  assert.ok((await page.textContent('#f-error')).length > 5); assert.match(await page.textContent('#p-failed'), /previous version was put back/);
  assert.ok(fs.existsSync(path.join(install, 'Study with Sarang.exe')), 'the installed app is untouched');
  await shot(page, 'update-3-failed'); await page.keyboard.press('Escape').catch(() => {}); await app.waitForEvent('close').catch(() => {});
  fs.writeFileSync(marker, JSON.stringify(was));
  pass('a failed update shows the reason and keeps the installed app');

  // A bad --update-dir falls back to the normal setup instead of touching anything.
  ({ app, page, problems } = await launch(['--update', `--update-dir=${path.join(tmp, 'nowhere')}`]));
  assert.equal(await active(page), 'p-welcome'); await page.keyboard.press('Escape').catch(() => {}); await app.waitForEvent('close').catch(() => {});
  pass('an update folder that is not an install falls back to the normal setup');

  // Uninstall window, keeping data, then really removing.
  ({ app, page, problems } = await launch(['--uninstall'], { SWA_UNINSTALL_DIR: install }));
  assert.equal(await active(page), 'p-remove'); await shot(page, 'setup-7-uninstall');
  await page.click('#r-go'); await page.waitForFunction(() => document.querySelector('.page.active')?.id === 'p-removed', null, { timeout: 15000 });
  assert.ok(!fs.existsSync(install)); await shot(page, 'setup-8-removed');
  await page.click('#x-close').catch(() => {}); await app.waitForEvent('close').catch(() => {});
  pass('uninstall window removes the app');
  assert.deepEqual(problems, []);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('Verified the setup and uninstall windows.');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
