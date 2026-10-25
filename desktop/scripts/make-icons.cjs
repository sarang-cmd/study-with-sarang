'use strict';
// Draws every app icon (src/lib/iconSet.ts) into the files the desktop shell and the page need.
// Run with:  xvfb-run -a npx electron scripts/make-icons.cjs   (any display works; nothing is shown)
// Output: assets/icons/<id>/{icon.png,icon.ico,icon.svg,tray.png,trayTemplate.png,trayTemplate@2x.png}, public/icons/<id>/art-*.png,
//         plus assets/icon.{png,ico,svg} and public/favicon.svg for the default icon.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.join(__dirname, '..');

function loadIconSet() {
  const out = path.join(os.tmpdir(), `swa-iconset-${process.pid}.cjs`);
  require('esbuild').buildSync({ entryPoints: [path.join(root, 'src/lib/iconSet.ts')], bundle: true, format: 'cjs', platform: 'node', outfile: out, logLevel: 'silent' });
  const mod = require(out); fs.rmSync(out, { force: true }); return mod;
}

/** A .ico that holds PNG images (supported by Windows Vista and later). */
function makeIco(images) {
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16; const entries = []; 
  for (const { size, png } of images) {
    const e = Buffer.alloc(16); e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(png.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); offset += png.length;
  }
  return Buffer.concat([head, ...entries, ...images.map((i) => i.png)]);
}

app.whenReady().then(async () => {
  const { ICONS, iconSvg } = loadIconSet();
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: false } });
  await win.loadURL('data:text/html,<canvas id=c></canvas>');
  const render = async (svg, size) => {
    const url = await win.webContents.executeJavaScript(`(async()=>{const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(${JSON.stringify(svg)});await img.decode();const c=document.createElement('canvas');c.width=c.height=${size};const x=c.getContext('2d');x.drawImage(img,0,0,${size},${size});return c.toDataURL('image/png')})()`);
    return Buffer.from(url.split(',')[1], 'base64');
  };
  const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
  for (const def of ICONS) {
    const a = path.join(root, 'assets/icons', def.id), p = path.join(root, 'public/icons', def.id);
    const svg = (size, o) => iconSvg(def.id, { size, ...o });
    write(path.join(a, 'icon.svg'), svg(64));
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const images = []; for (const size of sizes) images.push({ size, png: await render(svg(size), size) });
    write(path.join(a, 'icon.ico'), makeIco(images));
    write(path.join(a, 'icon.png'), await render(svg(512), 512));
    write(path.join(a, 'tray.png'), await render(svg(64), 64));
    write(path.join(a, 'trayTemplate.png'), await render(svg(22, { template: true }), 22));
    write(path.join(a, 'trayTemplate@2x.png'), await render(svg(44, { template: true }), 44));
    for (const size of [96, 128, 256, 512]) write(path.join(p, `art-${size}.png`), await render(svg(size), size));
    write(path.join(p, 'icon.svg'), svg(64));
    if (def.id === 'default') {
      write(path.join(root, 'assets/icon.svg'), svg(64)); write(path.join(root, 'assets/icon.png'), await render(svg(512), 512));
      write(path.join(root, 'assets/icon.ico'), makeIco(images)); write(path.join(root, 'assets/tray.png'), await render(svg(64), 64));
      write(path.join(root, 'public/favicon.svg'), svg(64));
    }
    console.log('icon', def.id);
  }
  app.quit();
});
