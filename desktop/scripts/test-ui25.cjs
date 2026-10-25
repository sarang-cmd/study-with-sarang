'use strict';
/**
 * UI test for automations: build a rule in Settings, watch it run from a real event, test conditions, the loop guard, templates,
 * the time-of-day trigger, and that rules survive a reload.
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui25.cjs   (needs `npm run build` first)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui25-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);
const shot = process.env.SWA_SHOTS;
const snap = async (page, name) => { if (shot) await page.screenshot({ path: path.join(shot, `ui25-${name}.png`) }); };

(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: config } });
  const page = await app.firstWindow(); const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|NotAllowedError|Requested device not found|Permission denied/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.waitForFunction(() => window.desktop && document.querySelector('header')); await sleep(900);
  const panel = '[data-testid="settings-panel"]';
  const playing = () => page.evaluate(() => Boolean(document.querySelector('header button[aria-label="Pause sound"]')));
  const setSound = async (on) => { if ((await playing()) !== on) { await page.click(`header button[aria-label="${on ? 'Play sound' : 'Pause sound'}"]`); await sleep(1200); } };
  const log = () => page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:automation-log') ?? '[]'));
  const autos = () => page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:automations') ?? '[]'));
  const openTab = async () => { await page.click('header button[aria-label="Settings"]'); await page.waitForSelector(panel); await page.click(`${panel} nav button:has-text("Automations")`); await sleep(500); };
  const close = async () => { await page.click('[aria-label="Close settings"]'); await sleep(500); };
  const dismiss = async () => { for (let i = 0; i < 3; i += 1) { await page.keyboard.press('Escape'); await sleep(500); } };
  await dismiss();

  // ---- build a rule: when sound starts, show a message
  await openTab();
  assert.equal(await page.locator('[data-testid="auto-list"] li[data-auto]').count(), 0, 'nothing is set up by default');
  await page.click('[data-testid="auto-add"]'); await sleep(500);
  const card = page.locator('[data-testid="auto-list"] li[data-auto]').first();
  await card.locator('input[aria-label="Automation name"]').fill('Hello rule');
  await card.locator('select[aria-label="Trigger"]').selectOption('sound-start');
  await card.locator('select[aria-label="Step 1 action"]').selectOption('notify');
  await card.locator('input[aria-label="Step 1 message"]').fill('Sound is on, good luck');
  await card.locator('select[aria-label="How often"]').selectOption('daily'); await sleep(400);
  await snap(page, 'editor');
  assert.equal((await autos())[0].steps[0].value, 'Sound is on, good luck'); assert.equal((await autos())[0].limit, 'daily');
  await close();
  await setSound(true);
  await page.getByText('Sound is on, good luck').first().waitFor({ timeout: 8000 });
  assert.equal((await log()).filter((e) => e.note === 'ran').length, 1, 'it ran once');
  pass('a rule built in Settings runs when its event happens, and shows its message');

  // ---- "once a day": a second start the same day is not a second run
  await setSound(false); await sleep(2000); await setSound(true); await sleep(1500);
  assert.equal((await log()).filter((e) => e.note === 'ran' && e.name === 'Hello rule').length, 1, 'limited to once a day');
  await openTab();
  assert.match(await page.locator('[data-testid="auto-log"]').textContent(), /Hello rule/);
  await card.locator('[aria-label="Edit"]').click(); await sleep(400);
  await page.click('[data-testid="auto-test"]'); await sleep(900);
  assert.ok((await log()).some((e) => e.note === 'test run'), '"Test now" runs the steps at once');
  pass('conditions and the log work, and a rule can be tested at once');

  // ---- the loop guard: start -> pause, stop -> play would ping-pong forever
  await close(); await setSound(false); await sleep(1500); await openTab();
  await page.locator('[data-testid="auto-list"] li[data-auto]').first().locator('input[role="switch"]').uncheck(); await sleep(300);
  for (const [name, trig, step] of [['Pause on start', 'sound-start', 'pause'], ['Play on stop', 'sound-stop', 'play']]) {
    await page.click('[data-testid="auto-add"]'); await sleep(500);
    const c = page.locator('[data-testid="auto-list"] li[data-auto]').last();
    await c.locator('input[aria-label="Automation name"]').fill(name);
    await c.locator('select[aria-label="Trigger"]').selectOption(trig);
    await c.locator('select[aria-label="Step 1 action"]').selectOption(step); await sleep(300);
  }
  await close(); await sleep(1500);
  const before = (await log()).length;
  await page.click('header button[aria-label="Play sound"]'); await sleep(5000);
  const after = await log();
  assert.ok(after.some((e) => /right after another automation/.test(e.note)), 'the echo was skipped and written down');
  assert.ok(after.length - before <= 6, `no endless ping-pong (${after.length - before} log lines)`);
  await sleep(2500); assert.equal(await playing(), false, 'the sound ended up paused and stayed that way');
  pass('a rule cannot trigger itself or another rule in a loop');

  // ---- a template, and the time of day
  await openTab();
  for (const li of await page.locator('[data-testid="auto-list"] li[data-auto] input[role="switch"]').all()) await li.uncheck();
  await page.selectOption('select[aria-label="Start from a template"]', 'evening-wind-down'); await sleep(600);
  let stored = await autos(); const tpl = stored.find((a) => a.name === 'Evening wind-down'); assert.ok(tpl, 'the template was added'); assert.equal(tpl.trigger.type, 'at-time'); assert.equal(tpl.trigger.time, '22:30'); assert.equal(tpl.steps.length, 2);
  const nowHm = await page.evaluate(() => { const d = new Date(Date.now() + 60_000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; });
  const row = page.locator(`li[data-auto="${tpl.id}"]`); await row.locator('[aria-label="Edit"]').click(); await sleep(400);
  await row.locator('input[aria-label="Time of day"]').fill(nowHm); await sleep(400);
  await close(); await dismiss();
  await page.waitForFunction((id) => JSON.parse(localStorage.getItem('study-with-sarang:automation-log') ?? '[]').some((e) => e.id === id && e.note === 'ran'), tpl.id, { timeout: 100000 });
  await page.getByText('Time to wind down').first().waitFor({ timeout: 6000 });
  pass('a template adds a ready rule, and a time-of-day rule fires at its time');

  // ---- survives a reload; the bell kept the message
  await page.reload(); await page.waitForSelector('header'); await sleep(1200);
  assert.equal((await autos()).length, 4);
  await page.click('header button[aria-label^="Notifications"]'); await sleep(600);
  assert.ok(await page.getByText('Sound is on, good luck').count() >= 1, 'the message was also written to the notification list');
  await page.keyboard.press('Escape');
  pass('rules and their messages are kept');

  assert.deepEqual(problems, [], `console problems: ${problems.join(' | ')}`);
  await app.close();
  console.log('Automation UI tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
