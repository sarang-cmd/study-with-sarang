import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Play, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Card } from '../desktop/shared';
import { runAutomationNow } from '../AutomationBridge';
import { isDesktop } from '../../lib/desktop';
import { SUITE } from '../../lib/suite';
import { MAX_AUTOMATIONS, TEMPLATES, TRIGGERS, clearAutoLog, newAutomation, setAutomations, useAutoLog, useAutomations, type Automation } from '../../lib/automations';
import { SNAP_VALUES, STEP_TYPES, describeStep, type MacroStep } from '../../lib/macros';
import { builtInMixes, readSavedMixes } from '../../lib/mix';
import { useProfile } from '../../lib/subjects';

const sel = 'field !min-h-8 !w-auto max-w-[260px] !py-1 text-[11px]';
const inp = 'field !min-h-8 !py-1 text-[11px]';
const DAYS = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 0]] as const;

function summary(a: Automation): string {
  const t = TRIGGERS.find((x) => x.id === a.trigger.type);
  let when = t?.label ?? a.trigger.type;
  if (t?.param === 'time') when = `Every day at ${a.trigger.time}`;
  if (t?.param === 'days') when = `${a.trigger.days} days until your exams`;
  const first = a.steps.slice(0, 2).map(describeStep).join(', ');
  return `${when}: ${first || 'no steps yet'}${a.steps.length > 2 ? ` and ${a.steps.length - 2} more` : ''}`;
}

