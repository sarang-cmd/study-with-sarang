import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Plus, Trash2 } from 'lucide-react';
import { CURRICULA, addCustomSubject, countdownLabel, curriculum, daysUntil, examDate, ibNotes, removeSubject, setProfile, subjectId, toggleSubject, updateSubject, upcomingSessions, useProfile, type CurriculumId, type Level } from '../../lib/subjects';
import { Card, Toggle } from '../desktop/shared';
import { setPrefs, usePrefs } from '../../lib/prefs';
import { Row, Segmented } from './parts';

const sel = 'field !min-h-8 !w-auto !py-1 text-[11px]';

/** Settings > Subjects: programme, stage, exam session, and the subjects you study. Used again by the first-run tour. */
export function SubjectsTab() {
  const p = useProfile();
  const [prefs] = usePrefs();
  const cur = curriculum(p.curriculum);
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState(''); const [customLevel, setCustomLevel] = useState<Level>('');
  const sessions = useMemo(() => upcomingSessions(p.curriculum), [p.curriculum]);
  const date = examDate(p); const days = daysUntil(date);
  const chosen = new Set(p.subjects.map((u) => u.id));
  const list = cur.subjects.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase()) || d.short.toLowerCase() === query.trim().toLowerCase());
  const notes = p.curriculum === 'ib' ? ibNotes(p.subjects) : [];
  const sessionValue = p.exam.season && p.exam.year ? `${p.exam.season}:${p.exam.year}` : '';
  return <div className="grid gap-5">
    <Card title="Your programme" hint="Pick what you are studying so the app can speak your language. Nothing here is required, and you can add your own subjects at any time.">
      <div role="radiogroup" aria-label="Programme" className="grid gap-2 sm:grid-cols-2">
        {CURRICULA.map((c) => <button key={c.id} type="button" role="radio" aria-checked={p.curriculum === c.id} onClick={() => setProfile({ curriculum: c.id as CurriculumId, stage: '', exam: { season: '', year: 0, date: '' }, asked: true })}
          className={`rounded-xl border px-3.5 py-3 text-left transition-colors ${p.curriculum === c.id ? 'border-ink bg-raised' : 'border-line hover:border-ink'}`}>
          <span className="block text-[12px] font-semibold">{c.label}</span><span className="mt-0.5 block text-[10px] leading-snug text-muted">{c.blurb}</span></button>)}
      </div>
      {cur.stages.length > 0 && <div className="mt-3 grid gap-2">
        <Row label={p.curriculum === 'ib' ? 'Which year are you in?' : 'Year or class'} hint={p.curriculum === 'ib' ? 'DP1 is the first year of the Diploma, DP2 the second.' : undefined}>
          <Segmented label="Stage" value={p.stage || ''} onChange={(stage) => setProfile({ stage })} options={cur.stages.map((s) => ({ id: s, label: s }))} /></Row>
        {cur.seasons.length > 0 && <Row label="Exam session" hint={p.curriculum === 'ib' ? 'IB exams are in May or November. The date is the usual start of the exam period, so treat the countdown as a guide.' : 'The date is the usual start of the exam period. Enter the exact date below if you know it.'}>
          <select className={sel} aria-label="Exam session" value={sessionValue} onChange={(e) => { const [season, year] = e.target.value.split(':'); setProfile({ exam: { ...p.exam, season: season ?? '', year: Number(year) || 0 } }); }}>
            <option value="">Not chosen</option>{sessions.map((s) => <option key={`${s.season}:${s.year}`} value={`${s.season}:${s.year}`}>{s.label}</option>)}</select></Row>}
        {cur.seasons.length > 0 && <Row label="Exact first exam date" hint="Optional. Overrides the estimate."><span className="flex items-center gap-2"><input type="date" className={sel} aria-label="Exact exam date" value={p.exam.date} onChange={(e) => setProfile({ exam: { ...p.exam, date: e.target.value } })} />{p.exam.date && <button type="button" className="studio-button !min-h-8" onClick={() => setProfile({ exam: { ...p.exam, date: '' } })}>Clear</button>}</span></Row>}
        {date && <p className="px-1 text-[12px] font-semibold" data-testid="countdown">{countdownLabel(days)}{!p.exam.date && <span className="font-normal text-muted"> (about {date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })})</span>}</p>}
      </div>}
    </Card>

    <Card title="Choose your subjects" hint={cur.typicalCount ?? (cur.subjects.length ? 'Tick the ones you take.' : 'Add your own subjects below.')}>
      {cur.subjects.length > 0 && <input type="search" className="field mb-3" placeholder="Search subjects" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search subjects" />}
      <div className="grid gap-4">
        {cur.groups.map((group) => {
          const items = list.filter((d) => d.group === group); if (!items.length) return null;
          return <section key={group} aria-label={group}><h4 className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-muted">{group}</h4>
            <ul className="grid gap-1.5 sm:grid-cols-2">{items.map((d) => {
              const id = subjectId(cur.id, d.name); const on = chosen.has(id); const user = p.subjects.find((u) => u.id === id);
              return <li key={d.name} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${on ? 'border-ink bg-raised' : 'border-line'}`}>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"><input type="checkbox" className="h-4 w-4 shrink-0 accent-ink" checked={on} onChange={(e) => toggleSubject(d, cur.id, e.target.checked)} />
                  <span className="min-w-0 truncate text-[11px] font-semibold" title={d.name}>{d.name}</span></label>
                {on && cur.levels && d.levels && d.levels.length > 1 && <span className="flex shrink-0 overflow-hidden rounded-full border border-line text-[10px] font-bold" role="radiogroup" aria-label={`${d.name} level`}>
                  {d.levels.map((lv) => <button key={lv} type="button" role="radio" aria-checked={user?.level === lv} onClick={() => updateSubject(id, { level: lv })} className={`px-2 py-0.5 ${user?.level === lv ? 'bg-ink text-canvas' : 'text-muted hover:text-ink'}`}>{lv}</button>)}</span>}
                {on && cur.levels && d.levels && d.levels.length === 1 && <span className="shrink-0 font-mono text-[10px] text-muted">{d.levels[0]}</span>}
              </li>;
            })}</ul></section>;
        })}
        {cur.subjects.length > 0 && list.length === 0 && <p className="text-[11px] text-muted">No match. Add it as your own subject below.</p>}
      </div>
      {notes.length > 0 && <ul className="mt-3 grid gap-1 rounded-lg bg-raised px-3 py-2 text-[11px] text-muted" aria-label="Notes about your choices">{notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <input type="text" className="field !w-[min(260px,100%)]" maxLength={48} placeholder="Add your own subject" value={custom} aria-label="Your own subject" onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && addCustomSubject(custom, customLevel)) setCustom(''); }} />
        {p.curriculum === 'ib' && <Segmented label="Level for your own subject" value={customLevel || 'none'} onChange={(v) => setCustomLevel(v === 'none' ? '' : (v as Level))} options={[{ id: 'none', label: 'No level' }, { id: 'SL', label: 'SL' }, { id: 'HL', label: 'HL' }]} />}
        <button type="button" className="studio-button" disabled={!custom.trim()} onClick={() => { if (addCustomSubject(custom, customLevel)) setCustom(''); }}><Plus size={14} /> Add</button>
      </div>
    </Card>

    {p.subjects.length > 0 && <Card title={`Your subjects (${p.subjects.filter((u) => !u.archived).length})`} hint="Set a weekly time goal for any subject, or archive one you have finished. Archived subjects keep their history but leave the pickers.">
      <ul className="grid gap-1.5" data-testid="my-subjects">{p.subjects.map((u) => <li key={u.id} className={`flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 ${u.archived ? 'opacity-60' : ''}`}>
        <span className="flex min-w-0 flex-1 items-center gap-2"><span className="rounded bg-ink px-1.5 py-0.5 font-mono text-[9px] font-bold text-canvas">{u.short}</span><span className="truncate text-[12px] font-semibold">{u.name}{u.level ? ` ${u.level}` : ''}</span></span>
        <label className="flex items-center gap-1.5 text-[10px] text-muted">Weekly goal <input type="number" min={0} max={6000} step={15} className="field !min-h-7 !w-[70px] !py-0.5 text-center text-[11px]" value={u.weeklyMin || ''} placeholder="none" aria-label={`Weekly goal in minutes for ${u.name}`} onChange={(e) => updateSubject(u.id, { weeklyMin: Number(e.target.value) || 0 })} /> min</label>
        <button type="button" onClick={() => updateSubject(u.id, { archived: !u.archived })} aria-label={u.archived ? 'Restore' : 'Archive'} data-tip={u.archived ? 'Restore' : 'Archive'} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-ink">{u.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}</button>
        <button type="button" onClick={() => removeSubject(u.id)} aria-label={`Remove ${u.name}`} data-tip="Remove" className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-ink"><Trash2 size={14} /></button>
      </li>)}</ul>
    </Card>}
    <Card title="Goals" hint="Set a goal for a block under the timer. When the block is logged, one tap records whether you got there.">
      <Toggle label="Ask whether I reached my goal" hint="A small card appears after a block that had a goal." checked={prefs.goalPrompt} onChange={(goalPrompt) => setPrefs({ goalPrompt })} />
    </Card>
  </div>;
}
