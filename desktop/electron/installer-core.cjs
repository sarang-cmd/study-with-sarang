'use strict';
/**
 * Installer logic that does not need a window: choosing a safe folder, copying with progress,
 * and removing again. Everything that touches Windows itself (shortcuts, registry, login item,
 * stopping a running copy) is passed in as `ops`, so tests can run it anywhere with fakes.
 */
// Electron's patched fs treats app.asar as a folder. original-fs copies it as the plain file it is.
const fs = (() => { try { return require('original-fs'); } catch { return require('node:fs'); } })();
const path = require('node:path');

const MARKER = 'install.json';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(target) { try { await fs.promises.access(target); return true; } catch { return false; } }
async function isEmptyDir(dir) { try { return (await fs.promises.readdir(dir)).length === 0; } catch { return true; } }

/**
 * Never delete or overwrite a folder that is not ours. If the chosen folder already holds other
 * files, install into a subfolder with the app's name instead.
 */
async function resolveInstallDir(chosen, appName, { source } = {}) {
  if (typeof chosen !== 'string' || !path.isAbsolute(chosen)) throw new Error('Choose a full folder path.');
  let dir = path.resolve(chosen);
  if (path.parse(dir).root === dir) dir = path.join(dir, appName); // Never install straight into a drive root.
  if (await exists(dir) && !(await isEmptyDir(dir)) && !(await exists(path.join(dir, MARKER)))) {
    dir = path.join(dir, appName);
    if (await exists(dir) && !(await isEmptyDir(dir)) && !(await exists(path.join(dir, MARKER)))) throw new Error(`"${dir}" already exists and is not a Study with Sarang folder.`);
  }
  if (source) {
    const rel = path.relative(path.resolve(source), dir);
    if (!rel || (!rel.startsWith('..') && !path.isAbsolute(rel))) throw new Error('The install folder cannot be inside the setup folder.');
    const back = path.relative(dir, path.resolve(source));
    if (!back.startsWith('..') && !path.isAbsolute(back)) throw new Error('The install folder cannot contain the setup folder.');
  }
  return dir;
}

async function listFiles(root) {
  const files = []; let bytes = 0;
  async function walk(dir, rel) {
    for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
      const from = path.join(dir, entry.name); const to = rel ? path.join(rel, entry.name) : entry.name;
      if (!rel && entry.name === MARKER) continue;
      if (entry.isDirectory()) { files.push({ rel: to, dir: true, size: 0 }); await walk(from, to); }
      else if (entry.isFile()) { const { size } = await fs.promises.stat(from); files.push({ rel: to, dir: false, size }); bytes += size; }
    }
  }
  await walk(root, '');
  return { files, bytes };
}

async function removeDir(dir) {
  let last;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try { await fs.promises.rm(dir, { recursive: true, force: true }); return; } catch (error) { last = error; await sleep(250 * (attempt + 1)); }
  }
  throw last;
}

async function renameWithRetry(from, to) {
  let last;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try { await fs.promises.rename(from, to); return; } catch (error) { last = error; await sleep(300 * (attempt + 1)); }
  }
  throw last;
}

async function install({ source, dest, appName, version, options, ops, onProgress, minDurationMs = 0 }) {
  const started = Date.now();
  const report = (percent, label, extra = {}) => onProgress?.({ percent: Math.min(100, Math.round(percent * 10) / 10), label, ...extra });
  const exeName = path.basename(ops.exeName ?? 'Study with Sarang.exe');
  report(1, 'Getting ready');
  const target = await resolveInstallDir(dest, appName, { source });
  const { files, bytes } = await listFiles(source);
  if (!files.some((file) => !file.dir && path.basename(file.rel) === exeName) && !options.allowMissingExe) throw new Error(`${exeName} was not found next to the setup, so there is nothing to install.`);

  report(3, 'Closing any running copy'); await ops.stopRunning?.(path.join(target, exeName));
  // The old version is moved aside, not deleted, so a failed update puts it back instead of leaving a broken app.
  let backup = null;
  if (await exists(target)) {
    report(6, 'Setting the old version aside');
    if (await exists(path.join(target, MARKER))) {
      backup = `${target}.previous`;
      await removeDir(backup);
      await renameWithRetry(target, backup);
    }
  }
  try {
    return await copyIn();
  } catch (error) {
    if (backup) { try { await removeDir(target); await fs.promises.rename(backup, target); } catch { /* Keep the original error. */ } }
    throw error;
  }

  async function copyIn() {
  await fs.promises.mkdir(target, { recursive: true });

  let copied = 0, done = 0;
  const total = files.filter((file) => !file.dir).length;
  let lastReport = 0;
  for (const file of files) {
    const to = path.join(target, file.rel);
    if (file.dir) { await fs.promises.mkdir(to, { recursive: true }); continue; }
    await fs.promises.mkdir(path.dirname(to), { recursive: true });
    await fs.promises.copyFile(path.join(source, file.rel), to);
    copied += file.size; done += 1;
    const now = Date.now();
    if (now - lastReport > 40 || done === total) { lastReport = now; report(8 + (bytes ? copied / bytes : 1) * 76, 'Unpacking Flow', { files: done, total }); }
  }
  await fs.promises.writeFile(path.join(target, MARKER), JSON.stringify({ name: appName, version, installedAt: new Date().toISOString(), options }, null, 2));

  const exe = path.join(target, exeName);
  report(86, 'Placing shortcuts'); await ops.createShortcuts?.({ exe, target, options });
  report(91, 'Registering with Windows'); await ops.register?.({ exe, target, version, bytes });
  report(95, options.autostart ? 'Setting it to open at sign-in' : 'Saving your choices'); await ops.applyOptions?.({ exe, options });
  // Let the animation breathe, so a fast copy does not flash past.
  const wait = minDurationMs - (Date.now() - started);
  if (wait > 0) { report(98, 'Tuning the layers'); await sleep(wait); }
  report(100, 'All set', { files: total, total });
  if (backup) { try { await removeDir(backup); } catch { /* A leftover folder is harmless and replaced next time. */ } }
  return { target, exe, files: total, bytes };
  }
}

async function uninstall({ dir, appName, deleteData, dataDir, ops, onProgress }) {
  const report = (percent, label) => onProgress?.({ percent, label });
  if (!(await exists(path.join(dir, MARKER)))) throw new Error('This folder does not look like a Study with Sarang install, so nothing was removed.');
  report(10, 'Closing the app'); await ops.stopRunning?.(path.join(dir, path.basename(ops.exeName ?? 'Study with Sarang.exe')));
  report(35, 'Removing shortcuts'); await ops.removeShortcuts?.();
  report(60, 'Unregistering'); await ops.unregister?.();
  report(80, 'Turning off open at sign-in'); await ops.removeLogin?.();
  const targets = [dir]; if (deleteData && dataDir) targets.push(dataDir);
  report(92, 'Removing files'); await ops.scheduleDelete?.(targets);
  report(100, 'Removed');
  return { targets };
}

module.exports = { install, uninstall, resolveInstallDir, listFiles, removeDir, MARKER };
