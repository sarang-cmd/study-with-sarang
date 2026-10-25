import { BarChart3, Download, FileDown, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { downloadFile, stamp } from '../lib/browser';
import { sectionNo } from '../lib/prefs';
import { dayStats, envelopeSessions, focusStreak, formatDuration, localDay, sessionsToCsv, taskTotals } from '../lib/tracking';

const weekday = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function LegacyHeatmap({ stats }: { stats: Map<string, number> }) {
  const weeks = 16;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = new Date(today); start.setDate(start.getDate() - mondayOffset - (weeks - 1) * 7);
  const cells: { day: string; seconds: number; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: { day: string; seconds: number; future: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start); date.setDate(start.getDate() + w * 7 + d);
      const key = localDay(date);
      column.push({ day: key, seconds: stats.get(key) ?? 0, future: date > today });
    }
    cells.push(column);
  }
  const level = (seconds: number) => seconds <= 0 ? 0 : seconds < 25 * 60 ? 1 : seconds < 60 * 60 ? 2 : seconds < 120 * 60 ? 3 : 4;
  const shade = ['rgb(var(--raised))', 'rgb(var(--ink) / .22)', 'rgb(var(--ink) / .42)', 'rgb(var(--ink) / .68)', 'rgb(var(--ink))'];
  return <div className="overflow-x-auto pb-1"><div className="flex min-w-max gap-[3px]" role="img" aria-label="Focus time per day over the last sixteen weeks">
    {cells.map((column, w) => <div key={w} className="flex flex-col gap-[3px]">{column.map((cell) => <span key={cell.day} title={cell.future ? '' : `${dayLabel(cell.day)}: ${cell.seconds ? formatDuration(cell.seconds) : 'no focus'}`}
      className="block h-[13px] w-[13px] rounded-[3px] border border-line/60" style={{ background: cell.future ? 'transparent' : shade[level(cell.seconds)], opacity: cell.future ? .25 : 1 }} />)}</div>)}
  </div>
    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted"><span>Less</span>{shade.map((color, i) => <span key={i} className="block h-[11px] w-[11px] rounded-[3px] border border-line/60" style={{ background: color }} />)}<span>More</span></div></div>;
}

