import { ArrowDownRight, ArrowUpRight, BarChart3, Download, FileDown, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { downloadFile, stamp } from '../lib/browser';
import { goalDays, hourBuckets, monthTotal, peakWindow, recent, sessionAverages, topMixes, weekOverWeek, weekdayTotals, completionRate, distractionsPerHour } from '../lib/insights';
import { YearHeatmap } from './YearHeatmap';
import { sectionNo } from '../lib/prefs';
import { dayStats, envelopeSessions, focusStreak, formatDuration, sessionsToCsv, taskTotals } from '../lib/tracking';

const weekday = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const weekdayName = (index: number) => new Date(2024, 0, 1 + index).toLocaleDateString(undefined, { weekday: 'short' }); // 1 Jan 2024 was a Monday
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function Tile({ title, note, className = '', children, action }: { title: string; note?: string; className?: string; children: ReactNode; action?: ReactNode }) {
  return <div className={`min-w-0 rounded-xl border border-line bg-canvas p-4 sm:p-5 ${className}`}>
    <div className="flex items-start justify-between gap-2"><h3 className="text-[14px] font-semibold tracking-tight">{title}{note && <span className="ml-1.5 font-mono text-[10px] font-normal text-muted">{note}</span>}</h3>{action}</div>
    {children}
  </div>;
}

export function Stat({ label, value, sub, className = '', trend }: { label: string; value: ReactNode; sub?: ReactNode; className?: string; trend?: number | null }) {
  return <div className={`min-w-0 rounded-xl border border-line bg-canvas p-4 ${className}`}>
    <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</p>
    <p className="mt-1.5 whitespace-nowrap text-[22px] font-semibold tracking-tight tabular-nums">{value}</p>
    {(sub || (trend !== undefined && trend !== null)) && <p className="mt-0.5 text-[11px] leading-snug text-muted">
      {trend !== undefined && trend !== null && <span className={`mr-1.5 inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold ${trend >= 0 ? 'text-ink' : ''}`}>{trend >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(trend)}%</span>}{sub}</p>}
  </div>;
}

function Ring({ value, size = 84 }: { value: number; size?: number }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(v * 100)} percent of today's goal`}>
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--raised))" strokeWidth="7" />
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--ink))" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray .5s ease' }} />
    <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-current font-mono text-[13px] font-semibold">{Math.round(v * 100)}%</text>
  </svg>;
}

