import { CalendarPlus, Copy, Download, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, Num, Toggle, copyText } from '../desktop/shared';
import { useTimer } from '../../context/TimerContext';
import { downloadFile } from '../../lib/browser';
import { googleAddUrl, sanitizeCalendar, type CalendarSettings } from '../../lib/calendar';
import { calendarText, currentFeedUrl, newLink, stopSharing, syncFeed, useFeedState } from '../../lib/calendarFeed';
import { CLOUD_EVENT, isSignedIn } from '../../lib/cloud';
import { setPrefs, usePrefs } from '../../lib/prefs';
import { notify } from '../ui/toast';

const inp = 'field !min-h-9 text-[12px]';
const lab = 'grid gap-1 text-[11px] font-semibold';

export function CalendarTab() {
  const [prefs] = usePrefs();
  const timer = useTimer();
  const feed = useFeedState();
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); window.addEventListener(CLOUD_EVENT, f); return () => window.removeEventListener(CLOUD_EVENT, f); }, []);
  const c = prefs.calendar;
  const set = (patch: Partial<CalendarSettings>) => setPrefs({ calendar: sanitizeCalendar({ ...c, ...patch }) });
  const signed = isSignedIn();
  const url = currentFeedUrl();
  const sample = calendarText(timer.sessions, c);
  const count = (sample.match(/BEGIN:VEVENT/g) ?? []).length;
  const download = () => { downloadFile('study-with-sarang.ics', sample, 'text/calendar'); notify({ message: `Saved ${count} event${count === 1 ? '' : 's'}. Open the file, or import it in your calendar app.`, variant: 'success', id: 'cal-dl' }); };

  return <div className="grid gap-5">
    <Card title="Your study blocks in your calendar" hint="Every finished block can appear in Google Calendar, Apple Calendar, Outlook or any app that reads calendar files. Nothing is shared unless you turn it on, and you choose what the events say.">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lab}>Event title
          <select className={inp} value={c.title} onChange={(e) => set({ title: e.target.value as CalendarSettings['title'] })} aria-label="Event title" data-testid="cal-title">
            <option value="subject">Studied Physics HL (the subject)</option><option value="generic">Study block (no subject)</option></select></label>
        <label className={lab}>Leave out blocks shorter than (minutes)
          <Num min={1} max={120} value={c.minMinutes} onChange={(minMinutes) => set({ minMinutes })} data-testid="cal-min" /></label>
        <label className={lab}>Reach back this many days
          <Num min={7} max={365} value={c.days} onChange={(days) => set({ days })} /></label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Toggle label="Add my goal" hint="The goal you set for the block, and whether you reached it." checked={c.includeGoal} onChange={(includeGoal) => set({ includeGoal })} />
        <Toggle label="Add the task name" checked={c.includeTask} onChange={(includeTask) => set({ includeTask })} />
        <Toggle label="Add distractions and sound" checked={c.includeStats} onChange={(includeStats) => set({ includeStats })} />
        <Toggle label="Add my exam date" hint="An all-day event from Subjects and exams." checked={c.exams} onChange={(exams) => set({ exams })} />
        <Toggle label="Show as busy" hint="Off: blocks show as free time, so they never get in the way of invitations." checked={c.busy} onChange={(busy) => set({ busy })} />
      </div>
      <p className="mt-3 text-[11px] text-muted" data-testid="cal-count">{count === 0 ? 'No blocks fit these settings yet.' : `${count} event${count === 1 ? '' : 's'} right now.`}</p>
      <div className="mt-3"><button type="button" className="studio-button !min-h-9 inline-flex items-center gap-2" onClick={download} data-testid="cal-download"><Download size={13} />Download a calendar file (.ics)</button>
        <p className="mt-2 text-[11px] text-muted">Works for everyone, no account needed. Import it once; it shows what you have studied so far.</p></div>
    </Card>

    <Card title="A private link that stays up to date" hint="Add this link to Google Calendar (or any calendar app) once. After that your new blocks appear on their own. The link is secret and unique to you, and you can replace or delete it any time.">
      {!signed ? <p className="rounded-lg border border-line px-3 py-2 text-[11px] text-muted" data-testid="cal-signin">The link is kept in your cloud account, so first sign in under Cloud sync. The file download above works without it.</p> : <>
        <Toggle label="Keep my private calendar link up to date" hint="After each finished block, the calendar text is saved to your account. Only the text above is stored, nothing else from your data." checked={c.enabled} onChange={(enabled) => { set({ enabled }); if (enabled) void syncFeed(timer.sessions, { ...c, enabled }, true); }} />
        {c.enabled && <div className="mt-3 grid gap-3">
          {feed.status === 'error' && <p role="alert" className="rounded-lg border border-ink px-3 py-2 text-[11px] font-semibold" data-testid="cal-error">{feed.message}</p>}
          {url ? <>
            <label className={lab}>Your private link
              <span className="flex gap-2"><input readOnly className={`${inp} font-mono`} value={url} aria-label="Private calendar link" data-testid="cal-url" onFocus={(e) => e.currentTarget.select()} />
                <button type="button" aria-label="Copy link" className="studio-button !min-h-9 !px-3" onClick={() => void copyText(url, () => notify({ message: 'Link copied.', variant: 'success', id: 'cal-copy' }))}><Copy size={13} /></button></span></label>
            <div className="flex flex-wrap gap-2">
              <a className="studio-button !min-h-9 inline-flex items-center gap-2" href={googleAddUrl(url)} target="_blank" rel="noreferrer noopener" data-testid="cal-google"><CalendarPlus size={13} />Add to Google Calendar</a>
              <button type="button" className="studio-button !min-h-9 inline-flex items-center gap-2" onClick={() => { void newLink(timer.sessions, c); }} data-testid="cal-rotate"><RefreshCw size={13} />Make a new link</button>
              <button type="button" className="studio-button !min-h-9 inline-flex items-center gap-2" onClick={() => { void stopSharing().then((ok) => { if (ok) set({ enabled: false }); }); }} data-testid="cal-stop"><Trash2 size={13} />Stop and delete</button>
            </div>
            <p className="text-[11px] leading-relaxed text-muted" data-testid="cal-updated">{feed.pushedAt ? `Saved to your account ${new Date(feed.pushedAt).toLocaleTimeString(undefined, { timeStyle: 'short' })}. ` : ''}Calendar apps refresh subscribed links on their own schedule: Apple and Outlook within about an hour, Google Calendar often only every 12 to 24 hours. A new block is saved at once, but your calendar may show it later. The file download above is instant.</p>
          </> : <p className="text-[11px] text-muted" data-testid="cal-working">{feed.status === 'error' ? '' : 'Making your link...'}</p>}
        </div>}
      </>}
    </Card>
  </div>;
}
