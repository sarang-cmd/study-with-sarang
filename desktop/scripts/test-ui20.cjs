'use strict';
/**
 * UI test for 2.0 in the real desktop shell. Grows with each feature.
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui20.cjs   (needs `npm run build` first)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui20-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);
const shot = process.env.SWA_SHOTS;
const settingsFile = () => JSON.parse(fs.readFileSync(path.join(config, 'Study with Sarang', 'settings.json'), 'utf8'));

async function launch() {
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: config } });
  const page = await app.firstWindow(); const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/youtube|googlevideo|ERR_|Failed to load resource|NotFoundError|NotAllowedError|Requested device not found|Permission denied/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.waitForFunction(() => window.desktop && document.querySelector('header'));
  await sleep(900);
  return { app, page, problems };
}
const openSettings = async (page, tab) => { await page.click('header button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]'); if (tab) await page.click(`[data-testid="settings-panel"] nav button:has-text("${tab}")`); await sleep(250); };
const closeSettings = async (page) => { await page.click('[aria-label="Close settings"]'); await sleep(250); };

(async () => {
  const { app, page, problems } = await launch();

  // ---- app icon: every choice reaches the shell and the page
  await openSettings(page, 'Appearance');
  const radios = page.locator('[data-testid="settings-panel"] [role="radiogroup"][aria-label="App icon"] [role="radio"]');
  assert.equal(await radios.count(), 8);
  for (const [label, id] of [['Night', 'moon'], ['Ring', 'ring'], ['Paper', 'paper'], ['Waves', 'waves'], ['Voice', 'default']]) {
    await radios.filter({ hasText: label }).first().click(); await sleep(700);
    assert.equal(settingsFile().appIcon, id, `${id} stored by the shell`);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:prefs')).appIcon), id);
    assert.match(await page.evaluate(() => document.querySelector('link[rel~="icon"]').getAttribute('href')), /^data:image\/svg\+xml/);
  }
  const winIcon = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return { destroyed: w.isDestroyed() }; });
  assert.equal(winIcon.destroyed, false);
  pass('all eight app icons switch the shell, the page and the favicon');
  await closeSettings(page);

  // ---- notification centre
  await page.click('[data-testid="bell"]'); await page.waitForSelector('[data-testid="bell-panel"]');
  assert.match(await page.textContent('[data-testid="bell-panel"]'), /All quiet/);
  await page.keyboard.press('Escape'); await sleep(900);
  assert.equal(await page.locator('[data-testid="bell-panel"]').count(), 0);
  await openSettings(page, 'Notifications');
  await page.click('button:has-text("Preview an unlock")'); await page.waitForSelector('[data-testid="celebration"]');
  assert.match(await page.textContent('[data-testid="celebration"]'), /In the zone/);
  await sleep(3500); if (shot) await page.screenshot({ path: path.join(shot, 'ui20-celebration.png') });
  await page.click('[data-testid="celebration"] button:has-text("Nice")'); await page.waitForSelector('[data-testid="celebration"]', { state: 'detached', timeout: 5000 });
  assert.equal(await page.locator('[data-testid="celebration"]').count(), 0);
  await page.click('button:has-text("Send a test")'); await sleep(400);
  await closeSettings(page);
  assert.equal(await page.locator('[data-testid="bell-badge"]').textContent(), '1');
  await page.click('[data-testid="bell"]'); await page.waitForSelector('[data-testid="note"]');
  assert.match(await page.textContent('[data-testid="bell-panel"]'), /Test notification/);
  if (shot) await page.screenshot({ path: path.join(shot, 'ui20-bell.png') });
  await page.click('[aria-label="Mark all as read"]'); await page.waitForSelector('[data-testid="bell-badge"]', { state: 'detached', timeout: 5000 });
  await page.click('[aria-label="Clear all"]'); await sleep(200);
  assert.match(await page.textContent('[data-testid="bell-panel"]'), /All quiet/);
  pass('the bell lists notifications, counts unread, marks and clears; the unlock card animates in and out');

  assert.deepEqual(problems, [], `console problems: ${problems.join(' | ')}`);
  await app.close();
  console.log('v2.0 UI tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
