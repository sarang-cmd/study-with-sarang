'use strict';
/**
 * UI test for the study room: add your own videos (a real file, kept on the device), play one behind Zen, replace the sound, come back.
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui22.cjs   (needs `npm run build` first)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui22-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);
const shot = process.env.SWA_SHOTS;
const snap = async (page, name) => { if (shot) await page.screenshot({ path: path.join(shot, `ui22-${name}.png`) }); };
const soundOn = (page) => page.evaluate(() => Boolean(document.querySelector('header button[aria-label="Pause sound"]')));

(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: config } });
  const page = await app.firstWindow(); const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/youtube|googlevideo|ERR_|Failed to load resource|NotFoundError|NotAllowedError|Requested device not found|Permission denied/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.waitForFunction(() => window.desktop && document.querySelector('header')); await sleep(900);

  // a real, tiny video made in the page
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180; const ctx = c.getContext('2d'); const rec = new MediaRecorder(c.captureStream(15), { mimeType: 'video/webm' });
    const chunks = []; rec.ondataavailable = (e) => chunks.push(e.data); let i = 0;
    const iv = setInterval(() => { ctx.fillStyle = `hsl(${i * 12},25%,${22 + (i % 25)}%)`; ctx.fillRect(0, 0, 320, 180); ctx.fillStyle = '#fff'; ctx.font = '38px sans-serif'; ctx.fillText(`study ${i++}`, 60, 100); }, 60);
    rec.start(); await new Promise((r) => setTimeout(r, 2200)); const stopped = new Promise((r) => { rec.onstop = r; }); rec.stop(); await stopped; clearInterval(iv);
    const buf = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()); let s = ''; for (const x of buf) s += String.fromCharCode(x); return btoa(s);
  });
  const file = path.join(os.tmpdir(), 'rainy-desk.webm'); fs.writeFileSync(file, Buffer.from(b64, 'base64')); assert.ok(fs.statSync(file).size > 2000, 'the sample video exists');

  // ---- Library: add a file and two links
  await page.evaluate(() => { location.hash = 'library'; }); await sleep(900);
  const card = page.locator('[data-testid="study-room-card"]'); await card.scrollIntoViewIfNeeded();
  assert.equal(await page.locator('[data-testid="room-open-zen"]').isDisabled(), true, 'nothing to open yet');
  await page.setInputFiles('[data-testid="room-file-input"]', file);
  await page.waitForSelector('[data-testid="room-scenes"] li'); await sleep(500);
  assert.equal(await page.locator('[data-testid="room-scenes"] li').count(), 1);
  await card.locator('input[aria-label="Video link"]').fill('https://example.com/clip.mp4'); await card.locator('input[aria-label="Scene name (optional)"]').fill('Library at night'); await card.locator('button:has-text("Add link")').click();
  await card.locator('input[aria-label="Video link"]').fill('http://example.com/insecure.mp4'); await card.locator('button:has-text("Add link")').click(); await sleep(300);
  assert.match(await card.textContent(), /HTTPS YouTube link/, 'an insecure link is refused with a reason');
  await card.locator('input[aria-label="Video link"]').fill('https://www.youtube.com/watch?v=74cOUSKXMz0'); await card.locator('input[aria-label="Scene name (optional)"]').fill('Long session'); await card.locator('button:has-text("Add link")').click(); await sleep(300);
  assert.equal(await page.locator('[data-testid="room-scenes"] li').count(), 3);
  await snap(page, 'library');
  await page.reload(); await page.waitForSelector('header'); await sleep(900); await page.evaluate(() => { location.hash = 'library'; }); await sleep(700);
  assert.equal(await page.locator('[data-testid="room-scenes"] li').count(), 3, 'scenes survive a restart');
  const first = page.locator('[data-testid="room-scenes"] li').first(); assert.match(await first.textContent(), /KB|MB/, 'the file scene shows its size');
  pass('a video file and two links are added, an insecure link is refused, and the list survives a reload');

  // ---- Zen with the sound replaced by the video
  await page.click('header button[aria-label="Play sound"]'); await page.waitForFunction(() => Boolean(document.querySelector('header button[aria-label="Pause sound"]'))); 
  await page.locator('[data-testid="room-scenes"] li').first().locator('[role="radio"]').click();
  await page.click('[data-testid="room-open-zen"]');
  await page.waitForSelector('[data-testid="room-stage"]'); assert.equal(await page.locator('[data-room="on"]').count(), 1);
  await page.waitForFunction(() => document.querySelector('[data-testid="room-stage"]')?.getAttribute('data-playing') === 'true', null, { timeout: 15000 });
  assert.match(await page.textContent('[data-testid="zen-title"]'), /Study room · rainy-desk/);
  assert.equal(await page.locator('[data-testid="room-stage"] video').count(), 1);
  const ready = await page.evaluate(() => { const v = document.querySelector('[data-testid="room-stage"] video'); return { w: v.videoWidth, paused: v.paused }; });
  assert.equal(ready.paused, false); assert.ok(ready.w > 0, 'real frames decoded');
  assert.equal(await soundOn(page), false, 'the soundscape pauses while the video plays');
  await sleep(1500); await snap(page, 'zen-room');
  await page.click('[data-testid="zen-room-play"]'); await page.waitForFunction(() => document.querySelector('[data-testid="room-stage"]')?.getAttribute('data-playing') === 'false', null, { timeout: 8000 });
  await page.waitForFunction(() => Boolean(document.querySelector('header button[aria-label="Pause sound"]')), null, { timeout: 8000 }).catch(() => {});
  assert.equal(await page.evaluate(() => document.querySelector('[data-testid="room-stage"] video').paused), true, 'pausing the video pauses the picture');
  await page.click('[data-testid="zen-room-play"]'); await page.waitForFunction(() => document.querySelector('[data-testid="room-stage"]')?.getAttribute('data-playing') === 'true', null, { timeout: 8000 });
  pass('Zen plays the stored file behind the clock, pauses the sound, and the play button works');

  // ---- next scene, the drawer, then switching the room off and leaving
  await page.click('[aria-label="Next scene"]'); await sleep(900);
  assert.match(await page.textContent('[data-testid="zen-title"]'), /Library at night/);
  await page.click('button[aria-label="Zen settings"]'); await page.waitForSelector('[data-testid="zen-drawer"]');
  assert.ok(await page.locator('[data-testid="zen-drawer"] [aria-label="Study room"]').count() === 1, 'the drawer has the study room options');
  await page.locator('[data-testid="zen-drawer"] [role="radio"]:has-text("Together")').click(); await sleep(300);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:study-room')).settings.sound), 'mix');
  await page.click('[aria-label="Close settings"]'); await sleep(400);
  await page.click('[data-testid="zen-room-toggle"]'); await sleep(600);
  assert.equal(await page.locator('[data-room="off"]').count(), 1); assert.equal(await page.locator('[data-testid="room-stage"]').count(), 0);
  await page.click('[data-testid="zen-room-toggle"]'); await page.waitForSelector('[data-testid="room-stage"]');
  await page.getByRole('dialog', { name: 'Zen view' }).getByRole('button', { name: 'Close' }).first().click(); await sleep(700);
  assert.equal(await page.locator('[data-testid="room-stage"]').count(), 0, 'leaving Zen stops the video');
  pass('next scene, the Zen drawer options, switching the room off and on, and leaving all work');

  // ---- settings tab and removing a scene deletes the stored file
  await page.click('header button[aria-label="Settings"]'); await page.waitForSelector('[data-testid="settings-panel"]');
  await page.click('[data-testid="settings-panel"] nav button:has-text("Study room")'); await sleep(300);
  assert.ok(await page.locator('[data-testid="settings-panel"] [role="radiogroup"][aria-label="Follow the timer"]').count() === 1);
  await page.click('[data-testid="settings-panel"] [role="radiogroup"][aria-label="Follow the timer"] [role="radio"]:has-text("Focus only")'); await sleep(300);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:study-room')).settings.follow), 'focus');
  await page.click('[aria-label="Close settings"]'); await sleep(300);
  await page.evaluate(() => { location.hash = 'library'; }); await sleep(700);
  await page.locator('[data-testid="room-scenes"] li').first().locator('button[aria-label^="Remove"]').click(); await sleep(500);
  const left = await page.evaluate(() => new Promise((resolve) => { const r = indexedDB.open('study-with-sarang-room', 1); r.onsuccess = () => { const q = r.result.transaction('files').objectStore('files').count(); q.onsuccess = () => resolve(q.result); }; }));
  assert.equal(left, 0, 'the stored video file is deleted with its scene');
  assert.equal(await page.locator('[data-testid="room-scenes"] li').count(), 2);
  pass('all options are in Settings, and removing a scene frees its file');

  assert.deepEqual(problems, [], `console problems: ${problems.join(' | ')}`);
  await app.close();
  console.log('Study room UI tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
