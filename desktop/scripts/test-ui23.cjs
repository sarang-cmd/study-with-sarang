'use strict';
/**
 * UI test for the puck: the floating desktop window (shows, works, is customised, dragged and remembered) and the in-app mini player.
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui23.cjs   (needs `npm run build` first)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui23-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);
const shot = process.env.SWA_SHOTS;
const snap = async (page, name) => { if (shot) await page.screenshot({ path: path.join(shot, `ui23-${name}.png`) }); };

(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: config } });
  const page = await app.firstWindow(); const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|NotAllowedError|Requested device not found|Permission denied/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.waitForFunction(() => window.desktop && document.querySelector('header')); await sleep(900);
  const dismiss = async () => { for (let i = 0; i < 4; i += 1) { await page.keyboard.press('Escape'); await sleep(500); } };
  await dismiss();

  const puckPage = async () => {
    for (let i = 0; i < 40; i += 1) { const w = app.windows().find((x) => x.url().endsWith('#puck')); if (w) return w; await sleep(250); }
    return null;
  };
  const puckBounds = () => app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find((x) => !x.isDestroyed() && x.getTitle() === 'Puck' || (!x.isDestroyed() && x.webContents.getURL().endsWith('#puck'))); return w ? { ...w.getBounds(), visible: w.isVisible(), focusable: w.isFocusable() } : null; });
  const panel = '[data-testid="settings-panel"]';
  const radio = (group, name) => page.click(`${panel} [role="radiogroup"][aria-label="${group}"] [role="radio"]:has-text("${name}")`);

  // ---- nothing floats until the person asks
  assert.equal(await puckBounds(), null, 'no puck window exists by default');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:puck') ?? '{"desk":"off"}').desk), 'off');

  // ---- Settings: the tab, the preview, and turning the floating puck on
  await page.click('header button[aria-label="Settings"]'); await page.waitForSelector(panel);
  await page.click(`${panel} nav button:has-text("Mini player and puck")`); await sleep(400);
  assert.equal(await page.locator('[data-testid="puck-preview"] [data-testid="puck"]').count(), 1, 'a live preview');
  await radio('Floating puck', 'Always'); await sleep(300);
  assert.equal(await puckBounds(), null, 'idle and "only while something runs" is on: still hidden');
  await page.locator(`${panel} :text("Only while something is playing")`).first().click(); await sleep(700);
  const pk = await puckPage();
  assert.ok(pk, 'the floating puck window appears');
  await pk.waitForSelector('[data-testid="puck"]'); await sleep(500);
  const b = await puckBounds(); assert.equal(b.visible, true); assert.equal(b.focusable, false, 'it never takes the keyboard');
  await snap(page, 'settings');
  pass('the floating puck is off until chosen, then appears without taking focus');

  // ---- it works: timer and sound round trip through the main window
  const label = (id) => pk.locator(`[data-testid="${id}"]`).getAttribute('aria-label');
  assert.equal(await label('puck-main'), 'Start timer');
  await pk.click('[data-testid="puck-main"]'); await pk.waitForFunction(() => document.querySelector('[data-testid="puck-main"]')?.getAttribute('aria-label') === 'Pause timer', null, { timeout: 15000 });
  assert.equal(await pk.locator('[data-testid="puck"]').getAttribute('data-running'), 'true');
  await pk.click('[data-testid="puck-main"]'); await pk.waitForFunction(() => document.querySelector('[data-testid="puck-main"]')?.getAttribute('aria-label') === 'Start timer', null, { timeout: 15000 });
  await pk.click('[data-testid="puck-sound"]'); await pk.waitForFunction(() => document.querySelector('[data-testid="puck-sound"]')?.getAttribute('aria-label') === 'Pause sound', null, { timeout: 15000 });
  assert.ok(await page.locator('header button[aria-label="Pause sound"]').count() >= 1, 'the main window follows');
  await pk.click('[data-testid="puck-sound"]'); await pk.waitForFunction(() => document.querySelector('[data-testid="puck-sound"]')?.getAttribute('aria-label') === 'Play sound', null, { timeout: 15000 });
  await snap(pk, 'puck');
  pass('the floating puck starts and pauses the timer and the sound');

  // ---- customising: buttons, big button, words
  const remove = (name) => page.click(`${panel} [data-testid="puck-actions"] button[aria-label="Remove ${name}"]`);
  await remove('Next sound variation'); await sleep(500);
  assert.equal(await pk.locator('[data-testid="puck-next"]').count(), 0, 'a removed button disappears from the floating puck');
  await page.click(`${panel} [role="group"][aria-label="Add a button"] button:has-text("I drifted")`); await sleep(500);
  assert.equal(await pk.locator('[data-testid="puck-drift"]').count(), 1);
  await page.click(`${panel} [data-testid="puck-actions"] button[aria-label="Move I drifted earlier"]`); await sleep(300);
  const order = await pk.locator('[data-testid="puck"] > button[data-testid^="puck-"]:not([data-testid="puck-main"]):not([data-testid="puck-label"])').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  assert.deepEqual(order, ['puck-skip', 'puck-sound', 'puck-drift', 'puck-zen'], 'moving a button earlier moves it on the puck');
  await radio('Big button', 'Sound'); await sleep(500);
  assert.equal(await pk.locator('[data-testid="puck"]').getAttribute('data-main'), 'sound'); assert.equal(await pk.locator('[data-testid="puck-sound"]').count(), 0, 'the big button\'s action is not repeated');
  assert.equal(await pk.locator('[data-testid="puck-timer"]').count(), 0);
  await page.click(`${panel} [role="group"][aria-label="What the puck shows"] button:has-text("Clock")`); await sleep(300);
  assert.equal(await pk.locator('[data-info="clock"]').count(), 0, 'the clock is hidden when unticked');
  await page.click(`${panel} [role="group"][aria-label="What the puck shows"] button:has-text("Focus or break")`); await sleep(400);
  assert.equal(await pk.locator('[data-info="phase"]').count(), 1);
  await radio('Puck size', 'Large'); await sleep(700);
  assert.ok((await puckBounds()).height > 60, 'a large puck is taller');
  await radio('Puck size', 'Normal'); await sleep(300);
  pass('buttons, the big button, words and size all follow the settings');

  // ---- dragging by the grip, and it is remembered
  const before = await puckBounds();
  await pk.evaluate(async () => {
    const grip = document.querySelector('[data-testid="puck-grip"]'); const fire = (type, x, y) => grip.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, screenX: x, screenY: y, clientX: 5, clientY: 5 }));
    fire('pointerdown', 1000, 500); for (let i = 1; i <= 6; i += 1) { fire('pointermove', 1000 + 20 * i, 500 - 15 * i); await new Promise((r) => setTimeout(r, 40)); } fire('pointerup', 1120, 410);
  }); await sleep(600);
  const after = await puckBounds();
  assert.ok(Math.abs(after.x - (before.x + 120)) <= 3 && Math.abs(after.y - (before.y - 90)) <= 3, `dragged by the grip (${before.x},${before.y}) -> (${after.x},${after.y})`);
  await sleep(1500);
  const settingsFile = fs.readdirSync(config).map((d) => path.join(config, d, 'settings.json')).find((f) => fs.existsSync(f));
  assert.ok(settingsFile, 'the shell settings file exists');
  const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf8')).puckPos; assert.ok(saved && Math.abs(saved.x - after.x) <= 1, 'the new place is saved');
  await page.click(`${panel} button:has-text("Put it back in its corner")`); await sleep(800);
  const home = await puckBounds(); assert.notEqual(home.x, after.x, 'reset puts it back in the corner');
  pass('the floating puck is dragged by its grip, remembers its place and can be reset');

  // ---- switching it off closes it; the in-app mini player has its own options
  await radio('Floating puck', 'Off'); await sleep(900);
  assert.equal((await puckBounds()).visible, false, 'off hides the floating puck');
  await radio('Mini player in the app', 'Always'); await sleep(400);
  await page.click('[aria-label="Close settings"]'); await sleep(500);
  const mini = page.locator('[data-testid="puck"]'); await mini.first().waitFor({ timeout: 10000 });
  const vp = page.viewportSize() ?? { width: 1500, height: 1000 }; const mb = await mini.first().boundingBox();
  assert.ok(mb.x < vp.width / 2 && mb.y > vp.height / 2, 'bottom left by default');
  await snap(page, 'mini');
  await page.click('header button[aria-label="Settings"]'); await page.waitForSelector(panel); await page.click(`${panel} nav button:has-text("Mini player and puck")`); await sleep(300);
  await radio('Corner', 'Top right'); await page.click('[aria-label="Close settings"]'); await sleep(900);
  const mb2 = await page.locator('[data-testid="puck"]').first().boundingBox();
  assert.ok(mb2.x > vp.width / 2 && mb2.y < vp.height / 2, 'moves to the chosen corner');
  await page.click('header button[aria-label="Settings"]'); await page.waitForSelector(panel); await page.click(`${panel} nav button:has-text("Mini player and puck")`); await sleep(300);
  await radio('Mini player in the app', 'Off'); await page.click('[aria-label="Close settings"]'); await sleep(900);
  assert.equal(await page.locator('body > div [data-testid="puck"], #root > div [data-testid="puck"]').count(), 0, 'off removes it');
  pass('the in-app mini player: corner, always, off');

  assert.deepEqual(problems, [], `console problems: ${problems.join(' | ')}`);
  await app.close();
  console.log('Puck UI tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
