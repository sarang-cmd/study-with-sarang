'use strict';
/**
 * Integration test: starts the real Electron app and drives it the way a user, a Stream Deck and
 * the OS would. Needs a display (on Linux run it with: xvfb-run -a node scripts/test-electron.cjs).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped the Electron integration test: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const electronPath = require('electron');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-int-'));
const env = { ...process.env, XDG_CONFIG_HOME: config, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' };
const args = [root, '--no-sandbox', '--disable-gpu'];
const hasXdotool = spawnSync('which', ['xdotool']).status === 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const pass = (name) => results.push(`PASS ${name}`);

async function launch() {
  const app = await electron.launch({ executablePath: electronPath, args, env });
  const page = await app.firstWindow();
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  if (process.env.SWA_DEBUG) { page.on('framenavigated', (f) => console.log('NAVIGATED', f.url())); page.on('console', (m) => console.log('console', m.type(), m.text())); page.on('crash', () => console.log('CRASH')); }
  await page.waitForFunction(() => window.desktop && (document.querySelector('#sound') || document.querySelector('[aria-label="Mini bar"]')));
  await page.waitForFunction(async () => Boolean(await window.desktop.getInfo()));
  await sleep(700); // The page reports ready once info has loaded.
  return { app, page, problems };
}
/** Same as clicking a Stream Deck "Open" button: a second process hands its command to the first. */
function sendCli(...extra) {
  return new Promise((resolve) => {
    const child = spawn(electronPath, [...args, ...extra], { env, stdio: 'ignore' });
    child.on('exit', resolve);
  });
}
const winState = (app) => app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; if (!w) return null; const b = w.getBounds(); return { visible: w.isVisible(), destroyed: w.isDestroyed(), top: w.isAlwaysOnTop(), ...b, min: w.isMinimized() }; });
const isPlaying = (page) => page.evaluate(() => Boolean(document.querySelector('button[aria-label="Pause sound"]')));
const waitPlaying = (page, value) => page.waitForFunction((v) => Boolean(document.querySelector('button[aria-label="Pause sound"]')) === v, value, { timeout: 8000 });
const current = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:current') || 'null'));
const savedSettings = () => JSON.parse(fs.readFileSync(path.join(config, 'Study with Sarang', 'settings.json'), 'utf8'));