function StepsEditor({ steps, onChange }: { steps: MacroStep[]; onChange: (steps: MacroStep[]) => void }) {
  const patch = (i: number, p: Partial<MacroStep>) => onChange(steps.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= steps.length) return; const next = [...steps]; [next[i], next[j]] = [next[j], next[i]]; onChange(next); };
  const types = STEP_TYPES.filter((s) => isDesktop || !s.desktopOnly);
  const mixes = [...builtInMixes.map((m) => m.mix.name), ...readSavedMixes().map((m) => m.name)];
  return <div>
    {!isDesktop && <p data-testid="auto-desktop-note" className="mb-2 text-[10.5px] leading-relaxed text-muted">More steps (show, hide or snap the window) exist in the <a className="underline" href={SUITE.study.downloadsUrl}>desktop app</a>; a web page cannot move windows.</p>}
    <ol className="grid gap-1.5" data-testid="auto-steps">
      {steps.length === 0 && <li className="text-[11px] text-muted">No steps yet.</li>}
      {steps.map((step, i) => {
        const kind = STEP_TYPES.find((s) => s.type === step.type);
        return <li key={i} className="flex flex-wrap items-center gap-1.5">
          <span className="w-5 text-right font-mono text-[10px] text-muted">{i + 1}</span>
          <select className={sel} value={step.type} aria-label={`Step ${i + 1} action`} onChange={(e) => patch(i, { type: e.target.value as MacroStep['type'], value: e.target.value === 'wait' ? '5' : e.target.value === 'volume' ? '40' : e.target.value === 'snap' ? 'left' : '' })}>
            {types.map((s) => <option key={s.type} value={s.type}>{s.label}</option>)}{!types.some((s) => s.type === step.type) && <option value={step.type}>{kind?.label ?? step.type}</option>}
          </select>
          {kind?.value === 'mix' && <><input className={`${inp} !w-40`} list="auto-mix-names" placeholder="Mix name" value={step.value} aria-label={`Step ${i + 1} mix`} onChange={(e) => patch(i, { value: e.target.value })} /><datalist id="auto-mix-names">{mixes.map((m) => <option key={m} value={m} />)}</datalist></>}
          {kind?.value === 'number' && <input className={`${inp} !w-20`} type="number" min={step.type === 'wait' ? 1 : 0} max={step.type === 'wait' ? 600 : 100} value={step.value} aria-label={`Step ${i + 1} value`} onChange={(e) => patch(i, { value: e.target.value })} />}
          {kind?.value === 'text' && <input className={`${inp} !w-64`} maxLength={120} placeholder="Message" value={step.value} aria-label={`Step ${i + 1} message`} onChange={(e) => patch(i, { value: e.target.value })} />}
          {kind?.value === 'layout' && <select className={sel} value={step.value || 'left'} aria-label={`Step ${i + 1} layout`} onChange={(e) => patch(i, { value: e.target.value })}>{SNAP_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}</select>}
          <span className="ml-auto flex items-center">
            <button type="button" aria-label="Move step up" disabled={i === 0} onClick={() => move(i, -1)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-raised disabled:opacity-30"><ArrowUp size={12} /></button>
            <button type="button" aria-label="Move step down" disabled={i === steps.length - 1} onClick={() => move(i, 1)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-raised disabled:opacity-30"><ArrowDown size={12} /></button>
            <button type="button" aria-label="Remove step" onClick={() => onChange(steps.filter((_, j) => j !== i))} className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-raised"><X size={12} /></button>
          </span>
        </li>;
      })}
    </ol>
    {steps.length < 20 && <button type="button" className="studio-button !min-h-8 mt-2" onClick={() => onChange([...steps, { type: 'play', value: '' }])}><Plus size={12} />Add a step</button>}
  </div>;
}

function Editor({ a }: { a: Automation }) {
  const profile = useProfile();
  const set = (patch: Partial<Automation>) => setAutomations((cur) => cur.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
  const def = TRIGGERS.find((t) => t.id === a.trigger.type);
  const groups = ['Timer', 'Goals', 'Sound and views', 'Time', 'Other'] as const;
  const toggleDay = (d: number) => set({ when: { ...a.when, weekdays: a.when.weekdays.length === 0 ? [0, 1, 2, 3, 4, 5, 6].filter((x) => x !== d) : a.when.weekdays.includes(d) ? a.when.weekdays.filter((x) => x !== d) : [...a.when.weekdays, d] } });
  const on = (d: number) => a.when.weekdays.length === 0 || a.when.weekdays.includes(d);
  const chip = (active: boolean) => `inline-flex min-h-7 items-center rounded-full border px-2.5 text-[10px] font-semibold ${active ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:text-ink'}`;
  return <div className="mt-3 grid gap-4 border-t border-line pt-3 text-[11px]">
    <div className="grid gap-2">
      <p className="font-semibold">When</p>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Trigger" className={sel} value={a.trigger.type} onChange={(e) => set({ trigger: { ...a.trigger, type: e.target.value as Automation['trigger']['type'] } })}>
          {groups.map((g) => <optgroup key={g} label={g}>{TRIGGERS.filter((t) => t.group === g).map((t) => <option key={t.id} value={t.id} disabled={t.desktopOnly && !isDesktop}>{t.label}{t.desktopOnly && !isDesktop ? ' (desktop app)' : ''}</option>)}</optgroup>)}
        </select>
        {def?.param === 'time' && <input type="time" aria-label="Time of day" className={`${inp} !w-28`} value={a.trigger.time} onChange={(e) => set({ trigger: { ...a.trigger, time: e.target.value || '22:00' } })} />}
        {def?.param === 'days' && <label className="flex items-center gap-1.5">at<input type="number" min={0} max={730} aria-label="Days until exams" className={`${inp} !w-20`} value={a.trigger.days} onChange={(e) => set({ trigger: { ...a.trigger, days: Number(e.target.value) } })} />days</label>}
        {def?.param === 'minutes' && <label className="flex items-center gap-1.5">only if at least<input type="number" min={0} max={600} aria-label="Minimum minutes" className={`${inp} !w-20`} value={a.trigger.minutes} onChange={(e) => set({ trigger: { ...a.trigger, minutes: Number(e.target.value) } })} />minutes (0 = any)</label>}
      </div>
      {def?.hint && <p className="text-muted">{def.hint}</p>}
    </div>
    <div className="grid gap-2">
      <p className="font-semibold">Only if (all optional)</p>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Days">{DAYS.map(([label, d]) => <button key={d} type="button" aria-pressed={on(d)} className={chip(on(d))} onClick={() => toggleDay(d)}>{label}</button>)}</div>
      <div className="flex flex-wrap items-center gap-2">
        <span>between</span><input type="time" aria-label="From" className={`${inp} !w-28`} value={a.when.from} onChange={(e) => set({ when: { ...a.when, from: e.target.value } })} />
        <span>and</span><input type="time" aria-label="To" className={`${inp} !w-28`} value={a.when.to} onChange={(e) => set({ when: { ...a.when, to: e.target.value } })} />
        {(a.when.from || a.when.to) && <button type="button" className="text-muted underline" onClick={() => set({ when: { ...a.when, from: '', to: '' } })}>any time</button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">subject<select aria-label="Subject" className={sel} value={a.when.subject} onChange={(e) => set({ when: { ...a.when, subject: e.target.value } })}><option value="">any</option>{profile.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}{s.level ? ` ${s.level}` : ''}</option>)}</select></label>
        <label className="flex items-center gap-1.5">sound<select aria-label="Sound state" className={sel} value={a.when.sound} onChange={(e) => set({ when: { ...a.when, sound: e.target.value as Automation['when']['sound'] } })}><option value="any">any</option><option value="playing">is playing</option><option value="silent">is off</option></select></label>
        <label className="flex items-center gap-1.5">timer<select aria-label="Timer state" className={sel} value={a.when.timer} onChange={(e) => set({ when: { ...a.when, timer: e.target.value as Automation['when']['timer'] } })}><option value="any">any</option><option value="running">is running</option><option value="idle">is stopped</option></select></label>
        <label className="flex items-center gap-1.5">run<select aria-label="How often" className={sel} value={a.limit} onChange={(e) => set({ limit: e.target.value as Automation['limit'] })}><option value="always">every time</option><option value="daily">once a day</option><option value="hourly">once an hour</option></select></label>
      </div>
    </div>
    <div className="grid gap-2"><p className="font-semibold">Then do</p><StepsEditor steps={a.steps} onChange={(steps) => set({ steps })} /></div>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="studio-button !min-h-8" data-testid="auto-test" onClick={() => runAutomationNow(a)}><Play size={12} />Test now</button>
      <button type="button" className="studio-button !min-h-8" onClick={() => setAutomations((cur) => [...cur, { ...a, id: '', name: `${a.name} copy` }])}><Copy size={12} />Duplicate</button>
      <button type="button" className="studio-button !min-h-8" onClick={() => setAutomations((cur) => cur.filter((x) => x.id !== a.id))}><Trash2 size={12} />Delete</button>
    </div>
  </div>;
}

export function AutomationsTab() {
  const list = useAutomations(); const log = useAutoLog();
  const [open, setOpen] = useState<string | null>(null);
  const add = (a: Automation) => { setAutomations((cur) => [...cur, a]); setOpen(null); };
  return <div className="grid gap-5">
    <Card title="Automations" hint={`Rules that run on their own: when something happens, and only if your conditions hold, do these steps. They run while the app is open${isDesktop ? '' : ' in this tab'}. A rule never triggers itself, and each one can be limited to once a day.`}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="studio-button" data-testid="auto-add" disabled={list.length >= MAX_AUTOMATIONS} onClick={() => { const a = newAutomation(); setAutomations((cur) => [...cur, a]); setOpen(a.id); }}><Plus size={13} />New automation</button>
        <select aria-label="Start from a template" className={sel} value="" onChange={(e) => { const t = TEMPLATES.find((x) => x.id === e.target.value); if (t) add(t.make()); }}>
          <option value="">Start from a template</option>{TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <ul className="mt-4 grid gap-2" data-testid="auto-list">
        {list.length === 0 && <li className="text-[11px] text-muted">None yet. Templates are a quick way to see what is possible; they start switched on, so turn off any you do not want.</li>}
        {list.map((a) => <li key={a.id} data-auto={a.id} className="rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input type="checkbox" role="switch" aria-label={`${a.name} on`} checked={a.enabled} onChange={(e) => setAutomations((cur) => cur.map((x) => (x.id === a.id ? { ...x, enabled: e.target.checked } : x)))} className="h-4 w-4 accent-ink" />
            <input aria-label="Automation name" className={`${inp} !w-48 font-semibold`} maxLength={60} value={a.name} onChange={(e) => setAutomations((cur) => cur.map((x) => (x.id === a.id ? { ...x, name: e.target.value } : x)))} />
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted">{summary(a)}</span>
            <button type="button" aria-expanded={open === a.id} aria-label={open === a.id ? 'Close editor' : 'Edit'} className="flex items-center gap-1 rounded-full border border-line px-3 py-1 text-[11px] font-semibold hover:bg-surface" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}Edit</button>
          </div>
          {open === a.id && <Editor a={a} />}
        </li>)}
      </ul>
    </Card>
    <Card title="Recent runs" hint="What ran, and what was skipped and why. Skipped runs help when a rule does not do what you expect.">
      <ul className="grid gap-1 text-[11px]" data-testid="auto-log">
        {log.length === 0 && <li className="text-muted">Nothing yet.</li>}
        {log.slice(0, 15).map((e, i) => <li key={`${e.at}-${i}`} className="flex gap-2"><span className="font-mono text-muted">{new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><span className="font-semibold">{e.name}</span><span className="text-muted">{e.note}</span></li>)}
      </ul>
      {log.length > 0 && <button type="button" className="studio-button !min-h-8 mt-3" onClick={clearAutoLog}>Clear</button>}
    </Card>
  </div>;
}
