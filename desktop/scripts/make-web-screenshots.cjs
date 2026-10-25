'use strict';
/** Screenshots of the browser version (needs web/dist served, e.g. python3 -m http.server 4173 in web/dist). Run under xvfb-run. */
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { _electron: electron } = require('playwright-core');
const out = path.resolve(process.argv[2] || 'screenshots'); fs.mkdirSync(out, { recursive: true });
const url = process.env.SWA_WEB_URL || 'http://127.0.0.1:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const shell = path.join(os.tmpdir(), 'web-shell.cjs');
  fs.writeFileSync(shell, `const { app, BrowserWindow } = require('electron'); app.whenReady().then(() => { const w = new BrowserWindow({ width: 1440, height: 900, useContentSize: true }); w.loadURL(${JSON.stringify(url)}); });`);
  const app = await electron.launch({ executablePath: require('electron'), args: [shell, '--no-sandbox', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'webshots-')) } });
  const page = await app.firstWindow(); await page.waitForSelector('#timer'); await sleep(2500);
  for (let i = 0; i < 3; i += 1) { await page.keyboard.press('Escape'); await sleep(700); }
  await page.locator('[data-testid="download-card"]').scrollIntoViewIfNeeded(); await sleep(900);
  await page.screenshot({ path: path.join(out, 'web-download.png') }); console.log('shot web-download');
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
