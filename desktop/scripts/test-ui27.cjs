'use strict';
/**
 * UI test for the calendar: the file download (no account), and the private link against a small stand-in for the
 * Supabase tables and the calendar function (create, update after a new block, replace the link, delete).
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui27.cjs   (needs `npm run build` first)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui27-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);
const shot = process.env.SWA_SHOTS;

// A stand-in for the project: the calendar table (as the app sees it) and the public function.
const rows = new Map(); const hits = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let body = ''; req.on('data', (c) => { body += c; });
  req.on('end', () => {
    hits.push(`${req.method} ${url.pathname}`);
    const send = (code, data, type = 'application/json') => { res.writeHead(code, { ...cors, 'content-type': type }); res.end(typeof data === 'string' ? data : JSON.stringify(data)); };
    if (url.pathname === '/rest/v1/calendar_feeds') {
      const user = /^eq\.(.+)$/.exec(url.searchParams.get('user_id') ?? '')?.[1];
      if (req.method === 'GET') return send(200, rows.has(user) ? [{ token: rows.get(user).token }] : []);
      const b = body ? JSON.parse(body) : {};
      if (req.method === 'POST') { rows.set(b.user_id, b); return send(201, ''); }
      if (req.method === 'PATCH') { rows.set(user, { ...rows.get(user), ...b }); return send(204, ''); }
      if (req.method === 'DELETE') { rows.delete(user); return send(204, ''); }
    }
    if (url.pathname === '/functions/v1/calendar-feed') {
      const row = [...rows.values()].find((r) => r.token === url.searchParams.get('t'));
      return row ? send(200, row.ics, 'text/calendar') : send(404, 'Not found.', 'text/plain');
    }
    if (url.pathname === '/rest/v1/study_sync') return req.method === 'GET' ? send(200, []) : send(201, [{}]);
    return send(404, {});
  });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: config } });
  const page = await app.firstWindow(); const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|NotAllowedError|Requested device not found|Permission denied|404/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  const panel = '[data-testid="settings-panel"]';
  const boot = async () => { await page.waitForFunction(() => window.desktop && document.querySelector('header')); await sleep(1000); for (let i = 0; i < 3; i += 1) { await page.keyboard.press('Escape'); await sleep(900); } };
  const openTab = async () => { await page.click('header button[aria-label="Settings"]'); await page.waitForSelector(panel); await page.click(`${panel} nav button:has-text("Calendar")`); await sleep(500); };
  const close = async () => { await page.click('[aria-label="Close settings"]'); await sleep(500); };
  const sw = (label) => page.locator(`label:has-text("${label}") input[role="switch"]`).first();
  const session = (id, hoursAgo, extra = {}) => ({ id, startedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(), seconds: 2400, mode: 'pomodoro', task: 'Waves revision', completed: true, distractions: 1, tabAways: 0, mixName: 'Rain', subject: '', goal: 'Finish part B', goalMet: 'yes', todosDone: 0, ...extra });
  const seed = (list) => page.evaluate((x) => localStorage.setItem('study-with-sarang:sessions', JSON.stringify(x)), list);
  await boot();

  // ---- the file, no account
  await seed([session('a1', 3)]); await page.reload(); await boot();
  await page.evaluate(() => { window.__dl = null; let last = null; const create = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { last = b; return create(b); }; const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { const name = this.download; const blob = last; void blob.text().then((text) => { window.__dl = { name, text }; }); return; } return orig.call(this); }; });
  await openTab();
  assert.match(await page.locator('[data-testid="cal-signin"]').textContent(), /sign in under Cloud sync/);
  assert.match(await page.locator('[data-testid="cal-count"]').textContent(), /1 event/);
  await page.selectOption('[data-testid="cal-title"]', 'generic');
  await page.click('[data-testid="cal-download"]');
  await page.waitForFunction(() => window.__dl, null, { timeout: 5000 });
  let dl = await page.evaluate(() => window.__dl);
  assert.equal(dl.name, 'study-with-sarang.ics'); assert.ok(dl.text.startsWith('BEGIN:VCALENDAR')); assert.ok(dl.text.includes('SUMMARY:Study block')); assert.ok(!dl.text.includes('Finish part B') && !dl.text.includes('Waves revision'), 'private details are off by default');
  await sw('Add my goal').check(); await sleep(300); await page.evaluate(() => { window.__dl = null; }); await page.click('[data-testid="cal-download"]');
  await page.waitForFunction(() => window.__dl, null, { timeout: 5000 }); dl = await page.evaluate(() => window.__dl);
  assert.ok(dl.text.replace(/\r\n /g, '').includes('Goal: Finish part B (reached)'));
  await page.fill('[data-testid="cal-min"]', '60'); await sleep(400);
  assert.match(await page.locator('[data-testid="cal-count"]').textContent(), /No blocks fit/);
  await page.fill('[data-testid="cal-min"]', '5'); await sleep(300);
  pass('the calendar file downloads without an account, hides private details until you allow them, and respects the minimum length');

  // ---- sign in (against the stand-in) and create the private link
  await close();
  await page.evaluate((b) => localStorage.setItem('study-with-sarang:cloud', JSON.stringify({ url: b, anonKey: 'sb_publishable_testtesttesttesttest', auto: true, lastSync: 0, session: { accessToken: 'tok', refreshToken: 'ref', expiresAt: Date.now() + 3_600_000, user: { id: 'user-1', email: 'me@example.com' } } })), base);
  await page.reload(); await boot(); await openTab();
  assert.equal(await page.locator('[data-testid="cal-signin"]').count(), 0);
  await sw('Keep my private calendar link up to date').check();
  await page.waitForSelector('[data-testid="cal-url"]', { timeout: 15000 });
  const url1 = await page.inputValue('[data-testid="cal-url"]');
  assert.match(url1, new RegExp(`^${base}/functions/v1/calendar-feed\\?t=[a-f0-9]{48}$`));
  const token1 = new URL(url1).searchParams.get('t');
  assert.equal(rows.get('user-1').token, token1); assert.ok(rows.get('user-1').ics.includes('BEGIN:VCALENDAR'));
  assert.equal((await fetch(url1)).status, 200); assert.equal((await fetch(url1)).headers.get('content-type'), 'text/calendar');
  assert.equal((await fetch(`${base}/functions/v1/calendar-feed?t=${'0'.repeat(48)}`)).status, 404);
  assert.match(await page.getAttribute('[data-testid="cal-google"]', 'href'), /^https:\/\/calendar\.google\.com\/calendar\/u\/0\/r\?cid=webcal%3A%2F%2F127\.0\.0\.1/);
  assert.match(await page.locator('[data-testid="cal-updated"]').textContent(), /Google Calendar often only every 12 to 24 hours/);
  if (shot) await page.screenshot({ path: path.join(shot, 'ui27-link.png') });
  pass('a private link is created, serves the calendar, and is honest about how slowly Google refreshes');

  // ---- a new block updates the stored calendar, the link stays the same
  const before = (rows.get('user-1').ics.match(/BEGIN:VEVENT/g) ?? []).length;
  await close(); await seed([session('a1', 3), session('a2', 1)]); await page.reload(); await boot();
  const t0 = Date.now(); while (Date.now() - t0 < 15000 && (rows.get('user-1').ics.match(/BEGIN:VEVENT/g) ?? []).length === before) await sleep(500);
  assert.equal((rows.get('user-1').ics.match(/BEGIN:VEVENT/g) ?? []).length, before + 1, 'the new block was saved');
  assert.equal(rows.get('user-1').token, token1, 'the link did not change');
  pass('a new block is saved to the stored calendar a few seconds later, and the link stays the same');

  // ---- a new link replaces the old one; stopping deletes it
  await openTab();
  await page.click('[data-testid="cal-rotate"]');
  await page.waitForFunction((old) => !document.querySelector('[data-testid="cal-url"]')?.value.includes(old), token1, { timeout: 10000 });
  const url2 = await page.inputValue('[data-testid="cal-url"]');
  assert.notEqual(url2, url1); assert.equal((await fetch(url1)).status, 404, 'the old link is dead'); assert.equal((await fetch(url2)).status, 200);
  await page.click('[data-testid="cal-stop"]'); await sleep(1200);
  assert.equal(rows.size, 0, 'the stored calendar is deleted'); assert.equal((await fetch(url2)).status, 404);
  assert.equal(await page.locator('[data-testid="cal-url"]').count(), 0); assert.equal(await sw('Keep my private calendar link up to date').isChecked(), false);
  pass('a new link kills the old one, and stop deletes the stored calendar');

  assert.deepEqual(problems, [], `console problems: ${problems.join(' | ')}`);
  await app.close(); server.close();
  console.log('Calendar UI tests passed');
})().catch((error) => { console.error(error); server.close(); process.exit(1); });