export function TimeTrackingLegacy() {
  const { sessions, deleteSession, clearSessions } = useTimer();
  const { listening } = useSound();
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [showAll, setShowAll] = useState(false);
  const stats = useMemo(() => dayStats(sessions, listening, range), [sessions, listening, range]);
  const longStats = useMemo(() => dayStats(sessions, listening, 16 * 7 + 6), [sessions, listening]);
  const heat = useMemo(() => new Map(longStats.map((stat) => [stat.day, stat.focusSeconds])), [longStats]);
  const week = useMemo(() => dayStats(sessions, listening, 7), [sessions, listening]);
  const totals = useMemo(() => taskTotals(sessions).slice(0, 6), [sessions]);
  const todayStat = stats[stats.length - 1];
  const weekFocus = week.reduce((sum, d) => sum + d.focusSeconds, 0);
  const allFocus = sessions.reduce((sum, s) => sum + s.seconds, 0);
  const bestDay = Math.max(0, ...longStats.map((d) => d.focusSeconds));
  const maxBar = Math.max(1, ...stats.map((d) => Math.max(d.focusSeconds, d.listenSeconds)));
  const streak = focusStreak(sessions);
  const visible = showAll ? sessions.slice(0, 200) : sessions.slice(0, 8);

  const card = (label: string, value: string, sub?: string) => <div className="rounded-xl border border-line bg-canvas p-4"><p className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</p><p className="mt-1.5 text-[22px] font-semibold tracking-tight tabular-nums">{value}</p>{sub && <p className="mt-0.5 text-[10px] text-muted">{sub}</p>}</div>;

  return <section id="tracking" aria-labelledby="tracking-heading" className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="section-label mb-3">{sectionNo('05')}Time tracking</p><h2 id="tracking-heading" className="text-[26px] font-semibold leading-tight tracking-tight">See where the hours go.</h2>
        <p className="mt-2 max-w-[560px] text-[12px] leading-relaxed text-muted">Focus time comes from your timer sessions. Listening time counts while sound plays. Both stay in this browser, grouped by your local day.</p></div>
      <BarChart3 size={23} className="shrink-0 text-muted" />
    </div>

    <div className="mt-6 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
      {card('Today', formatDuration(todayStat.focusSeconds, true), `${todayStat.sessions} ${todayStat.sessions === 1 ? 'session' : 'sessions'}`)}
      {card('Listening today', formatDuration(todayStat.listenSeconds, true))}
      {card('Last 7 days', formatDuration(weekFocus, true), `${formatDuration(weekFocus / 7, true)} per day`)}
      {card('Streak', `${streak} ${streak === 1 ? 'day' : 'days'}`, 'days in a row with a session')}
      {card('Best day', formatDuration(bestDay, true), 'last 16 weeks')}
      {card('All time', formatDuration(allFocus, true), `${sessions.length} sessions`)}
    </div>

    <div className="mt-7 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <div className="rounded-xl border border-line bg-canvas p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[14px] font-semibold tracking-tight">Daily time</h3>
          <div className="flex gap-1" role="group" aria-label="Chart range">{([7, 14, 30] as const).map((value) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${range === value ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink'}`}>{value} days</button>)}</div></div>
        <div className="mt-5 flex h-[150px] items-end gap-[3px] sm:gap-1.5" role="img" aria-label={`Focus and listening minutes for the last ${range} days`}>
          {stats.map((stat) => <div key={stat.day} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${dayLabel(stat.day)}: focus ${formatDuration(stat.focusSeconds)}, listening ${formatDuration(stat.listenSeconds)}`}>
            <div className="flex flex-1 items-end justify-center gap-px">
              <span className="block w-1/2 max-w-[14px] rounded-t-[3px] bg-ink" style={{ height: `${Math.max(stat.focusSeconds ? 3 : 0, stat.focusSeconds / maxBar * 100)}%` }} />
              <span className="block w-1/2 max-w-[14px] rounded-t-[3px] bg-faint/60" style={{ height: `${Math.max(stat.listenSeconds ? 3 : 0, stat.listenSeconds / maxBar * 100)}%` }} />
            </div>
            <span className="mt-1.5 truncate text-center font-mono text-[9px] text-muted">{range <= 14 ? weekday(stat.day) : stat.day.slice(8)}</span>
          </div>)}
        </div>
        <div className="mt-3 flex gap-4 text-[10px] text-muted"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-ink" /> Focus</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-faint/60" /> Listening</span></div>
      </div>
      <div className="rounded-xl border border-line bg-canvas p-4 sm:p-5">
        <h3 className="text-[14px] font-semibold tracking-tight">By label</h3>
        {totals.length ? <ul className="mt-3 space-y-3">{totals.map((entry) => <li key={entry.task}><div className="flex items-center justify-between gap-2 text-[11px]"><span className="min-w-0 truncate font-semibold">{entry.task}</span><span className="shrink-0 font-mono text-[10px] text-muted">{formatDuration(entry.seconds, true)}</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-ink" style={{ width: `${entry.seconds / totals[0].seconds * 100}%` }} /></div></li>)}</ul>
          : <p className="mt-3 text-[12px] leading-relaxed text-muted">Give your sessions a label in the timer and your time will be grouped here.</p>}
      </div>
    </div>

    <div className="mt-5 rounded-xl border border-line bg-canvas p-4 sm:p-5">
      <h3 className="text-[14px] font-semibold tracking-tight">Activity <span className="ml-1 font-mono text-[10px] font-normal text-muted">last 16 weeks</span></h3>
      <div className="mt-4"><LegacyHeatmap stats={heat} /></div>
    </div>

    <div className="mt-5 rounded-xl border border-line bg-canvas p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[14px] font-semibold tracking-tight">Session log <span className="ml-1 font-mono text-[10px] font-normal text-muted">{sessions.length}</span></h3>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" disabled={!sessions.length} onClick={() => downloadFile(`study-with-sarang-sessions-${stamp()}.csv`, sessionsToCsv(sessions), 'text/csv')} className="studio-button"><FileDown size={13} /> CSV</button>
          <button type="button" disabled={!sessions.length} onClick={() => downloadFile(`study-with-sarang-sessions-${stamp()}.json`, JSON.stringify(envelopeSessions(sessions), null, 2))} className="studio-button"><Download size={13} /> JSON</button>
          <button type="button" disabled={!sessions.length} onClick={() => { if (window.confirm('Delete your whole session log? This cannot be undone.')) clearSessions(); }} className="studio-button"><Trash2 size={13} /> Clear</button>
        </div></div>
      {sessions.length ? <>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] border-collapse text-left text-[11px]"><thead><tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-muted"><th className="py-2 pr-3 font-semibold">When</th><th className="py-2 pr-3 font-semibold">Length</th><th className="py-2 pr-3 font-semibold">Label</th><th className="py-2 pr-3 font-semibold">Drifts</th><th className="py-2 pr-3 font-semibold">Sound</th><th className="w-8" /></tr></thead>
          <tbody>{visible.map((s) => <tr key={s.id} className="border-b border-line/70 last:border-0"><td className="py-2.5 pr-3 tabular-nums">{new Date(s.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
            <td className="py-2.5 pr-3 font-semibold tabular-nums">{formatDuration(s.seconds, true)}{!s.completed && <span className="ml-1 font-normal text-muted">stopped</span>}</td><td className="max-w-[160px] truncate py-2.5 pr-3">{s.task || <span className="text-faint">No label</span>}</td>
            <td className="py-2.5 pr-3 tabular-nums">{s.distractions}{s.tabAways ? <span className="text-muted"> +{s.tabAways} tab</span> : ''}</td><td className="max-w-[120px] truncate py-2.5 pr-3 text-muted">{s.mixName || 'None'}</td>
            <td className="py-2.5 text-right"><button type="button" onClick={() => deleteSession(s.id)} aria-label="Delete this session" data-tip="Delete" className="text-muted hover:text-ink"><Trash2 size={12} /></button></td></tr>)}</tbody></table></div>
        {sessions.length > 8 && <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-3 text-[11px] font-semibold underline underline-offset-4">{showAll ? 'Show fewer' : `Show more (${Math.min(sessions.length, 200)})`}</button>}
      </> : <p className="mt-4 rounded-lg border border-dashed border-line p-6 text-center text-[12px] leading-relaxed text-muted">No sessions yet. Start the timer and your focus blocks will be logged here.</p>}
    </div>
  </section>;
}
