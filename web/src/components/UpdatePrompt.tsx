import { Download, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { megabytes, updateApi, useUpdate } from '../lib/update';

/** Opens by itself when a newer version is found. The person decides: update now, later, or skip this version. */
export function UpdatePrompt() {
  const update = useUpdate();
  const primary = useRef<HTMLButtonElement>(null);
  const busy = update?.status === 'downloading' || update?.status === 'launching';
  const open = Boolean(update && (busy || (update.status === 'available' && !update.dismissed)));
  useEffect(() => {
    if (!open) return;
    primary.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) void updateApi.dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy]);
  if (!update || !open) return null;
  const can = update.canUpdate;
  return <div className="fixed inset-0 z-[127] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm no-print">
    <div role="dialog" aria-modal="true" aria-labelledby="update-heading" className="arrive w-full max-w-[460px] rounded-2xl border border-line bg-canvas p-6 shadow-float">
      <div className="flex items-start justify-between gap-3">
        <div><p className="section-label mb-2">Update available</p><h2 id="update-heading" className="text-[22px] font-semibold tracking-tight">Version {update.latest}</h2>
          <p className="mt-1 text-[11px] text-muted">You have {update.current}.{update.size ? ` Download size ${megabytes(update.size)}.` : ''}</p></div>
        {!busy && <button type="button" onClick={() => void updateApi.dismiss()} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border border-line hover:border-ink"><X size={15} /></button>}
      </div>
      {update.notes && <div className="mt-4 max-h-[180px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-[11px] leading-relaxed text-muted">{update.notes}</div>}
      {busy ? <div className="mt-5" role="status">
        <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-ink transition-all" style={{ width: `${update.progress}%` }} /></div>
        <p className="mt-2 text-[11px] text-muted">{update.status === 'launching' ? 'Starting the installer. The app closes and reopens by itself.' : `Downloading and checking the file, ${update.progress}%`}</p>
      </div> : <>
        {update.error && <p role="alert" className="mt-4 rounded-xl border border-line px-3 py-2 text-[11px]">{update.error}</p>}
        {!can && <p className="mt-4 text-[11px] leading-relaxed text-muted">{update.canSelfUpdate ? 'This release has no Windows file attached.' : 'This copy cannot replace itself (it was not installed with the setup).'} Open the download page to get it.</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button ref={primary} type="button" className="studio-button studio-button-primary" onClick={() => void updateApi.install()}><Download size={13} />{can ? 'Update now' : 'Open download page'}</button>
          <button type="button" className="studio-button" onClick={() => void updateApi.dismiss()}>Later</button>
          <button type="button" className="studio-button" onClick={() => void updateApi.skip()}>Skip this version</button>
        </div>
      </>}
    </div>
  </div>;
}
