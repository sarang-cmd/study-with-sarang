'use strict';
// Writes <file>.sha256 next to each Study-with-Sarang-x.y.z.exe, the checksum file the updater looks for.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(process.argv[2] || 'release');
const files = fs.readdirSync(dir).filter((name) => /^Study-with-Sarang-\d+\.\d+\.\d+\.exe$/.test(name));
if (!files.length) { console.error(`No Study-with-Sarang-x.y.z.exe in ${dir}`); process.exit(1); }
for (const name of files) {
  const sum = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex');
  fs.writeFileSync(path.join(dir, `${name}.sha256`), `${sum}  ${name}\n`);
  console.log(`${sum}  ${name}`);
}
