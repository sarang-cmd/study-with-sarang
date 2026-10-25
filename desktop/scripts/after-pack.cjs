'use strict';
/**
 * electron-builder normally edits the Windows exe with rcedit, which needs wine on Linux and macOS.
 * This does the same job in pure JavaScript with resedit: it puts the app icon and the version
 * information into the exe, so the file shows the right icon in Explorer, the taskbar and Task Manager.
 */
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = await require('resedit/cjs').load();
  const pkg = JSON.parse(fs.readFileSync(path.join(context.packager.projectDir, 'package.json'), 'utf8'));
  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const icon = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(context.packager.projectDir, 'assets', 'icon.ico')));

  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath));
  const resources = ResEdit.NtExecutableResource.from(exe);

  // Replace the existing icon group (Electron's) so Windows picks ours everywhere.
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);
  const group = groups[0];
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(resources.entries, group ? group.id : 1, group ? group.lang : 1033, icon.icons.map((item) => item.data));

  const [version] = ResEdit.Resource.VersionInfo.fromEntries(resources.entries);
  const parts = pkg.version.split('.').map((n) => Number(n) || 0); while (parts.length < 3) parts.push(0);
  version.setFileVersion(parts[0], parts[1], parts[2], 0, 1033);
  version.setProductVersion(parts[0], parts[1], parts[2], 0, 1033);
  version.setStringValues({ lang: 1033, codepage: 1200 }, {
    ProductName: 'Study with Sarang', FileDescription: 'Study with Sarang', CompanyName: 'Sarang', LegalCopyright: `Copyright ${new Date().getFullYear()} Sarang`,
    OriginalFilename: path.basename(exePath), InternalName: 'Study with Sarang', ProductVersion: pkg.version, FileVersion: pkg.version,
  });
  version.outputToResourceEntries(resources.entries);
  resources.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log(`  • patched icon and version info into ${path.basename(exePath)}`);
};
