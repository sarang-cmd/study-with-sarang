'use strict';
/**
 * Drives the real app through an update against a local stand-in for GitHub: set the repository in the
 * Updates card, find the new version, see the prompt, hand over to the installer. Needs a display.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const { startMockGithub } = require('./_mock-github.cjs');
const root = path.join(__dirname, '..');
const shots = process.env.SWA_SHOTS; if (shots) fs.mkdirSync(shots, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);

(async () => {
  const gh = await startMockGithub();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-upd-ui-'));
  const log = path.join(tmp, 'spawn.log'); const installDir = path.join(tmp, 'installed'); fs.mkdirSync(installDir);
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env: {
    ...process.env, XDG_CONFIG_HOME: path.join(tmp, 'config'), SWA_UPDATE_API: gh.url, SWA_UPDATE_FAKE_INSTALL: installDir, SWA_UPDATE_TMP: path.join(tmp, 'dl'), SWA_UPDATE_SPAWN_LOG: log, SWA_UPDATE_FIRST_MS: '600' } });
  const page = await app.firstWindow(); const problems = [];
  page.on('pageerror', (e) => problems.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/youtube|googlevideo|ERR_|Failed to load resource/i.test(m.text())) problems.push(m.text()); });
  await page.waitForFunction(() => window.desktop && document.querySelector('#sound'));
  await sleep(1200);
  await page.click('button[aria-label="Settings"]'); await page.click('nav[aria-label="Settings sections"] >> text=Window and updates'); await sleep(400);
  const shot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) }); };

  const card = page.locator('h3:has-text("Updates")').locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
  await card.scrollIntoViewIfNeeded(); await sleep(900);
  assert.match(await card.innerText(), /Enter the GitHub repository/);
  assert.equal(await page.getByRole('dialog', { name: /Version/ }).count(), 0);
  await shot('update-card-unset');
  pass('without a repository the card asks for one and nothing is checked');

  await card.getByLabel('GitHub repository').fill('not a repo'); await card.getByRole('button', { name: 'Save' }).click(); await sleep(400);
  assert.match(await page.locator('body').innerText(), /owner\/repository, for example|Use the form/);
  await card.getByLabel('GitHub repository').fill('o/r'); await card.getByRole('button', { name: 'Save' }).click(); await sleep(400);
  await card.getByRole('button', { name: /Check now/ }).click();
  const dialog = page.getByRole('dialog', { name: /Version 9.9.9/ });
  await dialog.waitFor({ timeout: 10000 });
  assert.match(await dialog.innerText(), /calmer start/); assert.match(await dialog.innerText(), /You have 2\./);
  await sleep(400); await shot('update-prompt');
  pass('saving a repository and checking opens the update prompt with the release notes');

  await dialog.getByRole('button', { name: 'Later' }).click(); await page.getByRole('dialog', { name: /Version 9.9.9/ }).waitFor({ state: 'detached' });
  await sleep(300); assert.match(await card.innerText(), /Version 9.9.9 is available/);
  await shot('update-card-available');
  pass('Later closes the prompt and the card still offers the update');

  const closed = app.waitForEvent('close');
  await card.getByRole('button', { name: /Update to 9.9.9/ }).click();
  await closed;
  const lines = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 1); const [file, args] = lines[0];
  assert.equal(path.basename(file), 'Study-with-Sarang-9.9.9.exe'); assert.deepEqual(args, ['--update', `--update-dir=${installDir}`]);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), gh.state.sha);
  pass('Update to 9.9.9 downloads a verified file, starts it in update mode and the app quits');
  assert.deepEqual(problems, []);
  await gh.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log('Verified the update flow in the app.');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
