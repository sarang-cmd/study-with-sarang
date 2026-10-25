import { Download, ExternalLink } from 'lucide-react';
import { isDesktop } from '../lib/desktop';
import { SUITE } from '../lib/suite';

/** A quiet "Get the app" link for the top bar. It only exists in the browser version; the desktop app is the app. */
export function DownloadPill() {
  if (isDesktop) return null;
  return <a href={SUITE.study.latestUrl} target="_blank" rel="noopener noreferrer" data-testid="download-pill" aria-label="Download the desktop app (opens GitHub)"
    data-tip="Download the desktop app for Windows"
    className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-semibold text-muted transition-colors duration-200 hover:border-ink hover:text-ink">
    <Download size={14} strokeWidth={1.9} aria-hidden="true" /><span className="hidden min-[1500px]:inline">Get the app</span>
  </a>;
}

/** A card on the Studio page (browser version only) explaining what the desktop app adds. */
export function DownloadCard() {
  if (isDesktop) return null;
  return <section aria-labelledby="get-app-heading" data-testid="download-card" className="mt-6 rounded-2xl border border-line bg-surface px-5 py-5 sm:px-7">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="max-w-[640px]">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-muted">Desktop app for Windows</p>
        <h2 id="get-app-heading" className="mt-2 text-[18px] font-semibold tracking-[-0.03em]">Study with Sarang, outside the browser</h2>
        <p className="mt-2 text-[12.5px] leading-[1.75] text-muted">A single program with its own window, a mini bar that stays on top, real notifications, the media keys, voice commands ("Flow, pause my music") and an updater. It works offline and it never needs an account. This page keeps working in the browser as well.</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <a href={SUITE.study.directUrl} data-testid="download-direct" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-80"><Download size={15} aria-hidden="true" />Download for Windows</a>
        <a href={SUITE.study.latestUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink">All downloads<ExternalLink size={13} aria-hidden="true" /></a>
      </div>
    </div>
    <p className="mt-3 text-[11px] leading-relaxed text-muted">The installer is signed with a self-made certificate, so Windows SmartScreen may ask you to confirm once (More info, then Run anyway). Check the SHA-256 on the release page if you like. macOS and Android are not available yet.</p>
  </section>;
}
