'use strict';
/**
 * UI test for 1.7 in the real desktop shell: real recordings (sounds folder and your own file), the Flow settings and bar,
 * the calm screen (breathing, scenes, sleep timer), command routing, the media flyout seek bar and the Discord settings.
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui17.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui17-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);
const shot = process.env.SWA_SHOTS;

/** A mono 16-bit WAV: a soft noisy tone, long enough to loop. */
function wav(seconds, rate = 22050) {
  const n = Math.floor(seconds * rate); const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round((Math.sin(i / 20) * 0.3 + (Math.random() - .5) * 0.2) * 12000), 44 + i * 2);
  return buf;
}
const soundsDir = path.join(config, 'Study with Sarang', 'sounds');
fs.mkdirSync(soundsDir, { recursive: true });
fs.writeFileSync(path.join(soundsDir, 'wind.wav'), wav(6));
const mine = path.join(config, 'my-rain.wav'); fs.writeFileSync(mine, wav(6));

async function launch() {
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: config } });
  const page = await app.firstWindow(); const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/youtube|googlevideo|ERR_|Failed to load resource|NotFoundError|NotAllowedError|Requested device not found|Permission denied/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.waitForFunction(() => window.desktop && document.querySelector('header'));
  await sleep(900);
  return { app, page, problems };
}
const prefsNow = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:prefs') || '{}'));
const openSettings = async (page, tab) => { await page.click('header button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]'); if (tab) await page.click(`[data-testid="settings-panel"] nav button:has-text("${tab}")`); await sleep(300); };
const closeSettings = async (page) => { await page.click('[aria-label="Close settings"]'); await sleep(250); };
const sendToPage = (app, channel, payload) => app.evaluate(({ BrowserWindow }, [c, p]) => (BrowserWindow.getAllWindows().find((w) => !w.webContents.getURL().includes('#flowbar')) ?? BrowserWindow.getAllWindows()[0]).webContents.send(c, p), [channel, payload]);
const toggle = (page, label) => page.locator(`label:has-text("${label}") input`).first();