const Bars = ({ values, labels, format, highlight }: { values: number[]; labels: string[]; format: (v: number) => string; highlight?: number }) => {
  const max = Math.max(1, ...values);
  return <div className="mt-4 flex h-[120px] items-end gap-1.5" role="img" aria-label={labels.map((l, i) => `${l} ${format(values[i])}`).join(', ')}>
    {values.map((value, i) => <div key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${labels[i]}: ${format(value)}`}>
      <div className="flex flex-1 items-end"><span className={`block w-full rounded-t-[3px] ${highlight === i ? 'bg-ink' : 'bg-ink/55'}`} style={{ height: `${Math.max(value ? 4 : 0, (value / max) * 100)}%` }} /></div>
      <span className="mt-1.5 truncate text-center font-mono text-[9px] text-muted">{labels[i]}</span>
    </div>)}
  </div>;
};

export function TimeTracking() {
  const { sessions, deleteSession, clearSessions, settings } = useTimer();
  const { listening } = useSound();
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [span, setSpan] = useState<30 | 90 | 365>(90); // how far back the habit tiles look
  const [showAll, setShowAll] = useState(false);
  const stats = useMemo(() => dayStats(sessions, listening, range), [sessions, listening, range]);
  const long = useMemo(() => dayStats(sessions, listening, 53 * 7 + 6), [sessions, listening]);
  const today = stats[stats.length - 1];
  const week = useMemo(() => weekOverWeek(sessions), [sessions]);
  const allFocus = useMemo(() => sessions.reduce((sum, s) => sum + s.seconds, 0), [sessions]);
  const bestDay = Math.max(0, ...long.map((d) => d.focusSeconds));
  const streak = focusStreak(sessions);
  const goalMin = settings.dailyGoalMin;
  const goal = useMemo(() => goalDays(sessions, goalMin, 30), [sessions, goalMin]);
  const month = useMemo(() => monthTotal(sessions), [sessions]);
  const windowed = useMemo(() => recent(sessions, span), [sessions, span]);
  const weekdays = useMemo(() => weekdayTotals(sessions, span), [sessions, span]);
  const hours = useMemo(() => hourBuckets(sessions, span), [sessions, span]);
  const peak = peakWindow(hours);
  const mixes = useMemo(() => topMixes(windowed, 5), [windowed]);
  const averages = useMemo(() => sessionAverages(windowed), [windowed]);
  const completion = completionRate(windowed);
  const driftRate = distractionsPerHour(windowed);
  const labels = useMemo(() => taskTotals(windowed).slice(0, 6), [windowed]);
  const maxBar = Math.max(1, ...stats.map((d) => Math.max(d.focusSeconds, d.listenSeconds)));
  const bestWeekday = weekdays.reduce((best, d) => (d.seconds > best.seconds ? d : best), weekdays[0]);
  const perWeekday = weekdays.map((d) => (d.days ? d.seconds / d.days : 0));
  const visible = showAll ? sessions.slice(0, 200) : sessions.slice(0, 8);
  const goalShare = goalMin > 0 ? today.focusSeconds / (goalMin * 60) : 0;
  const rangeButtons = <div className="flex gap-1" role="group" aria-label="Look back">{([30, 90, 365] as const).map((value) => <button key={value} type="button" aria-pressed={span === value} onClick={() => setSpan(value)}
    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${span === value ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>{value === 365 ? '1 year' : `${value} days`}</button>)}</div>;

  return <section id="tracking" aria-labelledby="tracking-heading" className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="section-label mb-3">{sectionNo('05')}Progress</p><h2 id="tracking-heading" className="text-[26px] font-semibold leading-tight tracking-tight">See where the hours go.</h2>
        <p className="mt-2 max-w-[560px] text-[12px] leading-relaxed text-muted">Focus time comes from your timer sessions. Listening time counts while sound plays. Everything stays on this device, grouped by your local day.</p></div>
      <div className="flex items-center gap-3"><div className="hidden items-center gap-1.5 sm:flex">{rangeButtons}</div><BarChart3 size={23} className="shrink-0 text-muted" /></div>
    </div>
    <div className="mt-3 flex sm:hidden">{rangeButtons}</div>

    <div className="mt-6 grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
      <Stat label="Today" value={formatDuration(today.focusSeconds, true)} sub={`${today.sessions} ${today.sessions === 1 ? 'session' : 'sessions'}`} />
      <Stat label="Listening today" value={formatDuration(today.listenSeconds, true)} sub="sound playing" />
      <Stat label="Last 7 days" value={formatDuration(week.thisWeek, true)} trend={week.changePct} sub={week.lastWeek ? `${formatDuration(week.lastWeek, true)} the week before` : `${formatDuration(week.thisWeek / 7, true)} per day`} />
      <Stat label="Streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} sub="days in a row with a session" />
      <Stat label="This month" value={formatDuration(month.seconds, true)} sub={`${month.activeDays} of ${month.daysSoFar} days active`} />
      <Stat label="All time" value={formatDuration(allFocus, true)} sub={`${sessions.length} sessions, best day ${formatDuration(bestDay, true)}`} />
    </div>

    <div className="mt-3 grid gap-3 lg:grid-cols-12">
      <Tile className="lg:col-span-8" title="Daily time" action={<div className="flex gap-1" role="group" aria-label="Chart range">{([7, 14, 30] as const).map((value) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)}
        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${range === value ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>{value} days</button>)}</div>}>
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
      </Tile>
      <Tile className="lg:col-span-4" title="Daily goal" note={goalMin ? formatDuration(goalMin * 60, true) : 'off'}>
        {goalMin > 0 ? <>
          <div className="mt-4 flex items-center gap-5"><Ring value={goalShare} />
            <div className="min-w-0 text-[12px] leading-relaxed text-muted">
              <p><strong className="text-ink">{formatDuration(today.focusSeconds, true)}</strong> of {formatDuration(goalMin * 60, true)} today</p>
              <p>{goalShare >= 1 ? 'Goal reached.' : `${formatDuration(goalMin * 60 - today.focusSeconds, true)} to go.`}</p>
            </div></div>
          <dl className="mt-5 grid grid-cols-2 gap-2 border-t border-line pt-4 text-[11px]">
            <div><dt className="font-mono text-[10px] uppercase tracking-wider text-muted">Goal days</dt><dd className="mt-1 text-[16px] font-semibold tabular-nums">{goal.hit} <span className="text-[11px] font-normal text-muted">of {goal.of}</span></dd></div>
            <div><dt className="font-mono text-[10px] uppercase tracking-wider text-muted">Goal streak</dt><dd className="mt-1 text-[16px] font-semibold tabular-nums">{goal.streak} <span className="text-[11px] font-normal text-muted">{goal.streak === 1 ? 'day' : 'days'}</span></dd></div>
          </dl></>
          : <p className="mt-3 text-[12px] leading-relaxed text-muted">No daily goal is set. Choose one in the timer settings and your progress shows up here.</p>}
      </Tile>

      <Tile className="lg:col-span-12" title="Activity" note="pick a year or a subject">
        <div className="mt-4"><YearHeatmap /></div>
      </Tile>

      <Tile className="lg:col-span-4" title="By weekday" note={`average, last ${span === 365 ? 'year' : `${span} days`}`}>
        <Bars values={perWeekday} labels={weekdays.map((d) => weekdayName(d.index))} format={(v) => formatDuration(v, true)} highlight={bestWeekday.seconds ? bestWeekday.index : undefined} />
        <p className="mt-2 text-[11px] text-muted">{bestWeekday.seconds ? `${weekdayName(bestWeekday.index)} is your strongest day.` : 'Not enough sessions yet.'}</p>
      </Tile>
      <Tile className="lg:col-span-4" title="Time of day" note="when you start">
        <div className="mt-4 flex h-[120px] items-end gap-[2px]" role="img" aria-label="Focus time by starting hour">
          {hours.map((value, h) => <span key={h} title={`${hourLabel(h)}: ${formatDuration(value)}`} className="block min-w-0 flex-1 rounded-t-[2px] bg-ink/60" style={{ height: `${Math.max(value ? 4 : 1, (value / Math.max(1, ...hours)) * 100)}%`, opacity: value ? 1 : 0.25 }} />)}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[9px] text-muted"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
        <p className="mt-2 text-[11px] text-muted">{peak ? `Peak window ${hourLabel(peak[0])} to ${hourLabel(peak[1])}.` : 'Not enough sessions yet.'}</p>
      </Tile>
      <Tile className="lg:col-span-4" title="Top sounds" note="by focus time">
        {mixes.length ? <ul className="mt-3 space-y-3">{mixes.map((entry) => <li key={entry.name}><div className="flex items-center justify-between gap-2 text-[11px]"><span className="min-w-0 truncate font-semibold">{entry.name}</span><span className="shrink-0 font-mono text-[10px] text-muted">{formatDuration(entry.seconds, true)} · {entry.sessions}</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-ink" style={{ width: `${(entry.seconds / mixes[0].seconds) * 100}%` }} /></div></li>)}</ul>
          : <p className="mt-3 text-[12px] leading-relaxed text-muted">Sessions remember which mix was playing, and the favorites appear here.</p>}
      </Tile>

      <Tile className="lg:col-span-5" title="Session quality" note={span === 365 ? 'last year' : `last ${span} days`}>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          {([
            ['Average session', averages.count ? formatDuration(averages.avgSeconds, true) : '-'],
            ['Median', averages.count ? formatDuration(averages.medianSeconds, true) : '-'],
            ['Longest', averages.count ? formatDuration(averages.longestSeconds, true) : '-'],
            ['Completed', completion === null ? '-' : `${Math.round(completion * 100)}%`],
            ['Drifts per hour', driftRate === null ? '-' : String(driftRate)],
            ['Sessions', String(averages.count)],
          ] as const).map(([label, value]) => <div key={label}><dt className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</dt><dd className="mt-1 text-[18px] font-semibold tracking-tight tabular-nums">{value}</dd></div>)}
        </dl>
        <p className="mt-4 text-[11px] leading-relaxed text-muted">Completed means the timer ran to its end. Drifts are the distractions you marked with the I drifted button.</p>
      </Tile>
      <Tile className="lg:col-span-7" title="By label" note={span === 365 ? 'last year' : `last ${span} days`}>
        {labels.length ? <ul className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">{labels.map((entry) => <li key={entry.task}><div className="flex items-center justify-between gap-2 text-[11px]"><span className="min-w-0 truncate font-semibold">{entry.task}</span><span className="shrink-0 font-mono text-[10px] text-muted">{formatDuration(entry.seconds, true)} · {entry.sessions}</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-ink" style={{ width: `${(entry.seconds / labels[0].seconds) * 100}%` }} /></div></li>)}</ul>
          : <p className="mt-3 text-[12px] leading-relaxed text-muted">Give your sessions a label in the timer and your time will be grouped here.</p>}
      </Tile>

      <Tile className="lg:col-span-12" title="Session log" note={String(sessions.length)} action={<div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={!sessions.length} onClick={() => downloadFile(`study-with-sarang-sessions-${stamp()}.csv`, sessionsToCsv(sessions), 'text/csv')} className="studio-button"><FileDown size={13} /> CSV</button>
        <button type="button" disabled={!sessions.length} onClick={() => downloadFile(`study-with-sarang-sessions-${stamp()}.json`, JSON.stringify(envelopeSessions(sessions), null, 2))} className="studio-button"><Download size={13} /> JSON</button>
        <button type="button" disabled={!sessions.length} onClick={() => { if (window.confirm('Delete your whole session log? This cannot be undone.')) clearSessions(); }} className="studio-button"><Trash2 size={13} /> Clear</button>
      </div>}>
        {sessions.length ? <>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] border-collapse text-left text-[11px]"><thead><tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-muted"><th className="py-2 pr-3 font-semibold">When</th><th className="py-2 pr-3 font-semibold">Length</th><th className="py-2 pr-3 font-semibold">Label</th><th className="py-2 pr-3 font-semibold">Drifts</th><th className="py-2 pr-3 font-semibold">Sound</th><th className="py-2" /></tr></thead>
            <tbody>{visible.map((s) => <tr key={s.id} className="border-b border-line/70 last:border-0"><td className="py-2.5 pr-3 tabular-nums">{new Date(s.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
              <td className="py-2.5 pr-3 font-semibold tabular-nums">{formatDuration(s.seconds, true)}{!s.completed && <span className="ml-1 font-normal text-muted">stopped</span>}</td><td className="max-w-[160px] truncate py-2.5 pr-3">{s.task || <span className="text-faint">No label</span>}</td>
              <td className="py-2.5 pr-3 tabular-nums">{s.distractions}{s.tabAways ? <span className="text-muted"> +{s.tabAways} tab</span> : ''}</td><td className="max-w-[120px] truncate py-2.5 pr-3 text-muted">{s.mixName || 'None'}</td>
              <td className="py-2.5 text-right"><button type="button" onClick={() => deleteSession(s.id)} aria-label="Delete this session" data-tip="Delete" className="text-muted hover:text-ink"><Trash2 size={12} /></button></td></tr>)}</tbody></table></div>
          {sessions.length > 8 && <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-3 text-[11px] font-semibold underline underline-offset-4">{showAll ? 'Show fewer' : `Show more (${Math.min(sessions.length, 200)})`}</button>}
        </> : <p className="mt-4 rounded-lg border border-dashed border-line p-6 text-center text-[12px] leading-relaxed text-muted">No sessions yet. Start the timer and your focus blocks will be logged here.</p>}
      </Tile>
    </div>
  </section>;
}
