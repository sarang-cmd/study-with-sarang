'use strict';
/**
 * Drives the real Electron app through the newer features: the custom sliders, the right-click menu,
 * the YouTube embed (Error 153) and optional cloud sync against a mock Supabase project.
 * Needs a display: xvfb-run -a node scripts/test-features.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const shots = process.env.SWA_SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const results = [];
const WEB = process.env.SWA_WEB_URL; // Run the same checks against the web build in Chromium.
const pass = (name) => { results.push(name); console.log(`PASS ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const { startMock } = await import('./_mock-supabase.mjs');
  const mock = await startMock();
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-feat-'));
  const mainFile = path.join(config, 'web-main.cjs');
  if (WEB) fs.writeFileSync(mainFile, "const { app, BrowserWindow } = require('electron'); app.whenReady().then(() => { const w = new BrowserWindow({ width: 1200, height: 800 }); w.loadURL(process.env.SWA_WEB_URL); });");
  const app = await electron.launch({ executablePath: require('electron'), args: [WEB ? mainFile : root, '--no-sandbox', '--disable-gpu'], env: { ...process.env, SWA_WEB_URL: WEB ?? '', XDG_CONFIG_HOME: config, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' } });
  const page = await app.firstWindow();
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/youtube|googlevideo|ERR_|Failed to load resource/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.waitForFunction((web) => (web || window.desktop) && document.querySelector('#sound'), Boolean(WEB));
  if (!WEB) await page.evaluate(async () => { await window.desktop.getInfo(); });
  await sleep(800);
  const goTab = async (name) => { await page.getByRole('link', { name, exact: true }).first().click(); await sleep(1200); };
  const openCloud = async () => { if (!(await page.locator('[data-testid="settings-panel"]').count())) await page.click('button[aria-label="Settings"]'); await page.click('nav[aria-label="Settings sections"] >> text=Cloud sync'); await sleep(300); };
  const shot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) }); };
  const playing = () => page.locator('header button[aria-label="Pause sound"]').count().then((n) => n > 0);

  // ---------------------------------------------------------------- sliders
  assert.equal(await page.locator('input[type="range"]').count(), 0, 'no native range inputs are left');
  const volume = page.locator('#sound-volume');
  await volume.scrollIntoViewIfNeeded();
  assert.equal(await volume.getAttribute('role'), 'slider');
  let box = await volume.boundingBox();
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
  const now = Number(await volume.getAttribute('aria-valuenow'));
  assert.ok(Math.abs(now - 80) <= 2, `click sets the value (got ${now})`);
  pass('clicking a custom slider sets its value');
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 }); await page.mouse.up();
  assert.ok(Math.abs(Number(await volume.getAttribute('aria-valuenow')) - 20) <= 2, 'dragging follows the pointer');
  await page.mouse.move(box.x - 300, box.y); await page.mouse.down(); await page.mouse.move(box.x - 600, box.y); await page.mouse.up();
  pass('dragging a custom slider follows the pointer');
  await volume.focus();
  await page.keyboard.press('Home'); assert.equal(await volume.getAttribute('aria-valuenow'), '0');
  await page.keyboard.press('ArrowRight'); assert.equal(await volume.getAttribute('aria-valuenow'), '1');
  await page.keyboard.press('PageUp'); assert.equal(await volume.getAttribute('aria-valuenow'), '11');
  await page.keyboard.press('End'); assert.equal(await volume.getAttribute('aria-valuenow'), '100');
  assert.equal(await playing(), false, 'keys on a slider do not toggle the sound');
  await volume.dblclick(); assert.equal(await volume.getAttribute('aria-valuenow'), '50');
  pass('sliders work from the keyboard and reset on double-click');
  assert.ok(await page.locator('[role="slider"][aria-label$=" volume"]').count() >= 20, 'layer sliders are custom too');

  // ---------------------------------------------------------------- right-click menu
  await page.evaluate(() => { document.documentElement.classList.add('dark'); });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await sleep(900);
  await page.mouse.click(300, 650); // empty page area
  await page.mouse.click(40, 560, { button: 'right' });
  const menu = page.locator('[role="menu"]').first();
  await menu.waitFor();
  const labels = await menu.locator('[role="menuitem"],[role="menuitemcheckbox"]').allInnerTexts();
  for (const want of ['Play sound', 'Next variation', 'Switch mix', 'Open zen view', 'Go to section', 'Keyboard shortcuts', ...(WEB ? [] : ['Collapse to mini bar', 'Quit Study with Sarang'])]) assert.ok(labels.some((l) => l.includes(want)), `menu has "${want}"`);
  await shot('menu');
  pass('right-click opens the app menu with sound, timer, view and window items');
  await menu.getByRole('menuitem', { name: /Switch mix/ }).hover();
  await page.getByRole('menuitemcheckbox', { name: /Flow/ }).first().waitFor();
  await sleep(300); await shot('menu-sub');
  await page.getByRole('menuitemcheckbox', { name: /Flow/ }).first().click();
  await page.waitForFunction(() => document.querySelector('header button[aria-label="Pause sound"]'));
  assert.equal(await page.locator('[data-context-menu]').count(), 0, 'choosing an item closes the menu');
  pass('the submenu loads a mix and starts it');
  await page.mouse.click(40, 560, { button: 'right' });
  await page.getByRole('menuitem', { name: /Pause sound/ }).click();
  await page.waitForFunction(() => document.querySelector('header button[aria-label="Play sound"]'));
  pass('Pause sound works from the menu');
  await page.mouse.click(40, 560, { button: 'right' });
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('header button[aria-label="Pause sound"]'));
  await page.mouse.click(40, 560, { button: 'right' }); await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-context-menu]').count(), 0);
  await page.evaluate(() => document.querySelector('header button[aria-label="Pause sound"]').click());
  pass('the menu works from the keyboard and closes with Escape');
  const size = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  await page.mouse.click(size.w - 24, size.h - 6, { button: 'right' });
  const rect = await page.locator('[data-context-menu]').first().boundingBox();
  assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= size.w && rect.y + rect.height <= size.h, 'stays inside the window');
  await page.keyboard.press('Escape');
  pass('the menu stays inside the window at the corners');
  await volume.scrollIntoViewIfNeeded(); await sleep(900); await volume.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Reset to default' }).click();
  assert.equal(await volume.getAttribute('aria-valuenow'), '50');
  pass('right-clicking a slider offers Reset to default');
  await goTab('Library'); await sleep(900);
  await page.getByRole('link', { name: /Source playlist/ }).scrollIntoViewIfNeeded(); await sleep(600);
  await page.getByRole('link', { name: /Source playlist/ }).click({ button: 'right' });
  assert.ok(await page.getByRole('menuitem', { name: /Copy link address/ }).count());
  assert.ok(await page.getByRole('menuitem', { name: /Open link in browser/ }).count());
  await page.keyboard.press('Escape');
  pass('right-clicking a link offers open and copy');
  const urlField = page.getByLabel('YouTube or direct video URL');
  await urlField.click({ button: 'right' });
  assert.equal(await page.locator('[data-context-menu]').count(), 0, 'text fields keep the system menu');
  pass('text fields keep the system menu for copy and paste');

  // ---------------------------------------------------------------- YouTube Error 153
  let online = true;
  try { const r = await fetch('https://www.youtube-nocookie.com/embed/74cOUSKXMz0', { signal: AbortSignal.timeout(5000) }); online = r.ok; } catch { online = false; }
  if (online) {
    await goTab('Library');
    const frame = await (async () => { for (let i = 0; i < 40; i++) { const f = page.frames().find((x) => x.url().includes('youtube-nocookie.com/embed')); if (f) return f; await sleep(250); } })();
    assert.ok(frame, 'the YouTube embed loads');
    await sleep(6000);
    const text = await frame.evaluate(() => document.body.innerText).catch(() => '');
    assert.ok(!/Error 153|configuration error/i.test(text), `no Error 153 (page says: ${text.slice(0, 80)})`);
    assert.ok(/subscribers|Watch on|STUDY|study/i.test(text), 'the player shows the video');
    await shot('video');
    pass('the YouTube embed plays without Error 153');
  } else console.log('SKIP YouTube check (no network)');

  // ---------------------------------------------------------------- cloud sync against the mock project
  await page.evaluate(() => localStorage.setItem('study-with-sarang:mixes', JSON.stringify([{ id: 'm1', name: 'Rain', favorite: false, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', mix: { name: 'Rain', base: 'Rain', volume: 40, layers: {}, tune: {} } }])));
  await openCloud();
  const cloud = page.locator('#cloud');
  assert.equal(await cloud.getByLabel('Project URL').count(), 0, 'the built-in project means no setup is shown');
  await cloud.getByText('Advanced').first().click(); await cloud.getByRole('button', { name: 'Use a different Supabase project' }).click();
  await cloud.getByLabel('Project URL').fill(mock.url);
  await cloud.getByLabel(/Anon \(public\) key/).fill(mock.serviceRole);
  await cloud.getByRole('button', { name: 'Save project' }).click();
  assert.match(await cloud.getByRole('alert').innerText(), /service-role/);
  pass('a service-role key is refused');
  await cloud.getByLabel(/Anon \(public\) key/).fill(mock.anon);
  await cloud.getByRole('button', { name: 'Save project' }).click();
  await cloud.getByRole('tab', { name: 'Create account' }).click();
  await cloud.getByLabel('Email').fill('sarang@example.test');
  await cloud.getByLabel('Password').fill('a long password');
  await shot('cloud-form');
  await cloud.getByRole('button', { name: 'Create account' }).last().click();
  await cloud.getByText('Signed in', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('#cloud')?.innerText.includes('last synced'));
  assert.equal(mock.rows.size, 1, 'the first sync created the cloud row');
  assert.ok(JSON.parse(mock.rows.get('u-1').data.keys['study-with-sarang:mixes'].value).some((m) => m.id === 'm1'));
  await shot('cloud-signed-in');
  pass('create an account, sign in and push the saved mixes');
  // Another device adds a mix in the cloud.
  const row = mock.rows.get('u-1');
  const remoteMixes = JSON.parse(row.data.keys['study-with-sarang:mixes'].value);
  remoteMixes.push({ id: 'm2', name: 'From laptop', favorite: false, createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z', mix: { name: 'From laptop', base: 'Rain', volume: 30, layers: {}, tune: {} } });
  row.data.keys['study-with-sarang:mixes'] = { value: JSON.stringify(remoteMixes), mod: Date.now() + 1000 }; row.rev += 1;
  await cloud.getByRole('button', { name: 'Sync now' }).click();
  await cloud.getByText('Newer data arrived from the cloud').waitFor();
  pass('a change from another device is received and offers a reload');
  await cloud.getByRole('button', { name: 'Reload now' }).click();
  await page.waitForFunction((web) => (web || window.desktop) && document.querySelector('header'), Boolean(WEB));
  const names = await page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:mixes')).map((m) => m.name));
  assert.deepEqual(names.sort(), ['From laptop', 'Rain']);
  await openCloud();
  assert.ok(await page.locator('#cloud').innerText().then((t) => t.includes('sarang@example.test')), 'still signed in after a reload');
  pass('after a reload the merged data is in place and the sign-in is remembered');
  await cloud.getByRole('button', { name: 'Sign out' }).click();
  await cloud.getByText('Sign in to sync').waitFor();
  pass('sign out returns to the sign-in form');

  assert.deepEqual(problems, [], 'no page errors');
  await app.close(); mock.close();
  console.log(`Verified ${results.length} feature checks.`);
})().catch((error) => { console.error('FAIL', error); process.exit(1); });
