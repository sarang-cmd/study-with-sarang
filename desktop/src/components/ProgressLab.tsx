import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, GraduationCap, RotateCcw } from 'lucide-react';
import { useTimer } from '../context/TimerContext';
import { Stat, Tile } from './TimeTracking';
import { sectionNo } from '../lib/prefs';
import {
  consistency, cumulativeHours, defaultFilter, filterActive, filterSessions, goalRateByWeek, LENGTH_BUCKETS, lengthHistogram, monthlyTotals, NO_SUBJECT, rangeStart, records, sanitizeFilter,
  streakHistory, subjectStats, weekdayHourGrid, weeklyBySubject, type StatsFilter, type StatsRange,
} from '../lib/stats';
import { activeSubjects, countdownLabel, daysUntil, examDate, subjectLabel, subjectShort, useProfile } from '../lib/subjects';
import { formatDuration } from '../lib/tracking';
import { useSettings } from '../context/SettingsContext';

const KEY = 'study-with-sarang:stats-filter';
const load = (): StatsFilter => { try { return sanitizeFilter(JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch { return defaultFilter(); } };
const RANGES: { id: StatsRange; label: string }[] = [{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: '90', label: '90 days' }, { id: '365', label: '1 year' }, { id: 'all', label: 'All time' }];
const short = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const weekdayName = (i: number) => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'short' });
const SHADES = [1, 0.72, 0.5, 0.34, 0.22, 0.14];
const shadeOf = (rank: number) => `rgb(var(--ink) / ${SHADES[Math.min(rank, SHADES.length - 1)]})`;

const Chip = ({ on, onClick, children, testid }: { on: boolean; onClick: () => void; children: ReactNode; testid?: string }) =>
  <button type="button" aria-pressed={on} data-testid={testid} onClick={onClick} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${on ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>{children}</button>;

function Grow({ pct, className = 'bg-ink', delay = 0 }: { pct: number; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return <div className="h-1.5 overflow-hidden rounded-full bg-raised"><motion.div className={`h-full rounded-full ${className}`} initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }} transition={{ duration: 0.5, delay: reduce ? 0 : delay }} /></div>;
}

