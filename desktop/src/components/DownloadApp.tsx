import { Download, ExternalLink } from 'lucide-react';
import { isDesktop } from '../lib/desktop';
import { SUITE } from '../lib/suite';

/** A quiet "Get the app" link for the top bar. It only exists in the browser version; the desktop app is the app. */
export function DownloadPill() {
  if (isDesktop) return null;
  return <a href={SUITE.study.downloadsUrl} data-testid="download-pill" aria-label="Downloads: get the desktop app and the browser helper"
    data-tip="Downloads: desktop app for Windows"
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
        <a href={SUITE.study.downloadsUrl} data-testid="all-downloads" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink">All downloads<ExternalLink size={13} aria-hidden="true" /></a>
      </div>
    </div>
    <p className="mt-3 text-[11px] leading-relaxed text-muted">The installer is signed with a self-made certificate, so Windows SmartScreen may ask you to confirm once (More info, then Run anyway). The download page shows the SHA-256 so you can check the file. macOS and Android are not available yet.</p>
  </section>;
}

/** A slim banner for the top of the studio page (browser version only): the desktop app and the download page, always in view. */
export function DownloadBanner({ className = 'mb-6' }: { className?: string }) {
  if (isDesktop) return null;
  return <aside aria-label="Get the desktop app" data-testid="download-banner" className={`${className} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-ink bg-surface px-5 py-3.5 sm:px-6`}>
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-canvas"><Download size={16} strokeWidth={2} /></span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold tracking-[-0.02em]">Study with Sarang, outside the browser</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted">A desktop app for Windows with its own window and an updater. Free, and it keeps working offline.</p>
      </div>
    </div>
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <a href={SUITE.study.directUrl} data-testid="banner-download" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-80"><Download size={14} aria-hidden="true" />Get the app</a>
      <a href={SUITE.study.downloadsUrl} data-testid="banner-downloads" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink">Downloads<ExternalLink size={13} aria-hidden="true" /></a>
    </div>
  </aside>;
}
