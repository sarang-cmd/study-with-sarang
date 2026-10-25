import { RefreshCw, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { APP_VERSION, useWebUpdate } from '../lib/webUpdate';

/** Browser only. A calm popup when the site has a newer version than the page you have open. You choose: reload now, later, or skip it. */
export function WebUpdatePrompt() {
  const { update, later, skip } = useWebUpdate();
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!update) return undefined;
    primary.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') later(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [update, later]);
  if (!update) return null;
  return <div className="fixed inset-0 z-[127] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm no-print">
    <div role="dialog" aria-modal="true" aria-labelledby="web-update-heading" data-testid="web-update" className="w-full max-w-[460px] rounded-2xl border border-line bg-canvas p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div><p className="section-label mb-2">Update available</p><h2 id="web-update-heading" className="text-[22px] font-semibold tracking-tight">Version {update.version}</h2>
          <p className="mt-1 text-[11px] text-muted">This page is version {APP_VERSION}. Reloading loads the new one; your saved data stays on this device.</p></div>
        <button type="button" onClick={later} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border border-line hover:border-ink"><X size={15} /></button>
      </div>
      {update.notes && <div className="mt-4 max-h-[180px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-[11px] leading-relaxed text-muted">{update.notes}</div>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button ref={primary} type="button" className="studio-button studio-button-primary" onClick={() => window.location.reload()}><RefreshCw size={13} />Reload now</button>
        <button type="button" className="studio-button" onClick={later}>Later</button>
        <button type="button" className="studio-button" onClick={skip}>Skip this version</button>
      </div>
    </div>
  </div>;
}
