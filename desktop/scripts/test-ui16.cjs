'use strict';
/**
 * UI test for 1.6: interface levels (the top bar switch, presets, custom), the Sound settings, the media icon,
 * auto-pause driven by simulated shell reports, and the Discord settings.
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui16.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui16-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);
const shot = process.env.SWA_SHOTS;

async function launch() {
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: config } });
  const page = await app.firstWindow(); const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/youtube|googlevideo|ERR_|Failed to load resource/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.waitForFunction(() => window.desktop && document.querySelector('header'));
  await sleep(900);
  return { app, page, problems };
}
const isPlaying = (page) => page.evaluate(() => Boolean(document.querySelector('header button[aria-label="Pause sound"]')));
const waitPlaying = (page, v, timeout = 6000) => page.waitForFunction((x) => Boolean(document.querySelector('header button[aria-label="Pause sound"]')) === x, v, { timeout });
const navLabels = (page) => page.evaluate(() => [...document.querySelectorAll('header nav[aria-label="Sections"]')[0].querySelectorAll('a')].map((a) => a.textContent.trim()));
const setPrefs = async (page, patch) => { await page.evaluate((p) => { const cur = JSON.parse(localStorage.getItem('study-with-sarang:prefs') || '{}'); localStorage.setItem('study-with-sarang:prefs', JSON.stringify({ ...cur, ...p })); }, patch); await page.reload(); await page.waitForSelector('header'); await sleep(900); };
const prefsNow = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:prefs') || '{}'));
const openSettings = async (page, tab) => { await page.click('header button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]'); if (tab) await page.click(`[data-testid="settings-panel"] nav button:has-text("${tab}")`); await sleep(250); };
const closeSettings = async (page) => { await page.click('[aria-label="Close settings"]'); await sleep(250); };
const sendToPage = (app, channel, payload) => app.evaluate(({ BrowserWindow }, [c, p]) => BrowserWindow.getAllWindows()[0].webContents.send(c, p), [channel, payload]);

(async () => {
  let { app, page, problems } = await launch();

  // ---- default: nothing changes for existing users
  assert.deepEqual(await navLabels(page), ['Studio', 'Library', 'Progress', 'Focus']);
  assert.ok(await page.locator('section[aria-label="Introduction"]').count() > 0, 'the intro strip is there at the Power level');
  assert.ok(await page.locator('header button[aria-label="Command palette"]').count() > 0); assert.ok(await page.locator('#layers').isVisible(), 'layers are open, not in a drawer');
  assert.equal(await page.locator('[data-testid="simple-toggle"]').getAttribute('aria-pressed'), 'false');
  pass('Power is the default and looks like before, with the new Simple switch in the top bar');

  // ---- the top bar switch
  await page.click('[data-testid="simple-toggle"]'); await sleep(400);
  assert.equal(await page.locator('[data-testid="simple-toggle"]').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await navLabels(page), ['Studio', 'Library']);
  assert.equal(await page.locator('section[aria-label="Introduction"]').count(), 0, 'no intro strip');
  assert.equal(await page.locator('header button[aria-label="Command palette"]').count(), 0); assert.equal(await page.locator('header button[aria-label="Keyboard shortcuts"]').count(), 0);
  assert.equal(await page.locator('[role="group"][aria-label="Timer mode"]').count(), 0, 'no timer modes'); assert.equal(await page.locator('#timer details').count(), 0, 'no timer settings form');
  assert.ok(await page.locator('#timer button:has-text("Start")').count() > 0, 'the timer itself stays');
  assert.equal(await page.locator('#layers').isVisible(), false, 'layers are tucked away');
  await page.click('summary:has-text("More sounds and layers")'); await sleep(300);
  assert.ok(await page.locator('#layers h2:has-text("Layer your own ambience")').isVisible(), 'and one click away');
  assert.equal(await page.locator('#sound details').first().evaluate((d) => d.open), false, 'fine tune is closed');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.ui), 'simple');
  if (shot) await page.screenshot({ path: path.join(shot, 'simple-studio.png') });
  pass('Simple view: two pages, no extras, layers and fine tune in drawers');

  // a page that Simple hides falls back to Studio, and Library has no video playlist
  await page.evaluate(() => { location.hash = 'progress'; }); await sleep(500);
  assert.ok(await page.locator('#timer').count() > 0 && await page.locator('#tracking').count() === 0, 'a hidden page shows the Studio');
  await page.evaluate(() => { location.hash = 'library'; }); await sleep(500);
  assert.ok(await page.locator('#mixes').count() > 0); assert.equal(await page.locator('#video').count(), 0);
  await page.evaluate(() => { location.hash = 'studio'; }); await sleep(300);
  pass('hidden pages fall back to the Studio');

  // switch back
  await page.click('[data-testid="simple-toggle"]'); await sleep(400);
  assert.deepEqual(await navLabels(page), ['Studio', 'Library', 'Progress', 'Focus']); assert.equal((await prefsNow(page)).uiLevel, 'power');
  await page.reload(); await page.waitForSelector('header'); await sleep(700);
  await page.click('[data-testid="simple-toggle"]'); await sleep(300);
  await page.reload(); await page.waitForSelector('header'); await sleep(700);
  assert.deepEqual(await navLabels(page), ['Studio', 'Library'], 'the level is remembered');
  await page.click('[data-testid="simple-toggle"]'); await sleep(300);
  pass('the switch returns to the previous level and the level is remembered');

  // Simple progress summary
  await setPrefs(page, { uiLevel: 'simple', uiShow: {} });
  await page.evaluate(() => { const out = []; const now = Date.now(); for (let d = 0; d < 5; d++) out.push({ id: `s${d}`, startedAt: new Date(now - d * 86400000).toISOString(), seconds: 1800, mode: 'pomodoro', task: '', mix: 'Flow', distractions: 0 }); localStorage.setItem('study-with-sarang:sessions', JSON.stringify(out)); });
  await setPrefs(page, { uiLevel: 'custom', uiShow: { pageProgress: true, trackingFull: false, achievementsCard: false } });
  await page.evaluate(() => { location.hash = 'progress'; }); await sleep(600);
  assert.ok(await page.locator('#tracking h2:has-text("Your week")').isVisible(), 'the short summary replaces the dashboard');
  assert.equal(await page.locator('[data-testid="achievements"]').count(), 0);
  await setPrefs(page, { uiLevel: 'power', uiShow: {} }); await page.evaluate(() => { location.hash = 'studio'; }); await sleep(300);
  pass('Progress shows a short weekly summary when the full dashboard is off');

  // ---- settings: presets and custom
  await openSettings(page, 'Interface level');
  const radio = (name) => page.locator(`[role="radiogroup"][aria-label="Interface level"] [role="radio"]:has-text("${name}")`);
  assert.equal(await radio('Power').getAttribute('aria-checked'), 'true');
  await radio('Standard').click(); await sleep(300);
  assert.equal(await radio('Standard').getAttribute('aria-checked'), 'true');
  await closeSettings(page);
  assert.equal(await page.locator('section[aria-label="Introduction"]').count(), 0, 'Standard hides the intro strip'); assert.deepEqual(await navLabels(page), ['Studio', 'Library', 'Progress', 'Focus']);
  await openSettings(page, 'Interface level');
  await page.locator('label:has-text("Layer mixer") input').uncheck(); await sleep(300);
  assert.equal(await radio('Custom').getAttribute('aria-checked'), 'true', 'changing one switch makes the level Custom');
  await page.locator('label:has-text("Focus page") input').uncheck(); await sleep(300);
  await closeSettings(page);
  assert.equal(await page.locator('#layers').count(), 0); assert.deepEqual(await navLabels(page), ['Studio', 'Library', 'Progress']);
  const saved = await prefsNow(page); assert.equal(saved.uiLevel, 'custom'); assert.equal(saved.uiShow.layers, false); assert.equal(saved.uiShow.heroStrip, false, 'custom starts from Standard');
  await page.reload(); await page.waitForSelector('header'); await sleep(700);
  assert.deepEqual(await navLabels(page), ['Studio', 'Library', 'Progress'], 'custom choices survive a restart');
  await openSettings(page, 'Interface level'); await radio('Power').click(); await sleep(300); await closeSettings(page);
  assert.ok(await page.locator('#layers').isVisible() && await page.locator('section[aria-label="Introduction"]').count() > 0, 'Power shows everything again, layers open');
  // palette command
  await page.keyboard.press('Control+k'); await sleep(300); await page.keyboard.type('simple'); await sleep(200);
  assert.ok(await page.locator('[role="dialog"] >> text=Simple view').count() > 0, 'the command palette offers Simple view'); await page.keyboard.press('Escape');
  pass('settings: presets, one switch makes it Custom, choices persist, Power restores everything');

  // ---- sound settings
  await openSettings(page, 'Sound');
  await page.locator('[role="radiogroup"][aria-label="Loudness range"] [role="radio"]:has-text("Gentle")').click();
  assert.equal((await prefsNow(page)).loudness, 'gentle');
  assert.ok(await page.locator('[role="slider"][aria-label="Fade out"], input[aria-label="Fade out"]').count() > 0, 'fade controls');
  await page.locator('label:has-text("Start playing when the app opens") input').check();
  assert.equal((await prefsNow(page)).startPlaying, true);
  await closeSettings(page);
  await page.reload(); await page.waitForSelector('header'); await sleep(500);
  await waitPlaying(page, true, 8000);
  pass('Sound settings: loudness range saved, start playing on launch works');

  // ---- media icon
  const art = await page.evaluate(async () => { const md = navigator.mediaSession.metadata; if (!md) return null; const first = md.artwork[0]; const res = await fetch(first.src); return { count: md.artwork.length, sizes: md.artwork.map((a) => a.sizes), type: res.headers.get('content-type'), ok: res.ok, title: md.title }; });
  assert.ok(art, 'media metadata exists while the app plays'); assert.equal(art.count, 4); assert.deepEqual(art.sizes, ['96x96', '128x128', '256x256', '512x512']); assert.ok(art.ok && /png/.test(art.type), 'the icon loads from the app');
  await openSettings(page, 'Sound'); await page.locator('label:has-text("Show the app icon in media controls") input').uncheck(); await closeSettings(page); await sleep(300);
  assert.equal(await page.evaluate(() => navigator.mediaSession.metadata.artwork.length), 0, 'the icon can be switched off');
  await openSettings(page, 'Sound'); await page.locator('label:has-text("Show the app icon in media controls") input').check(); await closeSettings(page); await sleep(300);
  assert.equal(await page.evaluate(() => navigator.mediaSession.metadata.artwork.length), 4);
  pass('the media controls get the app icon, and it can be switched off');

  // ---- auto-pause with simulated shell reports
  await setPrefs(page, { startPlaying: false, autoPause: { enabled: true, onMic: true, onRecorder: true, onMedia: true, action: 'pause', lowerTo: 20, delaySec: 0, resume: true, resumeDelaySec: 1, toast: true, ignoreApps: 'spotify', recorders: 'obs64' } });
  await page.click('header button[aria-label="Play sound"]'); await waitPlaying(page, true);
  await sendToPage(app, 'swa:activity', { mic: ['C:#Program Files#Zoom#bin#Zoom.exe'], recorders: [], media: [] });
  await waitPlaying(page, false, 5000);
  assert.ok(await page.locator('text=Sound paused: Zoom is using the microphone').count() > 0, 'it says why');
  await openSettings(page, 'Auto-pause');
  assert.ok(await page.locator('[data-testid="autopause-status"]').innerText().then((t) => /Holding the sound paused: Zoom/.test(t)), 'settings show what it is doing'); await closeSettings(page);
  await sendToPage(app, 'swa:activity', { mic: [], recorders: [], media: [] });
  await waitPlaying(page, true, 6000);
  pass('auto-pause: pauses for a call and resumes by itself afterwards');

  // user override
  await sendToPage(app, 'swa:activity', { mic: [], recorders: [], media: ['Chrome'] }); await waitPlaying(page, false, 5000);
  await page.click('header button[aria-label="Play sound"]'); await waitPlaying(page, true); await sleep(2500);
  assert.equal(await isPlaying(page), true, 'pressing play while it holds the sound wins');
  await sendToPage(app, 'swa:activity', { mic: [], recorders: [], media: [] }); await sleep(2500);
  assert.equal(await isPlaying(page), true);
  // ignore list and own app
  await sendToPage(app, 'swa:activity', { mic: [], recorders: [], media: ['Spotify.exe', 'com.sarang.studywithsarang'] }); await sleep(2500);
  assert.equal(await isPlaying(page), true, 'ignored apps and this app itself do nothing');
  // paused by the user stays paused
  await page.click('header button[aria-label="Pause sound"]'); await waitPlaying(page, false);
  await sendToPage(app, 'swa:activity', { mic: ['x.exe'], recorders: [], media: [] }); await sleep(2000); await sendToPage(app, 'swa:activity', { mic: [], recorders: [], media: [] }); await sleep(3000);
  assert.equal(await isPlaying(page), false, 'it never starts sound you had paused');
  pass('auto-pause: your own play and pause always win, ignore list and own app respected');

  // lower instead of pause
  await setPrefs(page, { autoPause: { enabled: true, onMic: true, onRecorder: true, onMedia: true, action: 'lower', lowerTo: 20, delaySec: 0, resume: true, resumeDelaySec: 1, toast: false, ignoreApps: '', recorders: 'obs64' } });
  await page.click('header button[aria-label="Play sound"]'); await waitPlaying(page, true);
  await sendToPage(app, 'swa:activity', { mic: [], recorders: ['obs64'], media: [] }); await sleep(2500);
  assert.equal(await isPlaying(page), true, 'lowering keeps playing');
  await openSettings(page, 'Auto-pause'); assert.ok(await page.locator('[data-testid="autopause-status"]').innerText().then((t) => /lower: obs64 is open/.test(t)), 'status says it is holding the sound lower'); await closeSettings(page);
  await sendToPage(app, 'swa:activity', { mic: [], recorders: [], media: [] }); await sleep(3000);
  await openSettings(page, 'Auto-pause'); assert.ok(await page.locator('[data-testid="autopause-status"]').innerText().then((t) => !/Holding/.test(t))); await closeSettings(page);
  pass('auto-pause: can lower the volume instead and restores it');

  // off by default means videos never pause it
  await setPrefs(page, { autoPause: { enabled: false } });
  await page.click('header button[aria-label="Pause sound"]').catch(() => {});
  await page.click('header button[aria-label="Play sound"]'); await waitPlaying(page, true);
  await sendToPage(app, 'swa:activity', { mic: ['Zoom.exe'], recorders: ['obs64'], media: ['Chrome'] }); await sleep(2500);
  assert.equal(await isPlaying(page), true, 'with auto-pause off, nothing ever pauses the sound');
  await openSettings(page, 'Auto-pause');
  assert.ok(await page.locator('text=Off by default. Your sound keeps playing while you watch videos').count() > 0);
  if (shot) await page.screenshot({ path: path.join(shot, 'autopause-settings.png') });
  await closeSettings(page);
  pass('auto-pause is off by default and then nothing pauses the sound');

  // ---- Discord settings
  await openSettings(page, 'Discord');
  assert.ok(await page.locator('[data-testid="discord-status"]').innerText().then((t) => /^Off/.test(t)));
  assert.equal(await page.locator('label:has-text("Show my activity on Discord") input').isChecked(), false, 'off by default');
  assert.ok(await page.locator('[data-testid="discord-preview"]').innerText().then((t) => /Focusing/.test(t) && /Flow/.test(t) && !/Calculus/.test(t)), 'the task stays out of the preview until allowed');
  await page.getByRole('switch', { name: /^What I am working on/ }).check();
  assert.ok(await page.locator('[data-testid="discord-preview"]').innerText().then((t) => /Calculus/.test(t)));
  await page.getByRole('switch', { name: /^What I am working on/ }).uncheck();
  await page.locator('[data-testid="discord-advanced"] summary').click();
  await page.fill('input[placeholder^="Built in"]', '12ab34'); assert.equal(await page.inputValue('input[placeholder^="Built in"]'), '1234', 'only digits are kept');
  await page.fill('input[placeholder^="Built in"]', '123456789012345678');
  await page.locator('label:has-text("Show my activity on Discord") input').check(); await sleep(1500);
  const st = await page.locator('[data-testid="discord-status"]').innerText();
  assert.ok(/Waiting for the Discord app|Connecting/.test(st), `status without Discord running: ${st}`);
  if (shot) await page.screenshot({ path: path.join(shot, 'discord-settings.png') });
  await page.locator('label:has-text("Show my activity on Discord") input').uncheck(); await sleep(500);
  assert.ok(await page.locator('[data-testid="discord-status"]').innerText().then((t) => /^Off/.test(t)));
  await closeSettings(page);
  pass('Discord settings: off by default, privacy preview, waits for the Discord app, turns off cleanly');

  assert.deepEqual(problems, [], 'no console errors');
  await app.close();
  console.log('Verified 1.6 interface in the desktop app.');
})().catch((error) => { console.error(error); process.exit(1); });