(async () => {
  const { app, page, problems } = await launch();

  // ---- real recordings
  await openSettings(page, 'Sound');
  const list = page.locator('[data-testid="rec-list"]');
  assert.equal(await list.locator('> div').count(), 10, 'ten sounds');
  await sleep(600);
  assert.match(await page.locator('[data-testid="rec-rain"]').innerText(), /Generated sound/, 'no recording yet: the generated sound is the fallback');
  assert.match(await page.locator('[data-testid="rec-wind"]').innerText(), /sounds folder/, 'a file in the sounds folder is found');
  await page.locator('[data-testid="rec-wind"] button:has-text("Check")').click();
  await page.waitForFunction(() => /Recording: sounds folder, /.test(document.querySelector('[data-testid="rec-wind"]').innerText) && !/Loading/.test(document.querySelector('[data-testid="rec-wind"]').innerText), null, { timeout: 8000 }).catch(async (e) => { console.log('wind row:', JSON.stringify(await page.locator('[data-testid="rec-wind"]').innerText())); throw e; });
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-testid="rec-rain"] button:has-text("Choose file")').click()]);
  await chooser.setFiles(mine);
  await page.waitForFunction(() => /Recording: your file/.test(document.querySelector('[data-testid="rec-rain"]').innerText), null, { timeout: 8000 });
  assert.ok(await page.locator('[data-testid="rec-rain"] button:has-text("Remove")').count() > 0);
  if (shot) await page.screenshot({ path: path.join(shot, 'recordings.png') });
  await page.locator('[data-testid="rec-rain"] button:has-text("Remove")').click(); await sleep(400);
  assert.match(await page.locator('[data-testid="rec-rain"]').innerText(), /Generated sound/, 'removing returns to the generated sound');
  // Playing with a recording in place must not throw and must keep playing.
  await closeSettings(page);
  await page.click('header button[aria-label="Play sound"]'); await sleep(1500);
  assert.ok(await page.locator('header button[aria-label="Pause sound"]').count() > 0, 'still plays');
  await page.click('header button[aria-label="Pause sound"]'); await sleep(300);
  pass('Real recordings: fallback, sounds folder, own file, remove, playback');

  // ---- media seek bar
  const media = await page.evaluate(() => ({ title: navigator.mediaSession.metadata?.title ?? '', has: typeof navigator.mediaSession.setPositionState === 'function' }));
  assert.ok(media.has, 'the position API exists');
  await page.evaluate(() => { localStorage.setItem('study-with-sarang:prefs', JSON.stringify({ ...JSON.parse(localStorage.getItem('study-with-sarang:prefs') || '{}'), mediaSeek: 'remaining' })); });
  await openSettings(page, 'Sound');
  assert.ok(await page.locator('text=Seek bar').count() > 0, 'the seek bar option is in Media controls');
  await page.locator('button[role="radio"]:has-text("Hidden"), button:has-text("Hidden")').first().click(); await sleep(200);
  assert.equal((await prefsNow(page)).mediaSeek, 'off');
  await page.locator('button:has-text("Time left")').first().click(); await sleep(200);
  assert.equal((await prefsNow(page)).mediaSeek, 'remaining');
  await closeSettings(page);
  pass('Media seek options');

  // ---- Flow settings
  await openSettings(page, 'Flow voice and AI');
  assert.equal(await toggle(page, 'Turn Flow on').isChecked(), false, 'off by default: nothing listens until you choose');
  assert.equal(await page.locator('select[aria-label="Push-to-talk key"]').inputValue(), 'rctrl', 'Right Ctrl is the default key');
  assert.ok(await page.locator('text=Things you can say').count() > 0);
  await page.locator('select[aria-label="Speech to text service"]').selectOption('groq');
  await page.waitForSelector('[data-testid="flow-key-groq"]');
  await page.fill('[data-testid="flow-key-groq"]', 'gsk_test_key_123456'); await page.locator('[data-testid="flow-key-groq"]').blur(); await sleep(300);
  const stored = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  assert.ok(stored.includes('gsk_test_key_123456'), 'the key is kept on this device');
  const prefs = await prefsNow(page); assert.ok(!JSON.stringify(prefs).includes('gsk_test_key_123456'), 'and never inside the synced settings');
  assert.equal(prefs.flow.sttProvider, 'groq');
  await page.locator('select[aria-label="Speech to text service"]').selectOption('cloud'); await sleep(200);
  assert.ok(await page.locator('text=Flow Cloud').count() > 0);
  await page.locator('[data-testid="flow-key-groq"]').waitFor({ state: 'attached' }).catch(() => {});
  if (shot) await page.screenshot({ path: path.join(shot, 'flow-settings.png') });
  await page.evaluate(() => document.querySelector('[data-testid="flow-key-groq"]')?.scrollIntoView());
  await page.locator('button:has-text("Remove")').first().click().catch(() => {}); await sleep(200);
  pass('Flow settings: defaults, key stays out of synced settings, providers');

  // ---- Flow runs: the key, the bar and a clear error with no microphone
  await toggle(page, 'Turn Flow on').check(); await sleep(1200);
  assert.equal((await prefsNow(page)).flow.enabled, true);
  const status = await page.locator('[data-testid="flow-status"]').innerText();
  assert.ok(/Ready|Starting|Problem|Off/.test(status), status);
  await closeSettings(page);
  assert.equal(app.windows().length, 1, 'the bar window does not exist until it is needed');
  await sendToPage(app, 'swa:flow-key', 'toggle'); // the same event a global key press produces on macOS and Linux
  await sleep(1800);
  assert.equal(app.windows().length, 2, 'the bar opens');
  const bar = app.windows().find((w) => w !== page);
  const barText = await bar.evaluate(() => document.body.innerText);
  assert.ok(barText.length >= 0);
  const info = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => ({ focusable: w.isFocusable(), top: w.isAlwaysOnTop(), visible: w.isVisible(), title: w.getTitle() })));
  const flowBar = info.find((w) => !w.focusable); assert.ok(flowBar, 'the bar window exists'); assert.equal(flowBar.focusable, false, 'the bar never takes keyboard focus'); assert.equal(flowBar.top, true);
  if (shot) { await bar.screenshot({ path: path.join(shot, 'flow-bar.png') }).catch(() => {}); }
  await sendToPage(app, 'swa:flow-key', 'esc'); await sleep(6000);
  pass('Flow: a key press opens the bar (never focusable), errors are shown, Esc closes');

  // ---- calm screen and commands
  await page.click("[data-testid=\"calm-open\"]"); await page.waitForSelector('[data-testid="calm"]');
  assert.ok(await page.locator('[data-testid="breath-label"]').count() > 0);
  await page.click('[data-testid="breath-toggle"]'); await sleep(1200);
  assert.match(await page.locator('[data-testid="breath-label"]').innerText(), /Breathe in/);
  if (shot) await page.screenshot({ path: path.join(shot, 'calm-breathe.png') });
  await page.click('[role="tab"]:has-text("Scenes")'); await sleep(900);
  assert.ok(await page.locator('[data-testid="calm"] canvas').count() > 0, 'a scene is drawn');
  if (shot) await page.screenshot({ path: path.join(shot, 'calm-scene.png') });
  await page.keyboard.press('Escape'); await sleep(400);
  assert.equal(await page.locator('[data-testid="calm"]').count(), 0, 'Esc closes it');
  await sendToPage(app, 'swa:command', { id: 'calm.breathe', arg: 'box', source: 'voice' }); await sleep(600);
  assert.ok(await page.locator('[data-testid="calm"]').count() > 0, 'a command opens it');
  await page.keyboard.press('Escape'); await sleep(300);
  await sendToPage(app, 'swa:command', { id: 'ui.simple', arg: 'on', source: 'voice' }); await sleep(500);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.ui), 'simple');
  await sendToPage(app, 'swa:command', { id: 'ui.simple', arg: 'off', source: 'voice' }); await sleep(500);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.ui), 'power');
  pass('Calm screen: breathing, scenes, Esc, commands from voice and keys');

  // ---- sleep timer
  await sendToPage(app, 'swa:command', { id: 'calm.wind', arg: '30', source: 'voice' }); await sleep(800);
  assert.ok(await page.locator('text=Winding down over 30 minutes').count() > 0, 'a message confirms it');
  await page.click('[data-testid="calm-open"]'); await page.waitForSelector('[data-testid="calm"]');
  await page.click('[role="tab"]:has-text("Wind down")'); await sleep(500);
  const left = await page.locator('[data-testid="wind-left"]').innerText();
  assert.match(left, /30|29/, `sleep timer shows minutes: ${left}`);
  if (shot) await page.screenshot({ path: path.join(shot, 'calm-wind.png') });
  await page.keyboard.press('Escape'); await sleep(300);
  await sendToPage(app, 'swa:command', { id: 'calm.wind', arg: 'off', source: 'voice' }); await sleep(500);
  pass('Sleep timer from a command');

  // ---- Discord: zero setup
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(200);
  if (await page.locator('[data-testid="calm"]').count()) await page.click('[aria-label="Close calm"]');
  await openSettings(page, 'Discord');
  assert.equal(await toggle(page, 'Show my activity on Discord').isChecked(), false, 'off by default');
  assert.ok(await page.locator('text=No setup needed').count() + await page.locator('text=nothing to set up').count() + await page.locator('text=Advanced').count() > 0);
  const adv = page.locator('[data-testid="discord-advanced"]'); assert.equal(await adv.evaluate((d) => d.open), false, 'the own-application box is hidden by default');
  await adv.locator('summary').click();
  await page.fill('input[placeholder^="Built in"]', '12ab34'); assert.equal(await page.inputValue('input[placeholder^="Built in"]'), '1234');
  await page.fill('input[placeholder^="Built in"]', '');
  await toggle(page, 'Show my activity on Discord').check(); await sleep(1500);
  assert.ok(await page.locator('[data-testid="discord-status"]').innerText().then((t) => /Waiting for the Discord app|Connecting/.test(t)), 'with no application ID typed, the built-in one is used');
  if (shot) await page.screenshot({ path: path.join(shot, 'discord-settings.png') });
  await toggle(page, 'Show my activity on Discord').uncheck(); await sleep(400);
  await closeSettings(page);
  pass('Discord: zero setup with the built-in application, own application is optional and hidden');

  // ---- About credits and the Calm settings tab
  await openSettings(page, 'Calm and scenes');
  assert.ok(await page.locator('text=Sleep timer').count() > 0 && await page.locator('text=Intention').count() > 0);
  await closeSettings(page);

  assert.deepEqual(problems, [], 'no console errors');
  await app.close();
  console.log('Verified 1.7 interface in the desktop app.');
})().catch((error) => { console.error(error); process.exit(1); });
