import { useMemo, useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { defaultHeatView, HEAT_METRICS, heatValues, heatViews, yearLayout, type HeatMetric, type HeatView } from '../lib/stats';
import { activeSubjects, subjectLabel, useProfile } from '../lib/subjects';
import { formatDuration, localDay } from '../lib/tracking';

const SHADE = ['rgb(var(--raised))', 'rgb(var(--ink) / .22)', 'rgb(var(--ink) / .42)', 'rgb(var(--ink) / .68)', 'rgb(var(--ink))'];
const GAP = 3, LABELS = 30, MIN_CELL = 11;
const dayName = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const short = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const weekdayName = (index: number) => new Date(2024, 0, 1 + index).toLocaleDateString(undefined, { weekday: 'short' });
const shiftDay = (key: string, n: number) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return localDay(d); };

function format(metric: HeatMetric, value: number): string {
  if (metric === 'time' || metric === 'listen') return value ? formatDuration(value, true) : 'none';
  const unit = HEAT_METRICS.find((m) => m.id === metric)!.unit; return `${value} ${unit}`;
}

/** A GitHub-style activity map: pick a year (or the last 12 months), what to measure and, optionally, one subject. Click a day or move with the arrow keys for its details. */
export function YearHeatmap() {
  const { sessions } = useTimer(); const { listening } = useSound(); const profile = useProfile(); const reduce = useReducedMotion();
  const views = useMemo(() => heatViews(sessions), [sessions]);
  const [view, setView] = useState<HeatView>(() => defaultHeatView(sessions));
  const [metric, setMetric] = useState<HeatMetric>('time');
  const [subject, setSubject] = useState('');
  const [picked, setPicked] = useState<string>('');
  const scoped = useMemo(() => (subject ? sessions.filter((s) => s.subject === subject) : sessions), [sessions, subject]);
  const values = useMemo(() => heatValues(scoped, listening, metric), [scoped, listening, metric]);
  const layout = useMemo(() => yearLayout(values, view), [values, view]);
  const weeks = layout.columns.length;
  const minWidth = LABELS + weeks * (MIN_CELL + GAP);
  const today = localDay(new Date());
  const selected = picked || (view === 'rolling' || view === new Date().getFullYear() ? today : `${view}-01-01`);
  const dayRows = useMemo(() => scoped.filter((s) => localDay(new Date(s.startedAt)) === selected).sort((a, b) => a.startedAt.localeCompare(b.startedAt)), [scoped, selected]);
  const dayTotal = values.get(selected) ?? 0;
  const subjects = activeSubjects(profile);
  const total = metric === 'time' || metric === 'listen' ? formatDuration(layout.total, true) : String(layout.total);
  const title = view === 'rolling' ? 'in the last 12 months' : `in ${view}`;
  const onKey = (event: KeyboardEvent) => {
    const step = event.key === 'ArrowLeft' ? -7 : event.key === 'ArrowRight' ? 7 : event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0; if (!step) return;
    event.preventDefault(); const next = shiftDay(selected, step); if (next >= layout.start && next <= layout.end) setPicked(next);
  };
  return <div data-testid="year-heatmap">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[12px] text-muted" aria-live="polite"><strong className="text-[15px] text-ink tabular-nums" data-testid="heat-total">{total}</strong> {metric === 'time' ? 'focus' : metric === 'listen' ? 'listening' : HEAT_METRICS.find((m) => m.id === metric)!.unit} {title} · <span className="tabular-nums">{layout.activeDays}</span> active days</p>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="What the map shows" value={metric} onChange={(e) => setMetric(e.target.value as HeatMetric)} className="rounded-lg border border-line bg-canvas px-2 py-1 text-[11px]">{HEAT_METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
        <select aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="max-w-[160px] rounded-lg border border-line bg-canvas px-2 py-1 text-[11px]">
          <option value="">All subjects</option>{subjects.map((u) => <option key={u.id} value={u.id}>{subjectLabel(u.id, profile)}</option>)}
        </select>
      </div>
    </div>
    <div className="mt-3 flex flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="overflow-x-auto pb-1">
          <div style={{ minWidth }} tabIndex={0} role="application" aria-label={`Activity map ${title}. Use the arrow keys to move between days.`} onKeyDown={onKey} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ink/40">
            <div className="grid" style={{ gridTemplateColumns: `${LABELS}px 1fr` }}>
              <span />
              <div className="relative mb-1 h-3" aria-hidden="true">{layout.months.map((m) => <span key={m.index} className="absolute font-mono text-[9px] text-muted" style={{ left: `${(m.index / weeks) * 100}%` }}>{m.label}</span>)}</div>
              <div className="grid grid-rows-7 pr-1 font-mono text-[9px] text-muted" style={{ rowGap: GAP }} aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map((d) => <span key={d} className="flex items-center">{d % 2 === 0 ? weekdayName(d) : ''}</span>)}</div>
              <div data-testid="heat-grid" data-view={String(view)} data-weeks={weeks} className="grid w-full" style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, auto)', gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, gap: GAP }}>
                {layout.columns.flatMap((col, ci) => col.map((cell) => cell.outside
                  ? <span key={cell.day} aria-hidden="true" className="block w-full" style={{ aspectRatio: '1' }} />
                  : <motion.button key={cell.day} type="button" tabIndex={-1} data-day={cell.day} data-level={cell.level} aria-label={`${short(cell.day)}: ${format(metric, cell.value)}`} title={cell.future ? '' : `${short(cell.day)}: ${format(metric, cell.value)}`}
                    onClick={() => setPicked(cell.day)} initial={reduce ? false : { opacity: 0, scale: 0.4 }} animate={{ opacity: cell.future ? 0.25 : 1, scale: 1 }} transition={{ delay: reduce ? 0 : Math.min(0.5, ci * 0.006), duration: 0.22 }}
                    className={`block w-full rounded-[3px] border ${selected === cell.day ? 'border-ink ring-1 ring-ink' : 'border-line/60'}`} style={{ aspectRatio: '1', background: cell.future ? 'transparent' : SHADE[cell.level] }} />))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-muted">
          <span>Shades compare each day with your other active days.</span>
          <span className="flex items-center gap-1.5">Less{SHADE.map((c, i) => <span key={i} className="block h-[11px] w-[11px] rounded-[3px] border border-line" style={{ background: c }} />)}More</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-row gap-1.5 overflow-x-auto lg:w-[116px] lg:flex-col lg:overflow-visible" role="group" aria-label="Year">
        {views.map((v) => <button key={String(v.id)} type="button" aria-pressed={view === v.id} data-view-button={String(v.id)} onClick={() => { setView(v.id); setPicked(''); }}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-left text-[11px] font-semibold transition-colors ${view === v.id ? 'bg-ink text-canvas' : 'text-muted hover:bg-raised hover:text-ink'}`}>{v.label}</button>)}
      </div>
    </div>
    <div className="mt-4 rounded-xl border border-line bg-surface p-3.5" data-testid="heat-day" aria-live="polite">
      <p className="text-[12px] font-semibold">{dayName(selected)}</p>
      <p className="mt-0.5 text-[11px] text-muted">{format(metric, dayTotal)}{subject ? ` · ${subjectLabel(subject, profile)}` : ''}</p>
      {dayRows.length ? <ul className="mt-2 space-y-1">{dayRows.map((s) => <li key={s.id} className="flex flex-wrap items-center gap-x-2 text-[11px]">
        <span className="font-mono tabular-nums text-muted">{new Date(s.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="font-semibold tabular-nums">{formatDuration(s.seconds, true)}</span>
        {s.subject && <span className="rounded-full border border-line px-1.5 text-[10px]">{subjectLabel(s.subject, profile)}</span>}
        {s.task && <span className="min-w-0 truncate text-muted">{s.task}</span>}
        {s.goal && <span className="min-w-0 truncate text-muted">goal: {s.goal}{s.goalMet === 'yes' ? ' (reached)' : s.goalMet === 'no' ? ' (not yet)' : ''}</span>}
      </li>)}</ul> : <p className="mt-2 text-[11px] text-muted">No sessions on this day.</p>}
    </div>
  </div>;
}
