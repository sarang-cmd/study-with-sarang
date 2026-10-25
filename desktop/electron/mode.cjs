'use strict';
const fs = require('node:fs');
const path = require('node:path');

/**
 * The same executable is the installer, the uninstaller and the app.
 *  - "setup": the downloaded single .exe, run from anywhere, has not been installed yet.
 *  - "app": an installed copy (install.json sits next to it), the Microsoft Store build, dev runs.
 *  - "uninstall": started from Windows "Apps & features" with --uninstall.
 */
function detect({ argv = process.argv, packaged, platform = process.platform, execPath = process.execPath, windowsStore = false, exists = fs.existsSync } = {}) {
  if (argv.includes('--uninstall')) return 'uninstall';
  if (argv.includes('--setup') || argv.includes('--update')) return 'setup';
  if (!packaged || platform !== 'win32' || windowsStore) return 'app';
  if (argv.some((item) => item === '--portable' || item === '--login' || item === '--hidden' || item.startsWith('--cmd'))) return 'app';
  if (exists(path.join(path.dirname(execPath), 'install.json'))) return 'app';
  return 'setup';
}

module.exports = { detect };