/** Counts up to a number when it changes. Respects reduced motion. */
function Count({ value, render }: { value: number; render: (n: number) => string }) {
  const reduce = useReducedMotion(); const [shown, setShown] = useState(value);
  useEffect(() => {
    if (reduce) { setShown(value); return; }
    let raf = 0; const from = shown, start = performance.now();
    const tick = (now: number) => { const t = Math.min(1, (now - start) / 600); setShown(from + (value - from) * (1 - Math.pow(1 - t, 3))); if (t < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);
  return <>{render(shown)}</>;
}

/** Exam countdown for the curriculum and session chosen in Settings. */
export function ExamCountdown() {
  const profile = useProfile(); const { sessions } = useTimer(); const { openSettings } = useSettings();
  const date = examDate(profile); const days = daysUntil(date);
  if (!date || days === null) return <Tile title="Exam countdown" action={<button type="button" className="studio-button" onClick={() => openSettings('subjects')}>Choose</button>}><p className="mt-3 text-[12px] leading-relaxed text-muted">Pick your programme and exam session in Settings and the countdown appears here. It is an estimate until you enter the exact date.</p></Tile>;
  const weeks = Math.max(1, Math.ceil(Math.max(0, days) / 7));
  const total = sessions.reduce((sum, s) => sum + s.seconds, 0);
  const weeklyTarget = activeSubjects(profile).reduce((sum, u) => sum + u.weeklyMin, 0);
  return <Tile title="Exam countdown" note={date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} action={<button type="button" className="studio-button" onClick={() => openSettings('subjects')}>Change</button>}>
    <p data-testid="exam-days" className="mt-3 text-[34px] font-semibold leading-none tracking-tight tabular-nums">{days < 0 ? 0 : days}<span className="ml-1.5 text-[13px] font-medium text-muted">days</span></p>
    <p className="mt-2 text-[12px] text-muted">{countdownLabel(days)}. About {profile.exam.date ? 'the exact' : 'the first'} day of the exam period.</p>
    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[11px]">
      <div><dt className="font-mono text-[10px] uppercase tracking-wider text-muted">Studied so far</dt><dd className="mt-1 text-[16px] font-semibold tabular-nums">{formatDuration(total, true)}</dd></div>
      <div><dt className="font-mono text-[10px] uppercase tracking-wider text-muted">Weeks left</dt><dd className="mt-1 text-[16px] font-semibold tabular-nums">{days < 0 ? 0 : weeks}{weeklyTarget > 0 && days > 0 ? <span className="ml-1 text-[11px] font-normal text-muted">{formatDuration(weeklyTarget * 60 * weeks, true)} planned</span> : null}</dd></div>
    </dl>
  </Tile>;
}

/** The deeper statistics: everything here follows the filters at the top. */
export function ProgressLab() {
  const { sessions, settings } = useTimer(); const profile = useProfile(); const reduce = useReducedMotion();
  const [filter, setFilter] = useState<StatsFilter>(load);
  const patch = (next: Partial<StatsFilter>) => setFilter((f) => { const v = { ...f, ...next }; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* kept for this visit */ } return v; });
  const now = useMemo(() => new Date(), []);
  const matching = useMemo(() => filterSessions(sessions, filter, now), [sessions, filter, now]);
  const everything = useMemo(() => filterSessions(sessions, filter, now, false), [sessions, filter, now]);
  const from = rangeStart(filter.range, now) ?? (everything.length ? new Date(Math.min(...everything.map((s) => new Date(s.startedAt).getTime()))) : now);
  const secs = matching.reduce((sum, s) => sum + s.seconds, 0);
  const blocks = matching.filter((s) => s.completed).length;
  const cons = useMemo(() => consistency(matching, from, now), [matching, from, now]);
  const goals = matching.filter((s) => s.goal && s.goalMet !== ''); const goalRate = goals.length ? goals.filter((s) => s.goalMet === 'yes').length / goals.length : null;
  const todos = matching.reduce((sum, s) => sum + s.todosDone, 0);
  const subjectsAll = useMemo(() => subjectStats(filterSessions(sessions, { ...filter, subject: '' }, now), profile, now), [sessions, filter, profile, now]);
  const subjectRows = subjectsAll.filter((x) => x.seconds > 0 || activeSubjects(profile).some((u) => u.id === x.id));
  const untagged = filterSessions(sessions, { ...filter, subject: '' }, now).filter((s) => !s.subject).reduce((sum, x) => sum + x.seconds, 0);
  const weekly = useMemo(() => weeklyBySubject(matching, 12, now), [matching, now]);
  const rank = useMemo(() => new Map([...subjectsAll.map((x) => x.id), ''].map((id, i) => [id, i])), [subjectsAll]);
  const weeklyMax = Math.max(1, ...weekly.map((w) => w.total));
  const cumulative = useMemo(() => cumulativeHours(matching, from, now), [matching, from, now]);
  const year = now.getFullYear(); const months = useMemo(() => monthlyTotals(matching, year), [matching, year]);
  const histogram = useMemo(() => lengthHistogram(matching), [matching]);
  const grid = useMemo(() => weekdayHourGrid(matching), [matching]);
  const gridMax = Math.max(1, ...grid.flat());
  const runs = useMemo(() => streakHistory(everything), [everything]);
  const rec = useMemo(() => records(everything), [everything]);
  const rates = useMemo(() => goalRateByWeek(matching, 12, now), [matching, now]);
  const lastTwo = useMemo(() => { const w = weeklyBySubject(everything, 2, now); return w.length === 2 && w[0].total > 0 ? Math.round(((w[1].total - w[0].total) / w[0].total) * 100) : null; }, [everything, now]);
  const subjects = activeSubjects(profile);
  const neglected = subjects.map((u) => subjectsAll.find((x) => x.id === u.id)).filter((x): x is NonNullable<typeof x> => !!x && (x.daysSince === null || x.daysSince >= 7)).slice(0, 4);
  const pts = cumulative.length > 1 ? cumulative : [];
  const maxH = Math.max(0.01, ...pts.map((p) => p.hours));
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * 300},${70 - (p.hours / maxH) * 66}`).join(' ');
  const histMax = Math.max(1, ...histogram);
  const monthMax = Math.max(1, ...months);
  const cell = 'rounded-[3px]';

  return <section id="statistics" aria-labelledby="stats-heading" data-testid="progress-lab" className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7">
    <p className="section-label mb-3">{sectionNo('06')}Statistics</p>
    <h2 id="stats-heading" className="text-[26px] font-semibold leading-tight tracking-tight">Look closer</h2>
    <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-muted">Everything below follows these filters. They are remembered on this device only.</p>

    <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-canvas p-3" role="group" aria-label="Filters" data-testid="stats-filters">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Time range">{RANGES.map((r) => <Chip key={r.id} on={filter.range === r.id} testid={`range-${r.id}`} onClick={() => patch({ range: r.id })}>{r.label}</Chip>)}</div>
      <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
      <select aria-label="Subject" data-testid="filter-subject" value={filter.subject} onChange={(e) => patch({ subject: e.target.value })} className="max-w-[170px] rounded-lg border border-line bg-surface px-2 py-1 text-[11px]">
        <option value="">All subjects</option>{subjects.map((u) => <option key={u.id} value={u.id}>{subjectLabel(u.id, profile)}</option>)}
        {filter.subject && !subjects.some((u) => u.id === filter.subject) && filter.subject !== NO_SUBJECT && <option value={filter.subject}>{subjectLabel(filter.subject, profile)}</option>}
        <option value={NO_SUBJECT}>Without a subject</option>
      </select>
      <select aria-label="Timer mode" value={filter.mode} onChange={(e) => patch({ mode: e.target.value as StatsFilter['mode'] })} className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px]">
        <option value="all">All modes</option><option value="pomodoro">Pomodoro</option><option value="countdown">Countdown</option><option value="stopwatch">Stopwatch</option>
      </select>
      <select aria-label="Shortest session" value={filter.minMin} onChange={(e) => patch({ minMin: Number(e.target.value) })} className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px]">
        {[0, 10, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m ? `At least ${m} min` : 'Any length'}</option>)}
      </select>
      <Chip on={filter.completedOnly} onClick={() => patch({ completedOnly: !filter.completedOnly })}>Finished only</Chip>
      <Chip on={filter.goalOnly} onClick={() => patch({ goalOnly: !filter.goalOnly })}>With a goal</Chip>
      {filterActive(filter) && <button type="button" onClick={() => patch({ ...defaultFilter(), range: filter.range })} className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-muted underline underline-offset-4 hover:text-ink"><RotateCcw size={11} /> Reset filters</button>}
      <p className="w-full text-[11px] text-muted" data-testid="filter-count" aria-live="polite">{matching.length} {matching.length === 1 ? 'session matches' : 'sessions match'}.</p>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="stats-kpis">
      <Stat label="Focus time" value={<Count value={secs} render={(n) => formatDuration(Math.round(n), true)} />} trend={filter.range === '7' || filter.range === '30' ? lastTwo : undefined} sub={filter.range === '7' || filter.range === '30' ? 'vs the week before' : undefined} />
      <Stat label="Blocks finished" value={<Count value={blocks} render={(n) => String(Math.round(n))} />} sub={matching.length ? `of ${matching.length} sessions` : undefined} />
      <Stat label="Active days" value={<Count value={cons.activeDays} render={(n) => String(Math.round(n))} />} sub={`${cons.pct}% of ${cons.days} days`} />
      <Stat label="Average block" value={matching.length ? formatDuration(secs / matching.length, true) : '-'} />
      <Stat label="Goals reached" value={goalRate === null ? '-' : `${Math.round(goalRate * 100)}%`} sub={goals.length ? `${goals.length} answered` : 'set goals in the timer'} />
      <Stat label="To-dos done" value={<Count value={todos} render={(n) => String(Math.round(n))} />} />
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-12">
      <Tile className="lg:col-span-8" title="Subjects" note="click one to focus the statistics on it">
        {subjectRows.length ? <ul className="mt-3 space-y-3" data-testid="subject-rows">
          {subjectRows.map((x, i) => <li key={x.id}>
            <button type="button" onClick={() => patch({ subject: filter.subject === x.id ? '' : x.id })} aria-pressed={filter.subject === x.id} className={`block w-full rounded-lg p-1.5 text-left transition-colors hover:bg-raised ${filter.subject === x.id ? 'bg-raised' : ''}`}>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex min-w-0 items-center gap-2"><span className="grid h-5 min-w-[28px] place-items-center rounded-md border border-line px-1 font-mono text-[9px] font-semibold">{subjectShort(x.id, profile)}</span><span className="truncate font-semibold">{subjectLabel(x.id, profile)}</span></span>
                <span className="shrink-0 tabular-nums text-muted"><strong className="text-ink">{formatDuration(x.seconds, true)}</strong> · {Math.round(x.share * 100)}%</span>
              </div>
              <div className="mt-1.5"><Grow pct={subjectRows[0].seconds ? (x.seconds / subjectRows[0].seconds) * 100 : 0} delay={i * 0.05} /></div>
              <p className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted">
                <span>{x.blocks} {x.blocks === 1 ? 'block' : 'blocks'}</span>
                {x.weekShare !== null && <span>{Math.round(x.weekShare * 100)}% of this week's {formatDuration(x.weeklyMin * 60, true)} plan</span>}
                {x.goalRate !== null && <span>{Math.round(x.goalRate * 100)}% of goals reached</span>}
                {x.todosDone > 0 && <span>{x.todosDone} to-dos</span>}
                {x.driftPerHour !== null && <span>{x.driftPerHour} drifts per hour</span>}
                <span>{x.daysSince === null ? 'not studied yet' : x.daysSince === 0 ? 'studied today' : `${x.daysSince} days ago`}</span>
                {x.trend !== null && <span className="inline-flex items-center gap-0.5 font-semibold text-ink">{x.trend >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}{Math.abs(x.trend)}% vs the 30 days before</span>}
              </p>
            </button>
          </li>)}
          {untagged > 0 && <li className="px-1.5 text-[10px] text-muted">{formatDuration(untagged, true)} without a subject.</li>}
        </ul> : <p className="mt-3 text-[12px] leading-relaxed text-muted">Choose your subjects in Settings, then pick one under the timer. Your time is split up here.</p>}
      </Tile>
      <div className="grid gap-4 lg:col-span-4">
        <ExamCountdown />
        {subjects.length > 0 && <Tile title="Needs attention" note="not studied for a week">
          {neglected.length ? <ul className="mt-3 space-y-1.5" data-testid="neglected">{neglected.map((x) => <li key={x.id} className="flex justify-between gap-2 text-[11px]"><span className="min-w-0 truncate font-semibold">{subjectLabel(x.id, profile)}</span><span className="shrink-0 text-muted">{x.daysSince === null ? 'never' : `${x.daysSince} days`}</span></li>)}</ul>
            : <p className="mt-3 text-[12px] text-muted">Every subject had time in the last week.</p>}
        </Tile>}
      </div>

      <Tile className="lg:col-span-7" title="Weekly time by subject" note="last 12 weeks">
        <div className="mt-4 flex h-[130px] items-end gap-1.5" role="img" aria-label={weekly.map((w) => `Week of ${short(w.weekStart)} ${formatDuration(w.total, true)}`).join(', ')} data-testid="weekly-stack">
          {weekly.map((w, wi) => <div key={w.weekStart} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`Week of ${short(w.weekStart)}: ${formatDuration(w.total, true)}`}>
            <motion.div className="flex flex-col-reverse overflow-hidden rounded-t-[3px]" initial={reduce ? false : { height: 0 }} animate={{ height: `${(w.total / weeklyMax) * 100}%` }} transition={{ duration: 0.45, delay: reduce ? 0 : wi * 0.03 }}>
              {[...w.bySubject].sort((a, b) => (rank.get(a[0]) ?? 99) - (rank.get(b[0]) ?? 99)).map(([id, v]) => <span key={id} className="block w-full border-t border-canvas/60" style={{ height: `${(v / w.total) * 100}%`, background: shadeOf(rank.get(id) ?? 5) }} />)}
            </motion.div>
            <span className="mt-1.5 truncate text-center font-mono text-[9px] text-muted">{short(w.weekStart)}</span>
          </div>)}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">{subjectsAll.filter((x) => x.seconds > 0).slice(0, 6).map((x) => <span key={x.id} className="inline-flex items-center gap-1"><span className={`block h-2.5 w-2.5 border border-line ${cell}`} style={{ background: shadeOf(rank.get(x.id) ?? 5) }} />{subjectShort(x.id, profile)}</span>)}</div>
      </Tile>
      <Tile className="lg:col-span-5" title="Total focus over time" note={filter.range === 'all' ? 'all time' : `last ${filter.range} days`}>
        {path ? <svg viewBox="0 0 300 80" className="mt-4 h-[130px] w-full" role="img" aria-label={`Total focus grew to ${maxH.toFixed(1)} hours`} preserveAspectRatio="none">
          <motion.path d={`${path} L300,72 L0,72 Z`} fill="rgb(var(--ink) / .08)" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
          <motion.path d={path} fill="none" stroke="rgb(var(--ink))" strokeWidth="1.6" vectorEffect="non-scaling-stroke" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />
        </svg> : <p className="mt-3 text-[12px] text-muted">Not enough days yet.</p>}
        <p className="mt-1 text-[11px] text-muted">{pts.length ? `${maxH.toFixed(1)} hours in total at the end of this range.` : ''}</p>
      </Tile>

      <Tile className="lg:col-span-5" title={`Months of ${year}`} note="focus per month">
        <div className="mt-4 flex h-[110px] items-end gap-1" role="img" aria-label={`Focus per month of ${year}`}>
          {months.map((v, m) => <div key={m} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${new Date(year, m, 1).toLocaleDateString(undefined, { month: 'long' })}: ${formatDuration(v, true)}`}>
            <motion.span className={`block w-full rounded-t-[3px] ${m === now.getMonth() ? 'bg-ink' : 'bg-ink/55'}`} initial={reduce ? false : { height: 0 }} animate={{ height: `${Math.max(v ? 3 : 0, (v / monthMax) * 100)}%` }} transition={{ duration: 0.4, delay: reduce ? 0 : m * 0.025 }} />
            <span className="mt-1 text-center font-mono text-[9px] text-muted">{new Date(year, m, 1).toLocaleDateString(undefined, { month: 'narrow' })}</span></div>)}
        </div>
      </Tile>
      <Tile className="lg:col-span-4" title="Session length" note="how long your blocks run">
        <ul className="mt-3 space-y-2">{histogram.map((n, i) => <li key={LENGTH_BUCKETS[i]} className="grid grid-cols-[64px_1fr_24px] items-center gap-2 text-[10px]"><span className="text-muted">{LENGTH_BUCKETS[i]}</span><Grow pct={(n / histMax) * 100} delay={i * 0.04} /><span className="text-right tabular-nums">{n}</span></li>)}</ul>
      </Tile>
      <Tile className="lg:col-span-3" title="Goals reached" note="by week">
        <div className="mt-4 flex h-[90px] items-end gap-1" role="img" aria-label="Share of goals reached per week">
          {rates.map((r, i) => <div key={i} className="flex h-full min-w-0 flex-1 items-end" title={r === null ? 'No answered goals' : `${Math.round(r * 100)}%`}><span className={`block w-full rounded-t-[2px] ${r === null ? 'bg-raised' : 'bg-ink/70'}`} style={{ height: r === null ? '4%' : `${Math.max(6, r * 100)}%` }} /></div>)}
        </div>
        <p className="mt-2 text-[10px] text-muted">Goals you answered in the check after a block.</p>
      </Tile>

      <Tile className="lg:col-span-7" title="When you study" note="weekday and starting hour">
        <div className="mt-3 overflow-x-auto"><div className="min-w-[420px]" role="img" aria-label="Focus time by weekday and starting hour" data-testid="hour-grid">
          {grid.map((row, d) => <div key={d} className="flex items-center gap-[2px]"><span className="w-8 shrink-0 font-mono text-[9px] text-muted">{weekdayName(d)}</span>
            {row.map((v, h) => <span key={h} title={`${weekdayName(d)} ${String(h).padStart(2, '0')}:00, ${formatDuration(v, true)}`} className={`my-[1px] block h-4 flex-1 ${cell}`} style={{ background: v ? `rgb(var(--ink) / ${0.14 + (v / gridMax) * 0.86})` : 'rgb(var(--raised))' }} />)}</div>)}
          <div className="ml-8 mt-1 flex justify-between font-mono text-[9px] text-muted"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
        </div></div>
      </Tile>
      <Tile className="lg:col-span-5" title="Records and streaks">
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[11px]" data-testid="records">
          <div><dt className="font-mono text-[10px] uppercase tracking-wider text-muted">Best day</dt><dd className="mt-0.5 font-semibold">{rec.bestDay ? `${formatDuration(rec.bestDay.seconds, true)} · ${short(rec.bestDay.day)}` : '-'}</dd></div>
          <div><dt className="font-mono text-[10px] uppercase tracking-wider text-muted">Best week</dt><dd className="mt-0.5 font-semibold">{rec.bestWeek ? `${formatDuration(rec.bestWeek.seconds, true)} · ${short(rec.bestWeek.weekStart)}` : '-'}</dd></div>
          <div><dt className="font-mono text-[10px] uppercase tracking-wider text-muted">Longest block</dt><dd className="mt-0.5 font-semibold">{rec.longest ? formatDuration(rec.longest.seconds, true) : '-'}</dd></div>
          <div><dt className="font-mono text-[10px] uppercase tracking-wider text-muted">Most blocks in a day</dt><dd className="mt-0.5 font-semibold">{rec.mostBlocks ? rec.mostBlocks.blocks : '-'}</dd></div>
        </dl>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-muted">Longest streaks</p>
        {runs.length ? <ul className="mt-1.5 space-y-1">{runs.map((r) => <li key={r.from} className="flex justify-between text-[11px]"><span className="font-semibold tabular-nums">{r.length} {r.length === 1 ? 'day' : 'days'}</span><span className="text-muted">{short(r.from)}{r.length > 1 ? ` to ${short(r.to)}` : ''}</span></li>)}</ul> : <p className="mt-1 text-[11px] text-muted">None yet.</p>}
      </Tile>
    </div>
    <p className="mt-4 flex items-center gap-1.5 text-[10px] text-muted"><GraduationCap size={11} /> Subject lists are typical offerings, not an official register. Daily goal for streak badges: {settings.dailyGoalMin ? formatDuration(settings.dailyGoalMin * 60, true) : 'off'}.</p>
  </section>;
}
