'use strict';
/**
 * UI test for the 1.4 features: settings panel, layouts, bento Tracking, custom scrollbar and window buttons,
 * app icon, Zen parity, command palette, media and Pause keys, hash routing.
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui14.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui14-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const pass = (m) => { results.push(m); console.log(`PASS ${m}`); };
const settingsFile = () => JSON.parse(fs.readFileSync(path.join(config, 'Study with Sarang', 'settings.json'), 'utf8'));
const prefsOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('study-with-sarang:prefs') || '{}'));

async function launch() {
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: config, SWA_PREVIEW_TITLEBAR: 'custom' } });
  const page = await app.firstWindow(); const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/youtube|googlevideo|ERR_|Failed to load resource/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.waitForFunction(() => window.desktop && document.querySelector('header'));
  await sleep(900);
  return { app, page, problems };
}
const playing = (page) => page.evaluate(() => Boolean(document.querySelector('header button[aria-label="Pause sound"]')));
const waitPlaying = (page, v) => page.waitForFunction((x) => Boolean(document.querySelector('header button[aria-label="Pause sound"]')) === x, v, { timeout: 6000 });
const panel = (page) => page.locator('[data-testid="settings-panel"]');
const tab = async (page, name) => { await page.click(`nav[aria-label="Settings sections"] >> text=${name}`); await sleep(250); };
const hold = (page) => page.evaluate(() => document.activeElement && document.activeElement.blur());

(async () => {
  // These checks cover the older mode where the app grabs the media keys itself. The default (follow the most recent player) is covered in test-ui15.
  fs.mkdirSync(path.join(config, 'Study with Sarang'), { recursive: true });
  fs.writeFileSync(path.join(config, 'Study with Sarang', 'settings.json'), JSON.stringify({ mediaKeysFollow: false }));
  let { app, page, problems } = await launch();

  // ---- seed 120 days of sessions so Tracking has something to show
  await page.evaluate(() => {
    const out = []; const now = Date.now();
    for (let d = 0; d < 120; d++) { const n = (d * 7) % 4; for (let k = 0; k < n; k++) { const t = new Date(now - d * 86400000); t.setHours(8 + (k * 5 + d) % 12, 10); out.push({ id: `s${d}-${k}`, startedAt: t.toISOString(), seconds: 1200 + ((d * 131 + k * 97) % 3000), mode: 'pomodoro', task: ['Calculus', 'Physics', 'Essay', ''][(d + k) % 4], completed: (d + k) % 5 !== 0, distractions: (d + k) % 3, tabAways: 0, mixName: ['Flow', 'Rain', 'Cafe'][(d + k) % 3] }); } }
    localStorage.setItem('study-with-sarang:sessions', JSON.stringify(out));
  });
  await page.reload(); await page.waitForSelector('#sound'); await sleep(900);

  // ---- window buttons and scrollbar (the overlap bug)
  assert.ok(await page.locator('[role=group][aria-label="Window controls"]').count() > 0, 'custom window buttons are drawn');
  const bar = page.locator('[data-testid="custom-scrollbar"]');
  await page.evaluate(() => { location.hash = 'progress'; }); await sleep(800);
  assert.equal(await bar.count(), 1, 'the page has its own scrollbar');
  const geo = await page.evaluate(() => { const t = document.querySelector('[data-testid="custom-scrollbar"]').getBoundingClientRect(); const c = document.querySelector('[role=group][aria-label="Window controls"]').getBoundingClientRect(); return { trackTop: t.top, ctlBottom: c.bottom, nativeBar: window.innerWidth - document.documentElement.clientWidth }; });
  assert.ok(geo.trackTop >= geo.ctlBottom - 1, `scrollbar starts below the window buttons (${geo.trackTop} vs ${geo.ctlBottom})`);
  assert.equal(geo.nativeBar, 0, 'the native scrollbar is hidden');
  pass('the page scrollbar starts below the window buttons, never underneath them');
  for (let i = 0; i < 6 && await page.locator('[data-testid="celebration"], [data-testid="celebration-small"]').count(); i++) { await page.keyboard.press('Escape'); await sleep(1200); } // an unlock card may be showing
  const before = await page.evaluate(() => scrollY);
  const thumb = bar.locator('[data-thumb], div').last(); const tb = await thumb.boundingBox();
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await page.mouse.down(); await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2 + 120, { steps: 6 }); await page.mouse.up(); await sleep(300);
  assert.ok(await page.evaluate(() => scrollY) > before, 'dragging the thumb scrolls the page');
  pass('the custom scrollbar can be dragged');
  await page.evaluate(() => scrollTo(0, 0));

  // ---- bento tracking fills its card
  const hm = page.locator('[data-testid="heat-grid"]'); await hm.scrollIntoViewIfNeeded(); await sleep(400);
  const fit = await page.evaluate(() => { const g = document.querySelector('[data-testid="heat-grid"]'); const card = g.closest('div.rounded-xl, section') || g.parentElement; const r = g.getBoundingClientRect(), c = card.getBoundingClientRect(); return { ratio: r.width / c.width, weeks: Number(g.getAttribute('data-weeks')) }; });
  assert.ok(fit.ratio > 0.7, `the year heatmap fills its card (${Math.round(fit.ratio * 100)}%)`);
  assert.ok(fit.weeks >= 52, `the heatmap shows ${fit.weeks} weeks at this width`);
  pass(`the activity heatmap fills its card (${Math.round(fit.ratio * 100)}%, ${fit.weeks} weeks)`);
  const text = await page.locator('main, body').first().innerText();
  for (const word of ['Daily goal', 'By weekday', 'Time of day', 'Top sounds', 'Session quality']) assert.ok(text.includes(word), `${word} card`);
  pass('the bento cards are there');

  // ---- settings panel
  await page.evaluate(() => { location.hash = 'studio'; }); await sleep(500);
  await page.click('button[aria-label="Settings"]'); await panel(page).waitFor();
  await page.keyboard.press('Escape'); await sleep(250); assert.equal(await panel(page).count(), 0); await hold(page);
  await page.keyboard.press('Control+,'); await panel(page).waitFor(); await page.keyboard.press('Control+,'); await sleep(250); assert.equal(await panel(page).count(), 0);
  pass('settings open from the top bar and Ctrl+, and close with Esc');
  await page.click('button[aria-label="Settings"]'); await tab(page, 'Appearance');
  await panel(page).getByRole('radio', { name: /Classic/i }).first().click().catch(() => {});

  // ---- layout toggle (new and classic) and persistence
  await panel(page).getByRole('radio', { name: 'Classic' }).first().click(); await sleep(400);
  assert.equal((await prefsOf(page)).layout, 'legacy'); await page.keyboard.press('Escape'); await hold(page); await sleep(500);
  const ids = await page.evaluate(() => [...document.querySelectorAll('main section[id], section[id]')].map((s) => s.id));
  for (const id of ['sound', 'timer', 'layers', 'mixes', 'tracking', 'shield', 'video', 'science']) assert.ok(ids.includes(id), `classic layout has #${id}`);
  assert.ok(!ids.includes('desktop'), 'no bottom Desktop section any more');
  assert.equal(await page.locator('nav[aria-label="Sections"] a').first().innerText().then((t) => /^\d|Sound/.test(t)), true);
  pass('the classic layout shows the original single page with all eight sections');
  await page.reload(); await page.waitForSelector('#tracking'); await sleep(500);
  assert.equal((await prefsOf(page)).layout, 'legacy'); pass('the layout choice is remembered');
  await page.keyboard.press('Control+k'); await page.locator('[data-testid="palette"]').waitFor();
  await page.keyboard.type('layout'); await sleep(200); await page.keyboard.press('Enter'); await sleep(700);
  assert.equal((await prefsOf(page)).layout, 'new'); assert.ok(await page.locator('nav[aria-label="Sections"] a:has-text("Progress")').count() > 0);
  pass('the command palette switches the layout back');

  // ---- palette
  await page.evaluate(() => { location.hash = 'studio'; }); await sleep(400);
  await page.keyboard.press('Control+k'); await page.locator('[data-testid="palette"]').waitFor();
  await page.keyboard.type('progress'); await page.keyboard.press('Enter'); await sleep(700);
  assert.ok(await page.locator('[data-testid="heat-grid"]').count() > 0, 'palette navigates to Progress'); assert.equal(await page.locator('[data-testid="palette"]').count(), 0);
  await page.keyboard.press('Control+k'); await page.keyboard.type('zzzzqq'); assert.match(await page.locator('[data-testid="palette"]').innerText(), /No matches|nothing/i); await page.keyboard.press('Escape'); await sleep(200);
  pass('the command palette finds actions, shows empty results and closes with Esc');

  // ---- hash routing
  await page.evaluate(() => { location.hash = 'library'; }); await sleep(600);
  assert.ok(await page.locator('#mixes').count() > 0 && await page.locator('#tracking').count() === 0, 'only the Library page is shown');
  await page.evaluate(() => { location.hash = 'focus'; }); await sleep(600); assert.ok(await page.locator('#shield').count() > 0);
  await page.evaluate(() => { location.hash = 'video'; }); await sleep(600); assert.ok(await page.locator('#video').count() > 0, 'old section links still land on the right page');
  pass('page routing by address hash, including old section ids');
  await page.evaluate(() => { location.hash = 'studio'; }); await sleep(500);

  // ---- feedback: toasts and ui sounds switches
  await page.click('button[aria-label="Settings"]'); await tab(page, 'Feedback and Zen');
  const toastsSwitch = panel(page).getByRole('switch').first();
  assert.equal(await toastsSwitch.isChecked(), true);
  await toastsSwitch.click(); await sleep(200); assert.equal((await prefsOf(page)).toasts, false);
  await toastsSwitch.click(); await sleep(200); assert.equal((await prefsOf(page)).toasts, true);
  await page.keyboard.press('Escape'); await hold(page);
  pass('feedback switches are saved');

  // ---- app icon (current vs classic dark dot)
  await page.click('button[aria-label="Settings"]'); await tab(page, 'Appearance');
  await panel(page).getByRole('radio', { name: /^Dot/i }).first().click(); await sleep(700);
  assert.equal(settingsFile().appIcon, 'classic')
  await panel(page).getByRole('radio', { name: /^Waves/i }).first().click(); await sleep(700);
  assert.equal(settingsFile().appIcon, 'waves');
  await panel(page).getByRole('radio', { name: /^Voice/i }).first().click(); await sleep(700);
  assert.equal(settingsFile().appIcon, 'default');
  pass('the app icon switches between the voice bars (the default), the waves and the dot');

  // ---- window buttons: native or custom
  await page.evaluate(() => window.desktop.setBehavior({ nativeControls: true })); await sleep(900);
  assert.equal(settingsFile().nativeControls, true);
  pass('window buttons can be switched to the system ones and back (saved for the next start)');
  await page.evaluate(() => window.desktop.setBehavior({ nativeControls: false })); await sleep(900);
  assert.equal(settingsFile().nativeControls, false);
  await page.keyboard.press('Escape'); await hold(page);

  // ---- custom window buttons work
  const state = () => app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return { max: w.isMaximized(), vis: w.isVisible(), min: w.isMinimized() }; });
  assert.ok(await page.locator('button[aria-label="Minimize"]').count() > 0 && await page.locator('button[aria-label="Maximize"]').count() > 0);
  await page.click('button[aria-label="Close"]'); await sleep(700); assert.equal((await state()).vis, false, 'Close hides to the tray');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show()); await sleep(500);
  pass('the custom window buttons are all there and Close hides to the tray');

  // ---- media keys and Pause key
  const reg = await app.evaluate(({ globalShortcut }) => ({ play: globalShortcut.isRegistered('MediaPlayPause'), next: globalShortcut.isRegistered('MediaNextTrack') }));
  assert.equal(reg.play, true); assert.equal(reg.next, true); pass('Play/Pause and Next media keys are registered with the system');
  await hold(page);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Pause', code: 'Pause', bubbles: true })));
  await waitPlaying(page, true);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Pause', code: 'Pause', bubbles: true })));
  await waitPlaying(page, false);
  pass('the Pause/Break key starts and stops the sound');
  if (spawnSync('which', ['xdotool']).status === 0) {
    spawnSync('xdotool', ['key', 'XF86AudioPlay'], { env: process.env }); await waitPlaying(page, true);
    spawnSync('sleep', ['0.9']); spawnSync('xdotool', ['key', 'XF86AudioPlay'], { env: process.env }); await waitPlaying(page, false);
    pass('a real Play/Pause media key press (X11) toggles the sound, even with another window focused');
  }
  await page.click('button[aria-label="Settings"]'); await tab(page, 'Keys');
  const mk = panel(page).getByRole('switch', { name: /media keys/i }).first(); await mk.click(); await sleep(700);
  assert.equal(settingsFile().mediaKeys, false);
  assert.equal(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('MediaPlayPause')), false, 'turning them off releases the keys for other players');
  await mk.click(); await sleep(700); assert.equal(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('MediaPlayPause')), true);
  await page.keyboard.press('Escape'); await hold(page);
  pass('media keys can be turned off and are released to other players');

  // ---- zen parity
  await page.click('button[aria-label="Open zen view"]'); await sleep(700);
  assert.ok(await page.locator('[data-testid="zen-goal"]').count() > 0, "today's goal is shown");
  await page.keyboard.press('s'); await sleep(400);
  assert.ok(await page.locator('[role=status]').filter({ hasText: /./ }).count() > 0, 'skip shows a message');
  await page.click('button[aria-label="Zen settings"]'); await page.locator('[data-testid="zen-drawer"]').waitFor();
  const overflow = await page.evaluate(() => { const d = document.querySelector('[data-testid="zen-drawer"]'); return d.scrollWidth - d.clientWidth; });
  assert.ok(overflow <= 1, `the drawer has no sideways scrolling (${overflow}px)`);
  await page.locator('[data-testid="zen-drawer"]').getByRole('switch', { name: /Today's goal/ }).click(); await sleep(300);
  assert.equal(await page.locator('[data-testid="zen-goal"]').count(), 0, "turning the goal off hides it");
  await page.locator('[data-testid="zen-drawer"]').getByRole('switch', { name: /Today's goal/ }).click(); await sleep(300);
  assert.ok(await page.locator('[data-testid="zen-goal"]').count() > 0);
  pass('Zen has the goal, messages and a settings drawer, each switchable');
  await page.keyboard.press('Escape'); await sleep(400);
  assert.equal(await page.locator('[data-testid="zen-drawer"]').count(), 0, 'Esc closes the drawer first');
  await page.getByRole('dialog', { name: 'Zen view' }).getByRole('button', { name: 'Close' }).first().click(); await sleep(600);
  assert.equal(await page.getByRole('dialog', { name: 'Zen view' }).count(), 0);

  // ---- Tracking without the custom scrollbar
  await page.click('button[aria-label="Settings"]'); await tab(page, 'Appearance');
  await panel(page).getByRole('switch', { name: /scrollbar/i }).first().click(); await sleep(300);
  assert.equal(await page.locator('[data-testid="custom-scrollbar"]').count(), 0); assert.equal((await prefsOf(page)).customScrollbar, false);
  await panel(page).getByRole('switch', { name: /scrollbar/i }).first().click();
  await page.keyboard.press('Escape');
  pass('the custom scrollbar can be switched off');

  assert.deepEqual(problems, [], 'no page errors: ' + problems.join(' | '));
  await app.close();
  console.log(`Verified ${results.length} UI checks for 1.4.`);
})().catch((error) => { console.error('FAIL', error); process.exit(1); });
