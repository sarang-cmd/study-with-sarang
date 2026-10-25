'use strict';
/**
 * Takes the README and landing-page screenshots of the real app with sample data.
 * Run: xvfb-run -a -s "-screen 0 1700x1100x24" node scripts/make-screenshots.cjs <outDir>   (needs `npm run build` first)
 * The sample sessions are made up; nothing here touches your own data (it uses a scratch profile).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'screenshots'));
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GOALS = ['Finish optics worksheet', 'Past paper section A', 'Review sequences and series', 'Read chapter 6', 'Flashcards: logarithms', 'Essay plan', 'Binomial theorem practice', 'Revise functions'];

function seed() {
  const sessions = []; let id = 0; const now = Date.now();
  for (let d = 0; d < 70; d += 1) {
    if ((d * 7 + 3) % 11 === 0 || (d % 9 === 5)) continue;
    const blocks = 1 + ((d * 5) % 4);
    for (let b = 0; b < blocks; b += 1) {
      const start = new Date(now - d * 86400000 - (b * 3 + 2) * 3600000);
      start.setHours(9 + b * 2, 10 + (d % 40), 0, 0);
      sessions.push({ id: `s${id++}`, startedAt: start.toISOString(), seconds: [1500, 1500, 2700, 1500, 3000][(d + b) % 5], mode: 'pomodoro', task: GOALS[(d + b) % GOALS.length],
        completed: true, distractions: (d + b) % 3, tabAways: 0, mixName: 'Flow', subject: ['ib:mathematics-aa-hl', 'ib:physics-hl', 'ib:english-a-sl'][(d + b) % 3], goal: GOALS[(d + b) % GOALS.length],
        goalMet: ['yes', 'yes', 'partly', 'yes', 'no'][(d + b) % 5], todosDone: (d + b) % 3, focus: 3 + ((d + b) % 3) });
    }
  }
  return sessions;
}

(async () => {
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-shots-'));
  const env = { ...process.env, XDG_CONFIG_HOME: config, SWA_NO_TOUR: '1' }; delete env.SWA_CLASSIC;
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1440, 900); w.center(); });
  const shot = async (name) => { await sleep(700); await page.screenshot({ path: path.join(out, `${name}.png`) }); console.log('shot', name); };
  const boot = async () => { await page.waitForFunction(() => window.desktop && document.querySelector('header')); await sleep(1500); for (let i = 0; i < 3; i += 1) { await page.keyboard.press('Escape'); await sleep(700); } };
  await boot();
  await page.evaluate((s) => {
    localStorage.setItem('study-with-sarang:sessions', JSON.stringify(s));
    localStorage.setItem('study-with-sarang:theme', 'light');
    localStorage.setItem('study-with-sarang:plan', JSON.stringify({ goal: 'Finish optics worksheet', minutes: 45 }));
  }, seed());
  await page.reload(); await boot();
  await shot('studio-light');
  await page.evaluate(() => localStorage.setItem('study-with-sarang:theme', 'dark')); await page.reload(); await boot();
  await shot('studio-dark');
  await page.evaluate(() => localStorage.setItem('study-with-sarang:theme', 'light')); await page.reload(); await boot();

  await page.click('#timer button:has-text("Start")'); await page.waitForSelector('[data-testid="session-start"]', { timeout: 8000 }); await sleep(600);
  await page.fill('[data-testid="start-goal"]', 'Past paper 1, questions 1 to 6'); await page.fill('[data-testid="start-minutes"]', '45');
  await shot('session-start');
  await page.click('[data-testid="start-go"]'); await page.waitForSelector('[data-testid="session-start"]', { state: 'detached' }); await sleep(800);
  await page.click('#timer button:has-text("Pause")'); await sleep(400);
  const now = Date.now();
  await page.evaluate((t) => localStorage.setItem('study-with-sarang:timer-runtime', JSON.stringify({ mode: 'pomodoro', phase: 'focus', running: true, endAt: t + 3000, remainingMs: 3000, activeBefore: 600000, runStart: t, segmentStartedAt: new Date(t - 600000).toISOString(), cycle: 0, task: '', distractions: 0, tabAways: 0 })), now);
  await page.reload(); await page.waitForFunction(() => document.querySelector('header')); await sleep(800);
  await page.waitForSelector('[data-testid="session-wrap"]', { timeout: 20000 }); await sleep(600);
  await page.click('[data-testid="wrap-yes"]'); await page.click('[data-testid="wrap-rate-4"]'); await sleep(300);
  await shot('session-wrap');
  await page.click('[data-testid="wrap-break"]'); await page.waitForSelector('[data-testid="break-coach"]', { timeout: 8000 });
  await shot('break-coach');
  for (let i = 0; i < 3; i += 1) { await page.keyboard.press('Escape'); await sleep(700); }

  const nav = async (label) => { await page.click(`header nav[aria-label="Sections"] >> text="${label}"`); await sleep(1200); };
  await nav('Library'); await shot('library');
  await nav('Progress'); await sleep(1200); await shot('progress');
  await page.click('header button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]'); await sleep(900);
  await shot('settings');
  await page.click('[data-testid="settings-panel"] nav button:has-text("Flow voice")'); await sleep(900); await shot('settings-voice');
  await page.click('[data-testid="settings-panel"] nav button:has-text("Advanced")'); await sleep(900); await shot('settings-advanced');
  await page.getByRole('switch', { name: /^Show everything/ }).check(); await sleep(900);
  await page.keyboard.press('Escape'); await sleep(900);
  await page.reload(); await boot();
  await nav('Studio'); await shot('studio-everything');
  await nav('Progress'); await sleep(1500); await shot('progress-full');
  await nav('Library'); await sleep(1200); await shot('library-full');
  await nav('Studio'); await sleep(1000);
  await page.keyboard.press('z'); await sleep(2500); await shot('zen');
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
