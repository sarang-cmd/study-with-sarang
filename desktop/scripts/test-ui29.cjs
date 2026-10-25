'use strict';
/**
 * UI test for the first-run tour, the Focus page (three reasons and the Socratic question) and the neural lock option.
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui29.cjs   (needs `npm run build` first)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui29-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);
const shot = process.env.SWA_SHOTS;

(async () => {
  const launch = () => electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: config, SWA_NO_TOUR: '0' } });
  let app = await launch(); let page = await app.firstWindow(); const problems = [];
  const watch = () => { page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|NotAllowedError|Requested device not found|Permission denied|404/i.test(m.text())) problems.push(m.text()); }); page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`)); };
  watch();
  const ls = (key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
  const tour = '[data-testid="tour"]';

  // ---- a fresh profile gets the tour by itself
  await page.waitForFunction(() => window.desktop && document.querySelector('header'));
  await page.waitForSelector(tour, { timeout: 15000 }); await sleep(500);
  assert.equal(await page.textContent('[data-testid="tour-title"]'), 'Welcome');
  assert.ok((await page.locator('[data-testid="tour-welcome"]').innerText()).includes('A calm place to study'), 'first-time wording');
  if (shot) await page.screenshot({ path: path.join(shot, 'ui29-tour-1.png') });
  await page.click('[data-testid="tour-level-essentials"]'); await sleep(300);
  assert.equal((await ls('study-with-sarang:prefs')).advanced, false);
  await page.click('[data-testid="tour-level-all"]'); await sleep(300);
  assert.equal((await ls('study-with-sarang:prefs')).advanced, true);
  pass('a first run opens the tour by itself and the Essentials or everything can be chosen in it');

  // ---- subjects: pick a programme and a subject right in the tour
  await page.click('[data-testid="tour-next"]'); await sleep(500);
  assert.equal(await page.textContent('[data-testid="tour-title"]'), 'What you study');
  await page.click('[data-testid="tour-subjects"] button[role="radio"]:has-text("IB Diploma")'); await sleep(500);
  await page.click('[data-testid="tour-subjects"] label:has-text("Physics") input[type="checkbox"]'); await sleep(500);
  const profile = await ls('study-with-sarang:subjects'); assert.ok(JSON.stringify(profile).includes('physics'), 'physics was chosen'); assert.equal(profile.curriculum, 'ib');
  if (shot) await page.screenshot({ path: path.join(shot, 'ui29-tour-2.png') });
  pass('the tour asks which programme and subjects you study, with the same choices as Settings');

  // ---- plan step: a goal and a to-do
  for (let i = 0; i < 2; i += 1) { await page.click('[data-testid="tour-next"]'); await sleep(450); }
  assert.equal(await page.textContent('[data-testid="tour-title"]'), 'Goal and to-dos');
  await page.fill('[data-testid="tour-goal"]', 'Two past paper questions'); await page.fill('[data-testid="tour-todo"]', 'Read the waves chapter'); await page.click('[data-testid="tour-todo-add"]'); await sleep(400);
  await page.locator('[data-testid="tour-goal"]').blur(); await sleep(300);
  assert.equal((await ls('study-with-sarang:plan')).goal, 'Two past paper questions'); assert.equal((await ls('study-with-sarang:todos'))[0].text, 'Read the waves chapter');
  pass('the tour lets you set a first goal and to-do');

  // ---- the rest of the steps, then skip is remembered after a reload
  for (const title of ['Progress and unlocks', 'Why it works', 'Beyond the window', 'Optional AI', 'Ready']) { await page.click('[data-testid="tour-next"]'); await sleep(450); assert.equal(await page.textContent('[data-testid="tour-title"]'), title); }
  assert.ok(await page.locator('[data-testid="tour-start"]').count());
  await page.click('[data-testid="tour-done"] button:has-text("Just look around")'); await page.waitForSelector(tour, { state: 'detached' });
  assert.equal((await ls('study-with-sarang:tutorial')).done, true);
  await page.reload(); await page.waitForFunction(() => document.querySelector('header')); await sleep(4000);
  assert.equal(await page.locator(tour).count(), 0, 'it does not come back by itself');
  pass('every step is reachable, finishing is remembered and the tour does not return');

  // ---- re-run from Settings, About; skip with Escape; the AI step opens the walkthrough above everything
  await page.click('header button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]');
  await page.click('[data-testid="settings-panel"] nav button:has-text("About")'); await sleep(500);
  await page.click('[data-testid="about-tour"]'); await page.waitForSelector(tour); await sleep(500);
  assert.ok(await page.isVisible(tour), 'the tour shows above the settings panel');
  for (let i = 0; i < 7; i += 1) { await page.click('[data-testid="tour-next"]'); await sleep(350); }
  await page.click('[data-testid="tour-ai-open"]'); await page.waitForSelector('[data-testid="aiguide"]'); await sleep(400);
  const box = await page.locator('[data-testid="aiguide"]').boundingBox(); const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-testid="aiguide"]') !== null, { x: box.x + 40, y: box.y + 40 });
  assert.equal(top, true, 'the walkthrough is on top of the tour and Settings');
  await page.keyboard.press('Escape'); await page.waitForSelector('[data-testid="aiguide"]', { state: 'detached' });
  await page.keyboard.press('Escape'); await page.waitForSelector(tour, { state: 'detached' });
  assert.equal((await ls('study-with-sarang:tutorial')).skipped, true);
  await page.click('[aria-label="Close settings"]'); await sleep(600);
  pass('the tour re-runs from About above Settings, the AI step opens the walkthrough on top, Escape closes them one at a time');

  // ---- Focus page: three reasons
  await page.evaluate(() => { const k = 'study-with-sarang:subjects'; const p = JSON.parse(localStorage.getItem(k)); p.exam = { ...p.exam, date: '2030-05-06' }; localStorage.setItem(k, JSON.stringify(p)); });
  await page.reload(); await page.waitForFunction(() => document.querySelector('header')); await sleep(1200);
  await page.evaluate(() => { location.hash = 'focus'; }); await page.waitForSelector('[data-testid="focus-reasons"]'); await sleep(900);
  assert.equal(await page.getAttribute('[data-testid="appeal-logos"]', 'aria-selected'), 'true');
  assert.ok((await page.locator('#panel-logos').innerText()).includes('Locke'), 'logos cites goal-setting research');
  await page.click('[data-testid="appeal-ethos"]'); await sleep(500);
  assert.ok((await page.locator('#panel-ethos').innerText()).includes('makes no promise'), 'ethos is honest'); assert.ok(await page.locator('[data-testid="own-record"]').count());
  await page.click('[data-testid="appeal-pathos"]'); await sleep(500);
  assert.ok((await page.locator('#panel-pathos').innerText()).includes('days to go'), 'pathos shows the exam countdown when a session is chosen');
  await page.fill('[data-testid="why-input"]', 'So I can study medicine'); await sleep(300); assert.equal(await page.evaluate(() => localStorage.getItem('study-with-sarang:why')), 'So I can study medicine');
  if (shot) await page.screenshot({ path: path.join(shot, 'ui29-reasons.png'), fullPage: false });
  pass('the Focus page shows ethos, logos and pathos with honest content and your own reason');

  // ---- Socratic question becomes the goal
  const first = await page.textContent('[data-testid="socratic-question"]');
  await page.click('[data-testid="socratic-next"]'); await sleep(400); assert.notEqual(await page.textContent('[data-testid="socratic-question"]'), first);
  assert.equal(await page.locator('[data-testid="socratic-goal"]').isDisabled(), true, 'an empty answer cannot be used');
  await page.fill('[data-testid="socratic-answer"]', 'Finish the waves problem set'); await page.click('[data-testid="socratic-goal"]'); await sleep(500);
  assert.equal((await ls('study-with-sarang:plan')).goal, 'Finish the waves problem set');
  pass('a Socratic question can be answered and used as the goal for the next block');

  // ---- neural lock: visible on the Focus page and as a small card on Studio, off by default, saved when switched on
  await page.waitForSelector('[data-testid="neural-lock"]');
  assert.ok((await page.locator('[data-testid="neural-lock"]').innerText()).includes('not a treatment') || (await page.locator('[data-testid="neural-lock"]').innerText()).toLowerCase().includes('not a treatment'), 'honest');
  assert.equal((await ls('study-with-sarang:prefs'))?.neural?.on ?? false, false);
  await page.locator('[data-testid="neural-lock"] label:has-text("Add the rhythm") input[role="switch"]').click(); await sleep(500);
  let neural = (await ls('study-with-sarang:prefs')).neural; assert.equal(neural.on, true); assert.equal(neural.rate, 16);
  await page.click('[data-testid="neural-lock"] button[role="radio"]:has-text("Slow 8 Hz")'); await sleep(400);
  neural = (await ls('study-with-sarang:prefs')).neural; assert.deepEqual([neural.rate, neural.depth], [8, 30]);
  await page.evaluate(() => { location.hash = 'studio'; }); await page.waitForSelector('[data-testid="neural-compact"]'); await sleep(500);
  assert.match(await page.locator('[data-testid="neural-compact"]').innerText(), /optional/i, 'the Studio card is there at the Power level');
  await page.click('[data-testid="agent-open"]').catch(() => {}); await sleep(200);
  pass('neural lock is off by default, switches on, remembers a preset, and is surfaced on both Studio and Focus');

  assert.deepEqual(problems, [], `console problems: ${problems.join(' | ')}`);
  await app.close();
  console.log('Tour, reasons and neural lock UI tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
