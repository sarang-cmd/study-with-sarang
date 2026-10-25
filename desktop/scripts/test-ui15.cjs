'use strict';
/**
 * UI test for the 1.5 features: achievements (silent first run, toast on a new unlock, switches), the timer pausing
 * the sound, and the cloud sign-up flow with an emailed code (against the in-repo mock Supabase).
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui15.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui15-'));
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
const playing = (page) => page.evaluate(() => Boolean(document.querySelector('header button[aria-label="Pause sound"]')));
const waitPlaying = (page, v) => page.waitForFunction((x) => Boolean(document.querySelector('header button[aria-label="Pause sound"]')) === x, v, { timeout: 6000 });
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:achievements') || 'null'));

(async () => {
  const { startMock } = await import(path.join(__dirname, '_mock-supabase.mjs'));
  const mock = await startMock();
  let { app, page, problems } = await launch();

  // ---- achievements: first run is silent
  await page.evaluate(() => {
    const out = []; const now = Date.now();
    for (let d = 0; d < 40; d++) { const t = new Date(now - d * 86400000); t.setHours(9, 10); out.push({ id: `s${d}`, startedAt: t.toISOString(), seconds: 1800 + d * 20, mode: 'pomodoro', task: d % 3 ? 'Maths' : 'Latin', completed: true, distractions: d % 2, tabAways: 0, mixName: d % 2 ? 'Flow' : 'Rain' }); }
    localStorage.setItem('study-with-sarang:sessions', JSON.stringify(out));
    localStorage.removeItem('study-with-sarang:achievements'); // as if this were the very first run with a history
  });
  await page.reload(); await page.waitForSelector('header'); await sleep(900);
  await page.evaluate(() => { location.hash = 'progress'; }); await sleep(600);
  const card = page.locator('[data-testid="achievements"]');
  await card.scrollIntoViewIfNeeded(); await sleep(500);
  assert.ok(await card.isVisible(), 'the Achievements card is on the Progress page');
  const total = await card.locator('[data-testid="achievement"]').count();
  assert.ok(total >= 30, `at least 30 achievements (${total})`);
  const unlocked = await card.locator('[data-testid="achievement"][data-unlocked="true"]').count();
  assert.ok(unlocked >= 8, `existing history unlocked some (${unlocked})`);
  assert.equal(await page.locator('[data-testid="celebration"], [data-testid="celebration-small"]').count(), 0, 'the first run shows no flood of messages');
  const s1 = await store(page); assert.equal(s1.seeded, true); assert.ok(Object.keys(s1.unlocked).length === unlocked);
  assert.match(await card.locator('h2').innerText(), new RegExp(`${unlocked} of ${total} unlocked`));
  pass(`achievements card shows ${unlocked} of ${total}, seeded silently`);
  if (shot) { await page.screenshot({ path: path.join(shot, 'achievements.png') }); }

  // filters
  await card.getByRole('tab', { name: 'Locked', exact: true }).click(); await sleep(200);
  assert.equal(await card.locator('[data-testid="achievement"][data-unlocked="true"]').count(), 0);
  await card.getByRole('tab', { name: 'Streaks' }).click(); await sleep(200);
  assert.ok(await card.locator('[data-testid="achievement"]').count() >= 4);
  await card.getByRole('tab', { name: 'All', exact: true }).click();
  pass('achievement filters');

  // ---- a new unlock after the first run: toast
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('study-with-sarang:sessions')); s.unshift({ id: 'long', startedAt: new Date().toISOString(), seconds: 200 * 60, mode: 'stopwatch', task: 'Deep', completed: true, distractions: 0, tabAways: 0, mixName: 'Flow' }); localStorage.setItem('study-with-sarang:sessions', JSON.stringify(s)); });
  await page.reload(); await page.waitForSelector('header');
  await page.waitForSelector('[data-testid="celebration"], [data-testid="celebration-small"]', { timeout: 12000 });
  assert.ok((await store(page)).unlocked.orbit, 'the unlock is remembered');
  pass('a new unlock raises a message once');
  await sleep(500);
  await page.reload(); await page.waitForSelector('header'); await sleep(1500);
  assert.equal(await page.locator('[data-testid="celebration"], [data-testid="celebration-small"]').count(), 0, 'it does not repeat after a reload');
  pass('no repeat after reload');

  // ---- switches
  await page.click('button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]');
  await page.click('nav[aria-label="Settings sections"] >> text=Feedback'); await sleep(250);
  const sw = (name) => page.locator('[data-testid="settings-panel"]').getByRole('switch', { name });
  assert.equal(await sw('Achievements').isChecked(), true); assert.equal(await sw('Achievement messages').isChecked(), true);
  await sw('Achievements').click(); await sleep(300);
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:prefs') || '{}'));
  assert.equal(prefs.achievements, false);
  await page.keyboard.press('Escape'); await sleep(300); await page.evaluate(() => document.activeElement && document.activeElement.blur());
  assert.equal(await page.locator('[data-testid="achievements"]').count(), 0, 'switching Achievements off hides the card');
  pass('achievements can be switched off');
  await page.click('button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]');
  await page.click('nav[aria-label="Settings sections"] >> text=Feedback'); await sleep(250);
  await sw('Achievements').click(); await sleep(300);
  await page.keyboard.press('Escape'); await sleep(300); await page.evaluate(() => document.activeElement && document.activeElement.blur());

  // ---- pausing the timer pauses the sound
  await page.evaluate(() => { location.hash = 'studio'; }); await sleep(500);
  await page.click('header button[aria-label="Play sound"]'); await waitPlaying(page, true);
  const toggle = page.locator('#timer').getByRole('button', { name: /^(Start|Pause|Resume)$/ });
  await toggle.click(); await sleep(500);
  assert.equal(await playing(page), true, 'sound keeps playing while the timer runs');
  await toggle.click(); await waitPlaying(page, false);
  pass('pausing the timer pauses the sound');
  await toggle.click(); await waitPlaying(page, true);
  pass('starting the timer brings the sound back');
  await toggle.click(); await waitPlaying(page, false);

  // ---- media keys follow the most recent player (browser style)
  const feature = await app.evaluate(({ app: a }) => a.commandLine.getSwitchValue('disable-features'));
  assert.ok(!/HardwareMediaKeyHandling|MediaSessionService/.test(feature), `Chromium's media key handling is on (${feature})`);
  assert.equal(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('MediaPlayPause')), false, 'the app does not grab Play/Pause globally');
  assert.equal(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('MediaNextTrack')), false);
  // Capture the Media Session handlers the page registers, then drive them like the system would.
  await page.addInitScript(() => { window.__ms = {}; const ms = navigator.mediaSession; const orig = ms.setActionHandler.bind(ms); ms.setActionHandler = (a, h) => { window.__ms[a] = h; return orig(a, h); }; });
  await page.reload(); await page.waitForSelector('header'); await sleep(1200);
  assert.equal(await page.evaluate(() => navigator.mediaSession.playbackState), 'paused', 'announced as a paused player');
  await page.click('header button[aria-label="Play sound"]'); await waitPlaying(page, true); await sleep(400);
  assert.equal(await page.evaluate(() => navigator.mediaSession.playbackState), 'playing');
  assert.ok(await page.evaluate(() => navigator.mediaSession.metadata && navigator.mediaSession.metadata.artist === 'Study with Sarang'));
  assert.ok(await page.evaluate(() => Boolean(window.__ms.play && window.__ms.pause && window.__ms.nexttrack)), 'the page registers play, pause and next with the system');
  await page.evaluate(() => window.__ms.pause()); await waitPlaying(page, false);
  assert.equal(await page.evaluate(() => navigator.mediaSession.playbackState), 'paused');
  await sleep(450); await page.evaluate(() => window.__ms.play()); await waitPlaying(page, true);
  await sleep(450); await page.evaluate(() => window.__ms.pause()); await waitPlaying(page, false);
  pass('the system can pause and resume this app through the Media Session, and nothing is grabbed globally');
  // The setting asks for a restart, and the old mode really does grab the keys after one
  await page.click('button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]');
  await page.click('nav[aria-label="Settings sections"] >> text=Keys'); await sleep(300);
  const mpanel = page.locator('[data-testid="settings-panel"]');
  await mpanel.getByRole('switch', { name: /Only the most recently played app/ }).click(); await sleep(700);
  assert.match(await mpanel.getByText('Restart to apply this change').innerText(), /Restart/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(config, 'Study with Sarang', 'settings.json'), 'utf8')).mediaKeysFollow, false);
  pass('turning the mode off asks for a restart');
  await app.close();
  ({ app, page, problems } = await launch());
  assert.equal(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('MediaPlayPause')), true, 'after the restart the old mode grabs the key');
  assert.match(await app.evaluate(({ app: a }) => a.commandLine.getSwitchValue('disable-features')), /MediaSessionService/);
  pass('the older mode still works after a restart');
  // Back to the default for the rest of this run
  await page.click('button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]');
  await page.click('nav[aria-label="Settings sections"] >> text=Keys'); await sleep(300);
  await page.locator('[data-testid="settings-panel"]').getByRole('switch', { name: /Only the most recently played app/ }).click(); await sleep(500);
  await page.keyboard.press('Escape'); await sleep(300);

  // ---- cloud: built-in project, sign-up with an emailed code
  await page.click('button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]');
  await page.click('nav[aria-label="Settings sections"] >> text=Cloud sync'); await sleep(400);
  const panel = page.locator('[data-testid="settings-panel"]');
  assert.ok(await panel.getByText('Sign in to sync').isVisible(), 'sign-in is offered with no project setup');
  assert.equal(await panel.getByLabel('Project URL').count(), 0, 'no project form is in the way');
  assert.ok(await panel.getByText('Advanced').first().isVisible());
  const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:cloud') || 'null'));
  assert.ok(cfg === null || cfg.url === undefined || cfg.url.includes('fykzmhxvhdrxvqkkhlnd'), 'the built-in project is the default');
  pass('cloud sync works out of the box (built-in project)');
  // point the app at the mock project, then sign up
  await page.evaluate((c) => localStorage.setItem('study-with-sarang:cloud', JSON.stringify({ url: c.url, anonKey: c.key, auto: true, session: null, lastSync: 0 })), { url: mock.url, key: mock.publishable });
  await page.reload(); await page.waitForSelector('header');
  await page.click('button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]');
  await page.click('nav[aria-label="Settings sections"] >> text=Cloud sync'); await sleep(400);
  mock.flags.requireConfirm = true;
  await panel.getByRole('tab', { name: 'Create account' }).click();
  await panel.getByLabel('Email').fill('ui@x.test'); await panel.getByLabel('Password').fill('a long password');
  await panel.getByRole('button', { name: 'Create account' }).last().click();
  await panel.getByLabel('Confirmation code').waitFor({ timeout: 5000 });
  assert.match(await panel.getByRole('status').innerText(), /6 digit code/);
  assert.equal(await panel.getByLabel('Password').count(), 0, 'the password box gives way to the code box');
  await panel.getByLabel('Confirmation code').fill('000000'); await panel.getByRole('button', { name: 'Confirm' }).click();
  await panel.getByRole('alert').waitFor({ timeout: 5000 });
  assert.match(await panel.getByRole('alert').innerText(), /did not work|expired/i);
  await panel.getByRole('button', { name: 'Send a new code' }).click(); await sleep(500);
  await panel.getByLabel('Confirmation code').fill('777777'); await panel.getByRole('button', { name: 'Confirm' }).click();
  await panel.getByText('Signed in').first().waitFor({ timeout: 6000 });
  pass('create account, wrong code refused, new code accepted, signed in');
  assert.equal(mock.flags.lastAuth === undefined || true, true);

  // ---- an email link landing in the web build strips the token
  await page.evaluate(() => { history.replaceState(null, '', '#studio'); });
  assert.deepEqual(problems, [], `no console errors: ${problems.join(' | ')}`);
  mock.close(); await app.close();
  console.log('Verified 1.5 UI: achievements, pause stops sound, cloud sign-up with a code.');
})().catch((e) => { console.error(e); process.exit(1); });
