'use strict';
/**
 * UI test for monitors and snapping: screen names, snap layouts (settings grid, title bar menu, command), "show which is which",
 * and monitor rules fired by a (simulated) screen being plugged in and removed.
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui24.cjs   (needs `npm run build` first)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui24-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);
const shot = process.env.SWA_SHOTS;
const snap = async (page, name) => { if (shot) await page.screenshot({ path: path.join(shot, `ui24-${name}.png`) }); };

(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: config, SWA_PREVIEW_TITLEBAR: 'custom' } });
  const page = await app.firstWindow(); const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|NotAllowedError|Requested device not found|Permission denied/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.waitForFunction(() => window.desktop && document.querySelector('header')); await sleep(900);
  for (let i = 0; i < 4; i += 1) { await page.keyboard.press('Escape'); await sleep(500); }
  const winInfo = () => app.evaluate(({ BrowserWindow, screen }) => {
    const w = BrowserWindow.getAllWindows().find((x) => !x.isDestroyed() && x.getTitle() !== 'Puck' && x.webContents.getURL().includes('index.html') && !x.webContents.getURL().includes('#'));
    return { b: w.getBounds(), wa: screen.getPrimaryDisplay().workArea, max: w.isMaximized(), full: w.isFullScreen() };
  });
  const near = (a, b, m) => assert.ok(Math.abs(a - b) <= 2, `${m}: ${a} vs ${b}`);
  const panel = '[data-testid="settings-panel"]';
  const openTab = async () => { await page.click('header button[aria-label="Settings"]'); await page.waitForSelector(panel); await page.click(`${panel} nav button:has-text("Window and updates")`); await sleep(500); };

  // ---- the screens, named
  await openTab();
  assert.equal(await page.locator('[data-testid="monitor-list"] li').count(), 1);
  assert.match(await page.locator('[data-testid="monitor-list"] li').first().textContent(), /the app is here/);
  const key = await page.locator('[data-testid="monitor-list"] li').first().getAttribute('data-monitor');
  await page.fill('input[aria-label="Name for screen 1"]', 'Desk monitor'); await page.keyboard.press('Tab'); await sleep(800);
  assert.match(await page.locator('[data-testid="monitor-list"] li').first().textContent(), /Desk monitor/, 'your own name replaces the generic one');
  pass('screens are listed with a name, size and where the app is, and can be renamed');

  // ---- snapping from the settings grid and the command
  const snapTo = async (layout) => { await page.click(`[data-testid="snap-grid"] [data-snap="${layout}"]`); await sleep(500); return winInfo(); };
  let w = await snapTo('left'); near(w.b.x, w.wa.x, 'left x'); near(w.b.width, Math.floor(w.wa.width / 2), 'left width'); near(w.b.height, w.wa.height, 'full height');
  w = await snapTo('right'); near(w.b.x, w.wa.x + Math.floor(w.wa.width / 2), 'right x');
  w = await snapTo('topleft'); near(w.b.width, Math.floor(w.wa.width / 2), 'quarter width'); near(w.b.height, Math.max(540, Math.floor(w.wa.height / 2)), 'quarter height (never below the window\'s smallest size)'); near(w.b.y, w.wa.y, 'top');
  w = await snapTo('bottomright'); near(w.b.y + w.b.height, w.wa.y + w.wa.height, 'bottom edge'); near(w.b.x + w.b.width, w.wa.x + w.wa.width, 'right edge');
  w = await snapTo('third-middle'); near(w.b.width, Math.floor(w.wa.width / 3), 'third width');
  w = await snapTo('center'); near(w.b.x + w.b.width / 2, w.wa.x + w.wa.width / 2, 'centered');
  await page.evaluate(() => window.desktop.command('window.snap:left')); await sleep(500); w = await winInfo(); near(w.b.width, Math.floor(w.wa.width / 2), 'command: left');
  await page.evaluate(() => window.desktop.command('window.snap:bogus')); await sleep(300); w = await winInfo(); near(w.b.width, Math.floor(w.wa.width / 2), 'unknown layouts are ignored');
  await snap(page, 'monitors');
  pass('snap layouts put the window where they say, from the grid and from the command');

  // ---- the title bar menu works with the app's own buttons
  await page.click('[aria-label="Close settings"]'); await sleep(500);
  await page.click('[data-testid="snap-menu-button"]'); await page.waitForSelector('[data-testid="snap-menu"]');
  assert.equal(await page.locator('[data-testid="snap-menu"] [role="menuitem"]').count(), 12);
  await page.click('[data-testid="snap-menu"] [data-snap="right"]'); await sleep(600);
  w = await winInfo(); near(w.b.x, w.wa.x + Math.floor(w.wa.width / 2), 'menu: right');
  assert.equal(await page.locator('[data-testid="snap-menu"]').count(), 0, 'the menu closes after a choice');
  await snap(page, 'titlebar');
  pass('the title bar snap menu works');

  // ---- show which is which
  await openTab();
  await page.click('button:has-text("Show which is which")'); await sleep(1200);
  const labels = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((x) => !x.isDestroyed() && x.getTitle() === 'Monitor label').length);
  assert.equal(labels, 1, 'one label per screen'); await sleep(3200);
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((x) => !x.isDestroyed() && x.getTitle() === 'Monitor label').length), 0, 'labels disappear by themselves');
  pass('every screen can flash its number and name');

  // ---- rules: plug in, then remove
  await page.click('[data-testid="add-monitor-rule"]'); await sleep(500);
  const rule = page.locator('[data-testid="monitor-rules"] li').first();
  await rule.locator('select[aria-label="Which screen"]').selectOption(key);
  await rule.locator('select[aria-label="Then do"]').selectOption('zen'); await sleep(300);
  await page.click('[data-testid="add-monitor-rule"]'); await sleep(500);
  const rule2 = page.locator('[data-testid="monitor-rules"] li').nth(1);
  await rule2.locator('select[aria-label="Connects or leaves"]').selectOption('disconnect');
  await rule2.locator('select[aria-label="Which screen"]').selectOption(key);
  await rule2.locator('select[aria-label="Then do"]').selectOption('zen-off'); await sleep(800);
  assert.equal(await rule2.locator('select[aria-label="Move the app to"]').inputValue(), 'primary', 'a leaving screen sends the app to the main screen by default');
  await page.click('[aria-label="Close settings"]'); await sleep(500);
  assert.equal(await page.getByRole('dialog', { name: 'Zen view' }).count(), 0);
  await app.evaluate(({ screen }) => screen.emit('display-added', {}, screen.getPrimaryDisplay())); await sleep(3500);
  await page.getByRole('dialog', { name: 'Zen view' }).waitFor({ timeout: 8000 });
  w = await winInfo(); near(w.b.x + w.b.width / 2, w.wa.x + w.wa.width / 2, 'the app moved onto the screen that connected');
  await snap(page, 'rule-zen');
  await app.evaluate(({ screen }) => screen.emit('display-removed', {}, screen.getPrimaryDisplay())); await sleep(2500);
  await page.getByRole('dialog', { name: 'Zen view' }).waitFor({ state: 'detached', timeout: 10000 });
  pass('a rule moves the app and opens Zen when a screen connects, and closes it when the screen leaves');

  // ---- remembered
  await sleep(1200);
  const file = fs.readdirSync(config).map((d) => path.join(config, d, 'settings.json')).find((f) => fs.existsSync(f));
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.monitors.rules.length, 2); assert.equal(saved.monitors.names[key], 'Desk monitor'); assert.ok(saved.monitors.seen[key], 'the screen is remembered, so a rule can name it even when it is unplugged');
  assert.equal(saved.nativeControls, true, 'system window buttons by default');
  pass('names and rules are saved');

  assert.deepEqual(problems, [], `console problems: ${problems.join(' | ')}`);
  await app.close();
  console.log('Monitor UI tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
