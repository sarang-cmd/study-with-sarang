import { Download, ExternalLink, MonitorSmartphone } from 'lucide-react';
import { SUITE } from '../../lib/suite';

/** What each desktop-only settings page does. A browser cannot do these things, so the website says so and shows what you get. */
export const DESKTOP_ONLY: Record<string, { title: string; what: string; points: string[] }> = {
  drift: { title: 'Drift detection', what: 'Notices when you wander off to a distracting app or site while a study block runs, and nudges you back.', points: ['You choose which apps and sites count as drifting.', 'It only compares window titles on your computer; nothing is recorded or sent anywhere.', 'It can trigger Automations, such as pausing the timer.'] },
  autopause: { title: 'Auto-pause', what: 'Pauses your sound by itself when another app starts playing audio, and resumes it afterwards.', points: ['Works across the whole computer, not only this page.', 'You pick which apps may pause the sound and how fast it fades back.'] },
  discord: { title: 'Discord status', what: 'Shows what you choose on your own Discord profile while you study, with the Study with Sarang logo.', points: ['Off by default. You pick what is shown: the mode, a live timer, break state, an Open button.', 'It talks to the Discord app on your computer; browsers are not allowed to do that.'] },
  desktop: { title: 'Window and updates', what: 'Own window, tray icon, a mini bar that stays on top, snapping to screen layouts, multiple monitors, open at login and the updater.', points: ['The website updates itself: reload to get the newest version.', 'The desktop app keeps working offline and checks for updates on its own.'] },
  voice: { title: 'Voice and macros', what: 'Hold a key anywhere on your computer, say what you want ("Flow, volume full"), and it happens. Macros chain steps such as window moves and sound changes.', points: ['The Flow tab on this website already understands voice commands in the page.', 'Global push-to-talk and window macros need the desktop app.'] },
};

/** Shown in the browser version in place of a settings page that only works in the desktop app. */
export function DesktopOnlyPanel({ id }: { id: string }) {
  const info = DESKTOP_ONLY[id]; if (!info) return null;
  return <section data-testid="desktop-only" data-feature={id} className="rounded-2xl border border-line bg-canvas p-5">
    <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-muted"><MonitorSmartphone size={13} aria-hidden="true" />Works in the desktop app</p>
    <h3 className="mt-2 text-[16px] font-semibold tracking-[-0.02em]">{info.title}</h3>
    <p className="mt-2 text-[12.5px] leading-[1.75] text-muted">{info.what}</p>
    <ul className="mt-3 grid gap-1.5 text-[12px] leading-relaxed text-muted">{info.points.map((p) => <li key={p} className="flex gap-2"><span aria-hidden="true">·</span><span>{p}</span></li>)}</ul>
    <p className="mt-3 text-[11.5px] leading-relaxed text-muted">A web page cannot reach other windows, your keyboard outside the tab or other programs, so this one lives in the app. Everything else on this website works the same as in the app.</p>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <a href={SUITE.study.directUrl} data-testid="desktop-only-download" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-80"><Download size={14} aria-hidden="true" />Download for Windows</a>
      <a href={SUITE.study.downloadsUrl} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink">All downloads<ExternalLink size={13} aria-hidden="true" /></a>
    </div>
  </section>;
}
