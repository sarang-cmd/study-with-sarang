'use strict';
/**
 * Update checks and the "Update now" flow. The installed app asks GitHub for the latest release, and when
 * the user agrees it downloads the new setup file, checks its SHA-256, then starts it in update mode and
 * quits. The setup window (the same animated installer) replaces the old files and reopens the app.
 */
const os = require('node:os');
const path = require('node:path');
const core = require('./update-core.cjs');

const SIX_HOURS = 6 * 60 * 60 * 1000;

function createUpdater({
  version, store, send, notify, openExternal, installDir, canSelfUpdate, defaultRepo = '', platform = process.platform,
  quit, spawn, disabled = false, tmpdir = os.tmpdir(), net = {}, firstCheckMs = 25000, intervalMs = SIX_HOURS,
}) {
  let timers = [];
  let busy = false;
  let release = null;
  let notifiedFor = '';
  const state = {
    status: 'idle', current: version, latest: '', notes: '', htmlUrl: '', fileName: '', size: 0, progress: 0, error: '', checkedAt: 0,
    dismissed: false, repo: '', auto: true, configured: false, canSelfUpdate: false, canUpdate: false, disabled,
  };

  const repo = () => core.cleanRepo(store.get().updateRepo) || core.cleanRepo(defaultRepo);
  function publish(patch = {}) {
    Object.assign(state, patch);
    state.repo = repo(); state.auto = store.get().updateAuto; state.configured = Boolean(state.repo);
    state.canSelfUpdate = Boolean(canSelfUpdate());
    state.canUpdate = state.status === 'available' && Boolean(release?.file) && state.canSelfUpdate;
    send({ ...state });
    return { ...state };
  }
  const message = (error) => (error && error.message ? error.message : 'Something went wrong.');

  async function check({ manual = false } = {}) {
    if (busy) return publish();
    if (!repo()) return publish({ status: 'unconfigured', error: '' });
    busy = true; publish({ status: 'checking', error: '' });
    try {
      const { none, release: found } = await core.fetchLatest(repo(), net);
      const patch = { checkedAt: Date.now(), error: '' };
      if (none) { release = null; return publish({ ...patch, status: 'uptodate', latest: '', notes: '' }); }
      if (!found || core.compare(found.version, version) <= 0) { release = null; return publish({ ...patch, status: 'uptodate', latest: found?.version ?? '', notes: '' }); }
      release = found;
      const skipped = store.get().updateSkip === found.version && !manual;
      // A skipped version stays listed in the Updates card but never opens the prompt.
      const result = publish({
        ...patch, status: 'available', latest: found.version, notes: found.notes, htmlUrl: found.htmlUrl,
        fileName: found.file?.name ?? '', size: found.file?.size ?? 0, progress: 0, dismissed: skipped,
      });
      if (!skipped && !manual && notifiedFor !== found.version) { notifiedFor = found.version; notify?.(`Study with Sarang ${found.version} is available`); }
      return result;
    } catch (error) {
      return publish({ status: 'error', error: message(error), checkedAt: Date.now() });
    } finally { busy = false; }
  }

  async function install() {
    if (busy || !release || state.status !== 'available') return publish();
    if (!release.file) { if (state.htmlUrl) openExternal?.(state.htmlUrl); return publish(); }
    if (!canSelfUpdate()) { if (state.htmlUrl) openExternal?.(state.htmlUrl); return publish(); }
    const dir = installDir();
    if (!dir) return publish({ status: 'error', error: 'This copy was not installed with the setup, so it cannot replace itself. Open the release page instead.' });
    busy = true; publish({ status: 'downloading', progress: 0, error: '' });
    try {
      const sha256 = await core.resolveHash(release.file, net);
      const dest = path.join(tmpdir, 'swa-update', release.file.name);
      await core.download({ url: release.file.url, dest, sha256, size: release.file.size, onProgress: (progress) => publish({ progress }), ...net });
      publish({ status: 'launching', progress: 100 });
      const child = spawn(dest, ['--update', `--update-dir=${dir}`], { detached: true, stdio: 'ignore' });
      child.on?.('error', () => {});
      child.unref?.();
      setTimeout(() => quit(), 600);
      return { ...state };
    } catch (error) {
      return publish({ status: 'available', error: message(error), progress: 0 });
    } finally { busy = false; }
  }

  function skip() {
    if (state.latest) store.patch({ updateSkip: state.latest });
    return publish({ dismissed: true });
  }
  function dismiss() { return publish({ dismissed: true }); }

  function schedule() {
    timers.forEach((t) => clearTimeout(t)); timers = [];
    if (disabled || !store.get().updateAuto || !repo()) return;
    const first = setTimeout(() => { void check(); }, firstCheckMs);
    const every = setInterval(() => { void check(); }, intervalMs);
    first.unref?.(); every.unref?.();
    timers = [first, every];
  }
  function setConfig(raw) {
    const patch = {};
    if (raw && typeof raw.repo === 'string') {
      const cleaned = core.cleanRepo(raw.repo);
      if (raw.repo.trim() && !cleaned) return publish({ error: 'Use the form owner/repository, for example sarang/study-with-sarang.' });
      patch.updateRepo = cleaned; patch.updateSkip = '';
    }
    if (raw && typeof raw.auto === 'boolean') patch.updateAuto = raw.auto;
    if (Object.keys(patch).length) store.patch(patch);
    schedule();
    return publish({ error: '', status: repo() ? (state.status === 'unconfigured' ? 'idle' : state.status) : 'unconfigured' });
  }
  function stop() { timers.forEach((t) => clearTimeout(t)); timers = []; }

  publish({ status: repo() ? 'idle' : 'unconfigured' });
  return { get: () => ({ ...state }), check, install, skip, dismiss, setConfig, schedule, stop, platform };
}

module.exports = { createUpdater };
