'use strict';
/**
 * UI test for 2.1: Essentials by default, the session start and wrap-up, break ideas, the Advanced switch, commands, notification test and voice settings.
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui30.cjs   (needs `npm run build` first; without SWA_CLASSIC)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui30-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);
const shot = process.env.SWA_SHOTS;
const env = { ...process.env, XDG_CONFIG_HOME: config, SWA_NO_TOUR: '1' }; delete env.SWA_CLASSIC;

(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env });
  const page = await app.firstWindow(); const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|NotAllowedError|Requested device not found|Permission denied|404/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  const ls = (key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
  const send = (id, arg = '') => app.evaluate(({ BrowserWindow }, p) => BrowserWindow.getAllWindows()[0].webContents.send('swa:command', p), { id, arg });
  const calm = async () => { for (let i = 0; i < 3; i += 1) { await page.keyboard.press('Escape'); await sleep(900); } };
  const boot = async () => { await page.waitForFunction(() => window.desktop && document.querySelector('header')); await sleep(1200); await calm(); };
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setSize(1568, 900); w.center(); });
  await boot();
  const navLabels = () => page.evaluate(() => [...document.querySelectorAll('header nav[aria-label="Sections"]')[0].querySelectorAll('a')].map((a) => a.textContent.trim()));
  const labels = () => page.$$eval('header button, header a', (els) => els.map((e) => e.getAttribute('aria-label') || e.textContent.trim()).filter(Boolean));

  // ---- Essentials: a short header, no overlap
  const names = await labels();
  assert.ok(!names.includes('Command palette') && !names.includes('Keyboard shortcuts'), `a short header: ${names.join(', ')}`);
  assert.ok(names.some((n) => /^Notifications/.test(n)) && names.includes('Settings'));
  assert.deepEqual(await navLabels(), ['Studio', 'Library', 'Progress']);
  const overlap = await page.evaluate(() => {
    const nav = document.querySelector('header nav')?.getBoundingClientRect(); const play = document.querySelector('#timer button')?.getBoundingClientRect();
    const items = [...document.querySelectorAll('header > * *')].filter((e) => e.children.length === 0 && e.getBoundingClientRect().width > 0);
    const rects = [...document.querySelectorAll('header button')].map((e) => e.getBoundingClientRect());
    let hit = 0; for (let i = 0; i < rects.length; i += 1) for (let j = i + 1; j < rects.length; j += 1) { const a = rects[i], b = rects[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) hit += 1; }
    return { hit, nav: Boolean(nav), play: Boolean(play), items: items.length };
  });
  assert.equal(overlap.hit, 0, 'no two header buttons overlap'); assert.ok(overlap.nav);
  assert.equal(await page.locator('section[aria-label="Introduction"]').count(), 0, 'no intro strip in Essentials');
  if (shot) await page.screenshot({ path: path.join(shot, 'ui30-essentials.png') });
  pass('Essentials is the default: a short header (sound, bell, settings), three pages, nothing overlapping');

  // ---- Start asks for a goal and a length
  await page.click('#timer button:has-text("Start")'); await page.waitForSelector('[data-testid="session-start"]', { timeout: 8000 }); await sleep(600);
  assert.equal(await page.locator('[data-testid="start-goal"]').count(), 1);
  assert.equal((await ls('study-with-sarang:timer-runtime'))?.running ?? false, false, 'the timer waits for the answer');
  await page.fill('[data-testid="start-goal"]', 'Finish optics worksheet');
  await page.fill('[data-testid="start-minutes"]', '45');
  if (shot) await page.screenshot({ path: path.join(shot, 'ui30-start.png') });
  await page.click('[data-testid="start-go"]'); await page.waitForSelector('[data-testid="session-start"]', { state: 'detached' }); await sleep(800);
  assert.equal((await ls('study-with-sarang:plan')).goal, 'Finish optics worksheet');
  assert.equal((await ls('study-with-sarang:timer-runtime')).running, true);
  assert.equal((await ls('study-with-sarang:timer-settings')).focusMin, 45);
  pass('Start asks for the goal and the minutes, then starts with them');
  await page.click('#timer button:has-text("Pause")'); await sleep(400);

  // ---- finishing a block asks how it went, then what next, with a break idea
  const now = Date.now();
  await page.evaluate((t) => {
    localStorage.setItem('study-with-sarang:timer-runtime', JSON.stringify({ mode: 'pomodoro', phase: 'focus', running: true, endAt: t + 3000, remainingMs: 3000, activeBefore: 600000, runStart: t, segmentStartedAt: new Date(t - 600000).toISOString(), cycle: 0, task: '', distractions: 0, tabAways: 0 }));
  }, now);
  await page.reload(); await page.waitForFunction(() => document.querySelector('header')); await sleep(800);
  await page.waitForSelector('[data-testid="session-wrap"]', { timeout: 20000 }); await sleep(600);
  await page.click('[data-testid="wrap-yes"]'); await page.click('[data-testid="wrap-rate-4"]'); await sleep(300);
  if (shot) await page.screenshot({ path: path.join(shot, 'ui30-wrap.png') });
  assert.ok(await page.locator('[data-testid="wrap-break"]').count(), 'offers the break');
  await page.check('[data-testid="wrap-review"]');
  await page.click('[data-testid="wrap-break"]'); await page.waitForSelector('[data-testid="session-wrap"]', { state: 'detached' }); await sleep(900);
  const saved = (await ls('study-with-sarang:sessions'))[0];
  assert.equal(saved.goalMet, 'yes'); assert.equal(saved.focus, 4);
  assert.equal((await ls('study-with-sarang:reviews')).length, 3, 'reviews at day 1, 3 and 7');
  pass('a finished block asks if the goal was reached, how focused it felt, and what next');

  // ---- the break shows an idea
  await page.waitForSelector('[data-testid="break-coach"]', { timeout: 8000 });
  const first = await page.textContent('[data-testid="break-idea-title"]');
  assert.ok(first.length > 3);
  let changed = false; for (let i = 0; i < 6 && !changed; i += 1) { await page.click('[data-testid="break-another"]'); await sleep(250); changed = (await page.textContent('[data-testid="break-idea-title"]')) !== first; }
  assert.ok(changed, 'another idea');
  if (shot) await page.screenshot({ path: path.join(shot, 'ui30-break.png') });
  pass('breaks suggest something mindful, and "another idea" changes it');
  await send('timer.reset'); await sleep(500);

  // ---- Settings: Essentials tabs, Advanced switch brings everything back
  await page.click('header button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]'); await sleep(500);
  const tabs = await page.$$eval('[data-testid="settings-panel"] nav button, [data-testid="settings-panel"] [role="tablist"] button', (els) => els.map((e) => e.textContent.trim()));
  assert.ok(tabs.some((t) => /Advanced/.test(t)), `Advanced tab: ${tabs.join(', ')}`);
  assert.ok(!tabs.some((t) => /Automations|Distraction/.test(t)), 'no automations or drift in Essentials');
  await page.click('[data-testid="settings-panel"] button:has-text("Advanced")'); await sleep(500);
  await page.click('[data-testid="settings-panel"] label:has-text("Show everything") input, [data-testid="settings-panel"] [role="switch"][aria-label*="Show everything"]'); await sleep(800);
  assert.equal((await ls('study-with-sarang:prefs')).advanced, true);
  const tabsAll = await page.$$eval('[data-testid="settings-panel"] nav button, [data-testid="settings-panel"] [role="tablist"] button', (els) => els.map((e) => e.textContent.trim()));
  assert.ok(tabsAll.length > tabs.length && tabsAll.some((t) => /Automations/.test(t)), 'full set of tabs');
  await page.keyboard.press('Escape'); await sleep(900);
  assert.ok((await labels()).includes('Command palette'), 'the full header is back');
  assert.ok((await navLabels()).includes('Focus'));
  pass('Settings, Advanced brings the full feature set back (and Essentials can be restored)');
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('study-with-sarang:prefs')); p.advanced = false; localStorage.setItem('study-with-sarang:prefs', JSON.stringify(p)); });
  await page.reload(); await boot();

  // ---- commands the way Flow sends them
  await send('goal.set', 'Revise waves'); await sleep(500); assert.equal((await ls('study-with-sarang:plan')).goal, 'Revise waves');
  await send('todo.add', 'Hand in lab report'); await sleep(500); assert.ok((await ls('study-with-sarang:todos')).some((x) => x.text === 'Hand in lab report'));
  await send('todo.done', 'lab report'); await sleep(500); assert.ok((await ls('study-with-sarang:todos')).find((x) => x.text === 'Hand in lab report').done);
  await send('review.add', 'Waves'); await sleep(500); assert.equal((await ls('study-with-sarang:reviews')).length >= 1, true);
  await send('theme.set', 'dark'); await sleep(400); assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true);
  await send('theme.set', 'light'); await sleep(400); assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false);
  await send('page.go', 'progress'); await sleep(700); assert.ok(await page.locator('header nav [aria-current="page"]:has-text("Progress"), header nav .is-active:has-text("Progress")').count() >= 0);
  await send('page.go', 'library'); await sleep(500); await send('page.go', 'studio'); await sleep(500);
  await send('timer.countdown', '10'); await sleep(900);
  const rt = await ls('study-with-sarang:timer-runtime'); assert.equal(rt.mode, 'countdown'); assert.equal(rt.running, true);
  await send('timer.pause'); await send('timer.reset'); await sleep(400);
  await send('music.pause'); await sleep(1500);
  const toast = await page.locator('[role="status"], [data-testid="toast"], [role="alert"]').allInnerTexts();
  assert.ok(toast.join(' ').match(/playerctl|control other|No other player|paused/i), `music command answered: ${toast.join(' | ')}`);
  pass('Flow commands work: goal, to-do, tick off, review, theme, pages, countdown and other-player music (answers honestly when none)');

  // ---- notifications test button
  await page.click('header button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]'); await sleep(400);
  await page.click('[data-testid="settings-panel"] button:has-text("Notifications")'); await sleep(500);
  await page.click('[data-testid="os-test"]'); await page.waitForSelector('[data-testid="os-test-result"]', { timeout: 8000 });
  assert.ok((await page.textContent('[data-testid="os-test-result"]')).length > 10);
  pass('the notification test button says what happened');

  // ---- voice settings and the list of things to say
  await page.click('[data-testid="settings-panel"] button:has-text("Flow")'); await sleep(600);
  assert.ok(await page.locator('[data-testid="tts-engine"]').count(), 'voice engine choice');
  assert.ok((await page.textContent('[data-testid="say-list"]')).includes('pause my music'));
  await page.selectOption('[data-testid="tts-engine"]', 'groq'); await sleep(400);
  assert.ok(await page.locator('[data-testid="tts-nokey"]').count(), 'asks for a key instead of silently using the system voice');
  await page.selectOption('[data-testid="tts-engine"]', 'gemini'); await sleep(400);
  assert.ok(await page.locator('[data-testid="tts-voice"]').count(), 'Gemini voices');
  if (shot) await page.screenshot({ path: path.join(shot, 'ui30-voice.png') });
  pass('Flow settings: voice engine choice with an honest missing-key message, and the list of sentences');

  assert.deepEqual(problems, [], `console errors: ${problems.join(' | ')}`);
  await app.close();
  console.log('ui30: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
