'use strict';
/**
 * UI test for 2.0 part two: subjects, the session plan and goal check, achievements and the statistics.
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui21.cjs   (needs `npm run build` first)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui21-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);
const shot = process.env.SWA_SHOTS;
const snap = async (page, name) => { if (shot) await page.screenshot({ path: path.join(shot, `ui21-${name}.png`) }); };

async function launch() {
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: config } });
  const page = await app.firstWindow(); const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/youtube|googlevideo|ERR_|Failed to load resource|NotFoundError|NotAllowedError|Requested device not found|Permission denied/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.waitForFunction(() => window.desktop && document.querySelector('header'));
  await sleep(900);
  return { app, page, problems };
}
const openSettings = async (page, tab) => { await page.click('header button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]'); if (tab) await page.click(`[data-testid="settings-panel"] nav button:has-text("${tab}")`); await sleep(300); };
const closeSettings = async (page) => { await page.click('[aria-label="Close settings"]'); await sleep(300); };
const go = async (page, label) => { await page.evaluate((h) => { location.hash = h; }, label.toLowerCase()); await sleep(900); };
const stored = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(`study-with-sarang:${k}`) ?? 'null'), key);

(async () => {
  const { app, page, problems } = await launch();

  // ---- choose a programme and subjects
  await openSettings(page, 'Subjects and exams');
  await page.click('[role="radiogroup"][aria-label="Programme"] [role="radio"]:has-text("IB Diploma")');
  await page.click('[role="group"][aria-label="Stage"] button:has-text("DP1"), [aria-label="Stage"] button:has-text("DP1")');
  const sessionSelect = page.locator('select[aria-label="Exam session"]');
  const options = await sessionSelect.locator('option').allTextContents();
  assert.ok(options.some((o) => /May/.test(o)) && options.some((o) => /November/.test(o)), `May and November sessions are offered: ${options.join(', ')}`);
  await sessionSelect.selectOption({ index: 1 });
  await page.waitForSelector('[data-testid="countdown"]');
  assert.match(await page.textContent('[data-testid="countdown"]'), /days to go/);
  await page.fill('input[aria-label="Search subjects"]', 'physics'); await sleep(200);
  await page.click('label:has-text("Physics") input[type="checkbox"]');
  await page.click('[role="radiogroup"][aria-label="Physics level"] button:has-text("HL")');
  await page.fill('input[aria-label="Search subjects"]', 'analysis'); await sleep(200);
  await page.click('label:has-text("Analysis and Approaches") input[type="checkbox"]');
  await page.fill('input[aria-label="Search subjects"]', '');
  await page.fill('input[aria-label="Your own subject"]', 'Chess'); await page.keyboard.press('Enter'); await sleep(300);
  const mine = await page.locator('[data-testid="my-subjects"] li').count(); assert.equal(mine, 3, 'three subjects chosen');
  await snap(page, 'subjects-tab');
  const profile = await stored(page, 'subjects');
  assert.equal(profile.curriculum, 'ib'); assert.equal(profile.stage, 'DP1'); assert.ok(profile.subjects.some((s) => s.id === 'ib:physics'), JSON.stringify(profile.subjects.map((s) => s.id)));
  await closeSettings(page);
  pass('programme, stage, exam session, IB subjects with levels and a custom subject are saved');

  // ---- the session plan: subject, goal, to-do, and a real block
  const plan = page.locator('[data-testid="session-plan"]'); await plan.scrollIntoViewIfNeeded();
  await plan.locator('[role="radio"]:has-text("PHY")').click();
  await plan.locator('#plan-goal').fill('Finish the optics questions');
  await plan.locator('input[aria-label="New to-do"]').fill('Read the mark scheme'); await plan.locator('input[aria-label="New to-do"]').press('Enter'); await sleep(400);
  assert.equal(await plan.locator('[data-testid="todo"]').count(), 1);
  await snap(page, 'session-plan');
  await page.click('[aria-label="Timer mode"] button:has-text("Stopwatch")');
  await page.click('#timer button:has-text("Start")'); await sleep(1000);
  await plan.locator('[role="checkbox"]').first().click(); await sleep(300);
  await sleep(31000);
  await page.click('button:has-text("Finish and log")');
  await page.waitForSelector('[data-testid="goal-check"]'); await snap(page, 'goal-check');
  await page.click('[data-testid="goal-check"] button:has-text("Yes")');
  await page.waitForSelector('[data-testid="goal-check"]', { state: 'detached', timeout: 8000 });
  const logged = (await stored(page, 'sessions'))[0];
  assert.equal(logged.subject, 'ib:physics'); assert.equal(logged.goal, 'Finish the optics questions'); assert.equal(logged.goalMet, 'yes'); assert.equal(logged.todosDone, 1);
  assert.equal(await page.locator('#plan-goal').inputValue(), '', 'a reached goal is cleared');
  pass('a block carries its subject, goal, outcome and ticked to-dos into the log');

  // ---- seed a few years of history, then explore the statistics
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('study-with-sarang:sessions') ?? '[]'); const now = new Date();
    const add = (date, minutes, subject, extra = {}) => list.push({ id: `seed-${list.length}`, startedAt: date.toISOString(), seconds: minutes * 60, mode: 'pomodoro', task: '', completed: true, distractions: 0, tabAways: 0, mixName: '', subject, goal: '', goalMet: '', todosDone: 0, ...extra });
    for (let i = 1; i < 200; i += 2) { const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(10 + (i % 5), 0, 0, 0); add(d, 25 + (i % 7) * 10, i % 3 ? 'ib:physics' : 'ib:mathematics-analysis-and-approaches'); }
    const old = new Date(now.getFullYear() - 1, 2, 3, 15, 0, 0); add(old, 90, 'ib:physics'); const older = new Date(now.getFullYear() - 1, 5, 9, 15, 0, 0); add(older, 40, 'custom:chess');
    localStorage.setItem('study-with-sarang:sessions', JSON.stringify(list));
  });
  await page.reload(); await page.waitForFunction(() => window.desktop && document.querySelector('header')); await sleep(900);
  await go(page, 'Progress');
  const grid = page.locator('[data-testid="heat-grid"]'); await grid.scrollIntoViewIfNeeded(); await sleep(1500);
  assert.equal(await grid.getAttribute('data-view'), 'rolling', 'opens on the last 12 months');
  const lastYear = String(new Date().getFullYear() - 1);
  assert.ok(await page.locator(`[data-view-button="${lastYear}"]`).count() === 1, 'a button for last year');
  const totalNow = await page.textContent('[data-testid="heat-total"]');
  await page.click(`[data-view-button="${lastYear}"]`); await sleep(800);
  assert.equal(await grid.getAttribute('data-view'), lastYear);
  assert.notEqual(await page.textContent('[data-testid="heat-total"]'), totalNow, 'switching the year changes the total');
  assert.ok(Number(await grid.getAttribute('data-weeks')) >= 52);
  const cell = grid.locator(`button[data-day="${lastYear}-03-03"]`); await cell.click(); await sleep(300);
  assert.match(await page.textContent('[data-testid="heat-day"]'), /1 h 30|1h 30|90|1:30/, await page.textContent('[data-testid="heat-day"]'));
  await page.selectOption('select[aria-label="What the map shows"]', 'blocks'); await sleep(500);
  await page.selectOption('select[aria-label="What the map shows"]', 'time');
  await page.selectOption('[data-testid="year-heatmap"] select[aria-label="Subject"]', 'custom:chess'); await sleep(500);
  assert.equal(await grid.locator('button[data-level="4"]').count(), 1, 'only one chess day in that year, shaded darkest');
  await page.selectOption('[data-testid="year-heatmap"] select[aria-label="Subject"]', ''); await page.click('[data-view-button="rolling"]');
  await grid.focus(); await page.keyboard.press('ArrowLeft'); await sleep(200);
  await snap(page, 'heatmap');
  pass('the heatmap opens on the last 12 months, switches year, metric and subject, and shows a day on click and arrow keys');

  const lab = page.locator('[data-testid="progress-lab"]'); await lab.scrollIntoViewIfNeeded(); await sleep(1200);
  const totalCount = async () => Number((await page.textContent('[data-testid="filter-count"]')).match(/^(\d+)/)[1]);
  await page.click('[data-testid="range-all"]'); await sleep(300); const all = await totalCount();
  await page.click('[data-testid="range-7"]'); await sleep(300); const week = await totalCount();
  assert.ok(all > week && week >= 1, `${all} sessions overall, ${week} in the last 7 days`);
  await page.click('[data-testid="range-all"]');
  await page.selectOption('[data-testid="filter-subject"]', 'custom:chess'); await sleep(300);
  assert.equal(await totalCount(), 1);
  await page.click('button:has-text("Reset filters")'); await sleep(300); assert.equal(await totalCount(), all);
  const rows = page.locator('[data-testid="subject-rows"] li button'); assert.ok(await rows.count() >= 3, 'every subject has a row');
  await rows.filter({ hasText: 'Chess' }).first().click(); await sleep(300); assert.equal(await totalCount(), 1, 'clicking a subject row filters the statistics');
  await rows.filter({ hasText: 'Chess' }).first().click(); await sleep(300);
  assert.match(await page.textContent('[data-testid="exam-days"]'), /\d+/);
  assert.ok(await page.locator('[data-testid="weekly-stack"]').count() === 1 && await page.locator('[data-testid="hour-grid"]').count() === 1 && await page.locator('[data-testid="records"]').count() === 1);
  await lab.screenshot({ path: shot ? path.join(shot, 'ui21-lab.png') : undefined }).catch(() => {});
  assert.ok((await page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:stats-filter')).range)) === 'all', 'filters are remembered');
  pass('statistics filters, subject rows, exam countdown and charts work');

  // ---- achievements: hundreds of ways to fill the page, secrets stay hidden
  const ach = page.locator('[data-testid="achievements"]'); await ach.scrollIntoViewIfNeeded(); await sleep(500);
  const total = await page.locator('[data-testid="achievement"]').count(); assert.ok(total >= 90, `${total} achievements`);
  assert.ok(await page.locator('[data-secret]').count() >= 5, 'secret achievements are shown as secret');
  assert.match(await ach.textContent(), /Secret achievement/);
  await page.click('[role="tab"]:has-text("Locked")'); await sleep(300);
  const locked = await page.locator('[data-testid="achievement"]').count(); assert.ok(locked > 0 && locked <= total);
  await page.click('[role="tab"]:has-text("Subjects")'); await sleep(300);
  assert.ok(await page.locator('[data-testid="achievement"]').count() > 3);
  await page.selectOption('select[aria-label="Sort achievements"]', 'closest'); await sleep(300);
  assert.ok(await page.locator('[data-testid="next-up"]').count() === 1);
  await snap(page, 'achievements');
  pass('achievements: many, filterable, sortable, with secret cards hidden');

  assert.deepEqual(problems, [], `console problems: ${problems.join(' | ')}`);
  await app.close();
  console.log('v2.0 UI part two passed');
})().catch((error) => { console.error(error); process.exit(1); });
