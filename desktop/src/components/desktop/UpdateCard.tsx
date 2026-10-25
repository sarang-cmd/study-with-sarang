import { Download, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDesktop } from '../../context/DesktopContext';
import { megabytes, updateApi, useUpdate } from '../../lib/update';
import { Card, Toggle } from './shared';

const ago = (time: number) => {
  if (!time) return 'not checked yet';
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
};

export function UpdateCard() {
  const { info } = useDesktop();
  const update = useUpdate();
  const [repo, setRepo] = useState('');
  useEffect(() => { if (update) setRepo((value) => (value === '' ? update.repo : value)); }, [update?.repo]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!info || !update) return null;
  if (update.disabled) return <Card title="Updates" hint="The Microsoft Store keeps this app up to date. Nothing to set up here." children={<p className="text-[10px] text-muted">Version {update.current}.</p>} />;
  const busy = update.status === 'checking' || update.status === 'downloading' || update.status === 'launching';
  const available = update.status === 'available';
  const line = (() => {
    switch (update.status) {
      case 'unconfigured': return update.error || 'Enter the update address below to turn update checks on.';
      case 'checking': return 'Checking...';
      case 'uptodate': return `You have the latest version (${update.current}). Checked ${ago(update.checkedAt)}.`;
      case 'available': return `Version ${update.latest} is available${update.size ? ` (${megabytes(update.size)})` : ''}.`;
      case 'downloading': return `Downloading and checking the file, ${update.progress}%`;
      case 'launching': return 'Starting the installer. The app closes and reopens by itself.';
      case 'error': return update.error;
      default: return update.error || `Version ${update.current}. Last checked ${ago(update.checkedAt)}.`;
    }
  })();
  const dirty = repo.trim() !== update.repo;
  return <Card title="Updates" hint="Checks the update feed on the Study with Sarang website, downloads the new setup, verifies its SHA-256, then runs the same animated installer over this copy. Your mixes and settings stay.">
    <div className="grid gap-2">
      <p role="status" className={`rounded-xl border bg-canvas px-3.5 py-2.5 text-[11px] ${update.status === 'error' ? 'border-ink' : 'border-line'}`}>{line}</p>
      {available && update.error && <p role="alert" className="rounded-xl border border-ink bg-canvas px-3.5 py-2.5 text-[11px]">{update.error}</p>}
      <Toggle label="Check in the background" hint="At start and every few hours. It only asks you; nothing installs without a click." checked={update.auto} disabled={!update.configured} onChange={(value) => void updateApi.setConfig({ auto: value })} />
      <label className="block rounded-xl border border-line bg-canvas px-3.5 py-2.5">
        <span className="block text-[11px] font-semibold">Update address</span>
        <span className="mt-0.5 block text-[10px] leading-snug text-muted">A https address on vercel.app that returns the update feed (a small JSON file with the version, the file and its SHA-256). Leave the built-in one unless you host your own.</span>
        <span className="mt-2 flex gap-2">
          <input className="field min-w-0 flex-1" value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="https://study-with-sarang.vercel.app/updates/latest.json" spellCheck={false} autoCapitalize="off" aria-label="Update address" />
          <button type="button" className="studio-button" disabled={!dirty} onClick={() => void updateApi.setConfig({ repo: repo.trim() })}>Save</button>
        </span>
      </label>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" className="studio-button" disabled={busy || !update.configured} onClick={() => void updateApi.check()}><RefreshCw size={13} className={update.status === 'checking' ? 'animate-spin' : ''} />Check now</button>
      {available && <button type="button" className="studio-button studio-button-primary" disabled={busy} onClick={() => void updateApi.install()}><Download size={13} />{update.canUpdate ? `Update to ${update.latest}` : 'Open download page'}</button>}
      {available && update.dismissed && <span className="self-center text-[10px] text-muted">You chose Later or Skip for this one.</span>}
    </div>
    {!update.canSelfUpdate && <p className="mt-3 text-[10px] leading-relaxed text-muted">This copy was not installed with the setup, so it can tell you about updates but cannot replace itself. Run the new exe to install it.</p>}
  </Card>;
}