(async () => {
  let { app, page, problems } = await launch();

  // ---- boot and security ------------------------------------------------------------------
  assert.equal(new URL(page.url()).origin, 'https://app.study-with-sarang.localhost'); pass('app is served from its own secure origin');
  const sandbox = await page.evaluate(() => ({ req: typeof require, proc: typeof process, bridge: Object.keys(window.desktop).sort().join(',') }));
  assert.equal(sandbox.req, 'undefined'); assert.equal(sandbox.proc, 'undefined'); pass('page has no Node access, only the narrow bridge');
  assert.equal(await page.evaluate(() => document.querySelectorAll('script:not([src])').length), 0); pass('no inline scripts (strict content security policy)');
  await page.click('button[aria-label="Settings"]'); await page.click('nav[aria-label="Settings sections"] >> text=Window and updates');
  assert.ok((await page.locator('[data-testid="settings-panel"]').innerText()).includes('Window and startup')); pass('settings panel holds the desktop options');
  assert.equal(await page.evaluate(() => window.desktop.getInfo().then((i) => i.voiceSupported)), false);
  await page.click('nav[aria-label="Settings sections"] >> text=Voice and macros'); assert.ok((await page.locator('[data-testid="settings-panel"]').innerText()).includes('Not available')); await page.keyboard.press('Escape'); await sleep(200); await page.evaluate(() => document.activeElement && document.activeElement.blur());
  pass('voice mode reports unsupported where Windows speech is missing');

  // ---- commands from outside: command line (Stream Deck "Open"), links ----------------------
  assert.equal(await isPlaying(page), false);
  await sendCli('--cmd=sound.play'); await waitPlaying(page, true); pass('--cmd=sound.play starts sound with no click (autoplay allowed)');
  await sendCli('--cmd=sound.pause'); await waitPlaying(page, false); pass('--cmd=sound.pause stops it');
  await sendCli('--cmd=sound.toggle'); await waitPlaying(page, true); await sendCli('study-with-sarang://cmd/sound.toggle'); await waitPlaying(page, false); pass('toggle works from the command line and from a link');
  await sendCli('--cmd=volume.set:20'); await sleep(900);
  assert.equal((await current(page)).mix.volume, 20); pass('--cmd=volume.set:20');
  await sendCli('--cmd=volume.up'); await sleep(700); assert.equal((await current(page)).mix.volume, 25);
  await sendCli('--cmd=volume.down'); await sendCli('--cmd=volume.down'); await sleep(700); assert.equal((await current(page)).mix.volume, 15); pass('volume up and down step by 5');
  await sendCli('--cmd=mix.load:Deep work'); await waitPlaying(page, true); await sleep(700);
  assert.equal((await current(page)).mix.name, 'Deep work'); pass('--cmd=mix.load loads the mix and plays it');
  await sendCli('study-with-sarang://cmd/mix.load/Flow%20and%20rain'); await sleep(900); assert.equal((await current(page)).mix.name, 'Flow and rain'); pass('links accept names with spaces');
  await sendCli('--cmd=sound.pause'); await waitPlaying(page, false);
  await sendCli('--cmd=timer.start'); await page.waitForFunction(() => /Focus/.test(document.title)); pass('--cmd=timer.start');
  await sendCli('--cmd=timer.drift'); await sleep(300); await sendCli('--cmd=timer.reset'); await page.waitForFunction(() => !/Focus/.test(document.title)); pass('drift and reset');
  await sendCli('--cmd=macro.run:Start Flow session'); await waitPlaying(page, true); await page.waitForFunction(() => /Focus/.test(document.title), null, { timeout: 8000 });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('study-with-sarang:current') || '{}').mix?.name === 'Flow', null, { timeout: 5000 }); pass('macro "Start Flow session" loads Flow, starts sound and the timer');
  await sendCli('--cmd=macro.run:Wrap up'); await waitPlaying(page, false); await page.waitForFunction(() => document.title.includes('Study with Sarang') && true); pass('macro "Wrap up" stops sound');
  await sendCli('--cmd=timer.reset');
  await sendCli('--cmd=format.disk', '--cmd=nonsense'); await sendCli('study-with-sarang://cmd/app.quit'); await sleep(500);
  assert.equal((await winState(app)).destroyed, false); pass('unknown commands and quit-by-link are ignored');

  // ---- real global shortcuts (X11 key grabs, same mechanism as RegisterHotKey on Windows) -------
  if (hasXdotool) {
    let lastPress = 0;
    const press = (keys) => { const wait = Math.max(0, 850 - (Date.now() - lastPress)); if (wait) spawnSync('sleep', [String(wait / 1000)]); lastPress = Date.now(); return spawnSync('xdotool', ['key', '--clearmodifiers', keys], { env }); };
    press('ctrl+alt+shift+space'); await waitPlaying(page, true); pass('global shortcut Ctrl+Alt+Shift+Space starts sound');
    press('ctrl+alt+shift+space'); await waitPlaying(page, false); pass('and stops it');
    press('ctrl+alt+shift+p'); await waitPlaying(page, true); press('ctrl+alt+shift+s'); await waitPlaying(page, false); pass('separate start (P) and stop (S) shortcuts');
    press('ctrl+alt+shift+g'); await sleep(500);
    assert.equal(savedSettings().globalEnabled, false);
    press('ctrl+alt+shift+space'); await sleep(900); assert.equal(await isPlaying(page), false); pass('the on/off shortcut (G) disables the others');
    press('ctrl+alt+shift+g'); await sleep(500); press('ctrl+alt+shift+p'); await waitPlaying(page, true); press('ctrl+alt+shift+s'); await waitPlaying(page, false); pass('and enables them again');
    press('ctrl+alt+shift+h'); await page.waitForTimeout(500); assert.equal((await winState(app)).visible, false); press('ctrl+alt+shift+h'); await sleep(500); assert.equal((await winState(app)).visible, true); pass('global shortcut hides and shows the window');
    press('ctrl+alt+shift+h'); await sleep(400); press('ctrl+alt+shift+p'); await waitPlaying(page, true); assert.equal((await winState(app)).visible, false); pass('sound starts while the window is hidden');
    await sleep(1500); assert.equal(await isPlaying(page), true); press('ctrl+alt+shift+s'); await waitPlaying(page, false); press('ctrl+alt+shift+h'); await sleep(400);
    await sendCli('--cmd=shortcuts.disable'); await sleep(400); spawnSync('xdotool', ['key', '--clearmodifiers', 'ctrl+alt+shift+n'], { env });
    await sendCli('--cmd=shortcuts.enable'); await sleep(300);
  } else console.log('NOTE: xdotool not installed, skipped real global-hotkey checks.');

  // ---- window behavior ----------------------------------------------------------------------
  let w = await winState(app);
  assert.equal(w.visible, true);
  await sendCli('--cmd=window.hide'); await sleep(400); assert.equal((await winState(app)).visible, false); pass('hide to tray');
  await sendCli('--cmd=window.show'); await sleep(400); assert.equal((await winState(app)).visible, true); pass('show again');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close()); await sleep(500);
  w = await winState(app); assert.ok(w && !w.destroyed && !w.visible); pass('close button hides to the tray instead of quitting');
  await sendCli('--cmd=window.show'); await sleep(300);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 60, y: 40, width: 1010, height: 720 })); await sleep(900);
  const normal = await winState(app);
  await sendCli('--cmd=window.compact'); if (process.env.SWA_DEBUG) { await sleep(1500); console.log('DBG', JSON.stringify(await winState(app)), await page.evaluate(() => document.documentElement.className + ' | ' + document.body.innerText.slice(0, 60) + ' | ' + document.visibilityState)); }
  await page.waitForSelector('[aria-label="Mini bar"]'); w = await winState(app);
  assert.ok(w.height <= 130 && w.height >= 90, `mini bar height ${w.height}`); pass(`collapse to mini bar (${w.width}x${w.height})`);
    await page.getByRole('button', { name: 'Play sound' }).click(); await waitPlaying(page, true); await page.getByRole('button', { name: 'Pause sound' }).last().click(); await waitPlaying(page, false); pass('mini bar controls work');
  const miniSlider = page.locator('[aria-label="Mini bar"] [role=slider]'); await miniSlider.focus(); await page.keyboard.press('Home'); for (let i = 0; i < 33; i++) await page.keyboard.press('ArrowRight'); await sleep(900); assert.equal((await current(page)).mix.volume, 33); pass('mini bar volume slider');
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; const b = win.getBounds(); win.setBounds({ ...b, x: 300, y: 500 }); }); await sleep(900);
  await sendCli('--cmd=window.expand'); await page.waitForFunction(() => !document.querySelector('[aria-label="Mini bar"]'));
  w = await winState(app); assert.equal(w.width, normal.width); assert.equal(w.height, normal.height); assert.equal(w.x, normal.x); pass('expanding restores the previous size and place');
  await sendCli('--cmd=window.pin'); await sleep(300); assert.equal((await winState(app)).top, true); await sendCli('--cmd=window.pin'); await sleep(300); assert.equal((await winState(app)).top, false); pass('always on top toggles');
  await sendCli('--cmd=window.compact:toggle'); await page.waitForSelector('[aria-label="Mini bar"]'); await sendCli('--cmd=window.compact:toggle'); await page.waitForFunction(() => !document.querySelector('[aria-label="Mini bar"]')); pass('window.compact:toggle round trip');

  // ---- persistence across restarts --------------------------------------------------------------
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 120, y: 80, width: 990, height: 710 })); await sleep(900);
  await sendCli('--cmd=window.compact'); await page.waitForSelector('[aria-label="Mini bar"]');
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; const b = win.getBounds(); win.setBounds({ ...b, x: 700, y: 600 }); }); await sleep(900);
  await sendCli('--cmd=window.expand'); await sleep(700);
  { const rain = page.getByLabel('Rainfall volume'); await rain.focus(); await page.keyboard.press('Home'); for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight'); } await sleep(700);
  await sendCli('--cmd=app.quit'); await sleep(1200);
  await app.close().catch(() => {});
  ({ app, page, problems } = await launch());
  w = await winState(app);
  assert.deepEqual([w.x, w.y, w.width, w.height], [120, 80, 990, 710]); pass('window comes back where it was');
  if (process.env.SWA_DEBUG) console.log('DBG', JSON.stringify(await current(page)));
  assert.equal((await current(page)).mix.layers.Rainfall.level, 40); pass('mix is restored');
  await sendCli('--cmd=window.compact'); await page.waitForSelector('[aria-label="Mini bar"]'); await sendCli('--cmd=app.quit'); await sleep(1200); await app.close().catch(() => {});
  ({ app, page, problems } = await launch());
  assert.ok(await page.locator('[aria-label="Mini bar"]').count() > 0); w = await winState(app); assert.equal(w.x, 700); assert.equal(w.y, 600); pass('it even reopens collapsed, parked in the same corner');
  await sendCli('--cmd=window.expand'); await sleep(500);

  // ---- starts hidden when asked ---------------------------------------------------------------------
  await sendCli('--cmd=app.quit'); await sleep(1200); await app.close().catch(() => {});
  const cfg = JSON.parse(fs.readFileSync(path.join(config, 'Study with Sarang', 'settings.json'), 'utf8')); cfg.startHidden = true; cfg.compact = false;
  fs.writeFileSync(path.join(config, 'Study with Sarang', 'settings.json'), JSON.stringify(cfg));
  const hidden = await electron.launch({ executablePath: electronPath, args: [...args, '--login'], env });
  await sleep(2500);
  const hw = await hidden.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; return { count: BrowserWindow.getAllWindows().length, visible: win.isVisible() }; });
  assert.equal(hw.visible, false); pass('login launch with "start hidden" stays in the tray');
  await hidden.close().catch(() => {});

  // ---- a Stream Deck press launches the app silently when it is not running ------------------------
  cfg.startHidden = false; fs.writeFileSync(path.join(config, 'Study with Sarang', 'settings.json'), JSON.stringify(cfg));
  const cold = await electron.launch({ executablePath: electronPath, args: [...args, '--cmd=sound.play'], env });
  const coldPage = await cold.firstWindow(); await coldPage.waitForFunction(() => window.desktop && (document.querySelector('#sound') || document.querySelector('[aria-label="Mini bar"]'))); await waitPlaying(coldPage, true);
  const cw = await cold.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible());
  assert.equal(cw, false); pass('a command that starts the app plays sound without popping up a window');
  // Last, because a refused navigation leaves Playwright waiting for a navigation that never commits.
  const before = (await cold.windows()).length;
  assert.equal(await coldPage.evaluate(() => window.open('https://example.com') === null), true);
  await coldPage.evaluate(() => { location.href = 'https://example.org/'; }); await sleep(600);
  assert.equal(new URL(coldPage.url()).hostname, 'app.study-with-sarang.localhost'); assert.equal((await cold.windows()).length, before); pass('external pages cannot open or take over the window');
  await cold.close().catch(() => {});

  // A cold start can also carry a window or app command, which the main process must handle itself.
  const pinned = await electron.launch({ executablePath: electronPath, args: [...args, '--cmd=window.pin:on'], env });
  await pinned.firstWindow(); await sleep(1500);
  assert.equal((await winState(pinned)).top, true); pass('cold start with --cmd=window.pin:on is handled by the main process');
  const closed = pinned.waitForEvent('close').then(() => true);
  await sendCli('--cmd=app.quit');
  assert.equal(await Promise.race([closed, sleep(8000).then(() => false)]), true); pass('--cmd=app.quit closes the running app');


  console.log(results.join('\n'));
  const real = problems.filter((p) => !/youtube|favicon|Failed to load resource/i.test(p));
  console.log(real.length ? `PAGE PROBLEMS:\n${real.join('\n')}` : 'no page errors');
  process.exit(real.length ? 1 : 0);
})().catch((error) => { console.log(results.join('\n')); console.error('FAIL', error.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
