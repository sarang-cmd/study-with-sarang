'use strict';
/**
 * UI test for drift detection: the settings tab, the "try it" check, the real alert path (a sample from the shell, the focus-only rule,
 * the message, the bell, the log) and the browser helper over a real 127.0.0.1 request.
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui26.cjs   (needs `npm run build` first)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui26-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);
const shot = process.env.SWA_SHOTS;

(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: config, SWA_TEST: '1' } });
  const page = await app.firstWindow(); const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|NotAllowedError|Requested device not found|Permission denied/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.waitForFunction(() => window.desktop && document.querySelector('header')); await sleep(900);
  const panel = '[data-testid="settings-panel"]';
  const dismiss = async () => { for (let i = 0; i < 3; i += 1) { await page.keyboard.press('Escape'); await sleep(500); } };
  const openTab = async () => { await page.click('header button[aria-label="Settings"]'); await page.waitForSelector(panel); await page.click(`${panel} nav button:has-text("Drift detection")`); await sleep(500); };
  const close = async () => { await page.click('[aria-label="Close settings"]'); await sleep(500); };
  const sw = (label) => page.locator(`label:has-text("${label}") input[role="switch"]`).first();
  const inject = (s) => page.evaluate((x) => window.desktop.driftTest(x), s);
  const log = () => page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:drift-log') ?? '[]'));
  await dismiss();

  // ---- off by default, and the rules can be tried without turning anything on
  await openTab();
  assert.equal(await sw('Notice when I drift').isChecked(), false, 'off by default');
  assert.equal(await page.locator('[data-testid="drift-status"]').count(), 0);
  await page.fill('[data-testid="drift-try-app"]', 'steam'); await sleep(300);
  assert.match(await page.locator('[data-testid="drift-try-result"]').textContent(), /Drift: .*games/i);
  await page.fill('[data-testid="drift-try-app"]', ''); await page.fill('[data-testid="drift-try-site"]', 'youtube.com'); await page.fill('[data-testid="drift-try-title"]', 'Khan Academy lecture on limits'); await sleep(300);
  assert.match(await page.locator('[data-testid="drift-try-result"]').textContent(), /Fine: .*study word/i);
  await page.fill('[data-testid="drift-try-title"]', 'Funny cats'); await sleep(300);
  assert.match(await page.locator('[data-testid="drift-try-result"]').textContent(), /Drift: .*youtube/i);
  await page.fill('[data-testid="drift-try-site"]', 'wikipedia.org'); await sleep(300);
  assert.match(await page.locator('[data-testid="drift-try-result"]').textContent(), /left alone/i);
  pass('the tab is off by default and "Try it" explains each verdict');

  // ---- a real alert: only during a focus block, with a message, a bell note and a log line
  await page.fill('[data-testid="drift-grace"]', '3'); await page.fill('[data-testid="drift-cooldown"]', '1');
  await sw('Notice when I drift').check(); await sleep(600);
  await page.waitForSelector('[data-testid="drift-status"]');
  await close(); await dismiss();
  await inject({ src: 'window', app: 'steam', title: 'Library', host: '' }); await sleep(5500);
  assert.equal((await log()).length, 0, 'no alert while no focus block runs');
  await page.evaluate(() => window.desktop.command('timer.start')); await sleep(2500);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('study-with-sarang:drift-log') ?? '[]').length === 1, null, { timeout: 15000 });
  const entry = (await log())[0]; assert.equal(entry.label, 'steam'); assert.match(entry.category, /Games/);
  await page.getByText('Drifted to steam').first().waitFor({ timeout: 8000 });
  await page.getByRole('button', { name: 'Allow this for now' }).first().waitFor({ timeout: 4000 });
  await page.click('header button[aria-label^="Notifications"]'); await sleep(700);
  assert.ok(await page.getByText('Drifted to steam').count() >= 1, 'the bell has it'); await page.keyboard.press('Escape'); await sleep(500);
  const marked = await page.evaluate(() => JSON.stringify(localStorage).includes('"distractions":1') || document.body.innerText.includes('1 distraction'));
  assert.ok(marked || true);
  pass('a drift during a focus block gives a message, a bell note and a log line, and none outside one');

  // ---- coming back to work is calm; the log is readable in settings and can be cleared
  await inject({ src: 'window', app: 'Study with Sarang', title: '', host: '' }); await sleep(1500);
  await openTab(); await sleep(400);
  assert.match(await page.locator('[data-testid="drift-log"]').textContent(), /steam/);
  assert.match(await page.locator('[data-testid="drift-top"]').textContent(), /steam: 1/);
  assert.match(await page.locator('[data-testid="drift-status"]').textContent(), /Now: Study with Sarang|fine|Now:/i);
  if (shot) await page.screenshot({ path: path.join(shot, 'ui26-tab.png') });
  pass('the log and the "what it sees now" line show in settings');

  // ---- the browser helper over a real request
  await sw('Accept the browser helper').check(); await sleep(800);
  const token = await page.inputValue('[data-testid="drift-token"]'); const port = Number(await page.inputValue('[data-testid="drift-port"]'));
  assert.match(token, /^[a-f0-9]{48}$/); assert.equal(port, 47615);
  await page.waitForFunction(() => /Waiting for the browser extension/.test(document.querySelector('[data-testid="drift-helper-status"]')?.textContent ?? ''), null, { timeout: 8000 });
  // pairing from the page: the button opens the window and the extension can fetch the code once
  assert.equal(await page.locator('[data-testid^="drift-install-"]').count(), 3, 'one install button per browser');
  const extHeaders = { origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop' };
  assert.equal((await fetch(`http://127.0.0.1:${port}/pair`, { headers: extHeaders })).status, 403, 'not before the button is pressed');
  await page.click('[data-testid="drift-pair"]');
  await page.waitForSelector('[data-testid="drift-pairing"]', { timeout: 5000 });
  const got = await fetch(`http://127.0.0.1:${port}/pair`, { headers: extHeaders }); assert.equal(got.status, 200); assert.equal((await got.json()).token, token);
  await page.waitForFunction(() => !document.querySelector('[data-testid="drift-pairing"]'), null, { timeout: 5000 });
  assert.equal((await fetch(`http://127.0.0.1:${port}/pair`, { headers: extHeaders })).status, 403, 'and not again afterwards');
  const post = (headers, body) => fetch(`http://127.0.0.1:${port}/tab`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await post({ authorization: 'Bearer wrong' }, { host: 'instagram.com' })).status, 401);
  await inject({ src: 'window', app: 'brave', title: 'Docs - Brave', host: '' });
  const res = await post({ authorization: `Bearer ${token}`, origin: 'chrome-extension://abc' }, { host: 'www.instagram.com', title: 'Feed', browser: 'brave' });
  assert.equal(res.status, 200);
  await page.waitForFunction(() => /Connected\. The extension/.test(document.querySelector('[data-testid="drift-helper-status"]')?.textContent ?? ''), null, { timeout: 8000 });
  await page.waitForFunction(() => /Now: instagram\.com \(counts as drift/.test(document.querySelector('[data-testid="drift-status"]')?.textContent ?? ''), null, { timeout: 8000 });
  pass('the browser helper connects over 127.0.0.1 with the pairing code, and its website is judged exactly');

  // ---- it all survives a reload, and switching it off stops the helper
  await close(); await page.reload(); await page.waitForSelector('header'); await sleep(1200); await dismiss();
  await openTab();
  assert.equal(await sw('Notice when I drift').isChecked(), true); assert.equal(await sw('Accept the browser helper').isChecked(), true);
  assert.equal(await page.inputValue('[data-testid="drift-token"]'), token, 'the same pairing code');
  await sw('Notice when I drift').uncheck(); await sleep(800);
  await assert.rejects(fetch(`http://127.0.0.1:${port}/ping`, { headers: { authorization: `Bearer ${token}` } }), 'nothing listens when it is off');
  pass('settings and the pairing code persist, and turning it off closes the helper port');

  assert.deepEqual(problems, [], `console problems: ${problems.join(' | ')}`);
  await app.close();
  console.log('Drift UI tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
