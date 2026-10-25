import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, ListChecks, Plus, Target, Trash2, ArrowUp, ArrowDown, GraduationCap } from 'lucide-react';
import { activeSubjects, subjectLabel, subjectShort, useProfile } from '../lib/subjects';
import { addTodo, clearDoneTodos, moveTodo, removeTodo, setPlan, toggleTodo, todoCounts, usePlan, useTodos } from '../lib/plan';
import { addNote } from '../lib/notifications';
import { useSettings } from '../context/SettingsContext';

/** Under the timer: which subject, what you want to get done in this block, and a to-do list. */
export function SessionPlan() {
  const profile = useProfile(); const plan = usePlan(); const todos = useTodos();
  const reduce = useReducedMotion();
  const { openSettings } = useSettings();
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState('');
  const [scope, setScope] = useState<'subject' | 'all'>('subject');
  const subjects = activeSubjects(profile);
  const counts = todoCounts(undefined, todos);
  const shown = todos.filter((t) => scope === 'all' || !plan.subject || t.subject === plan.subject || !t.subject);
  const submit = () => { if (addTodo(draft, plan.subject)) setDraft(''); };
  const tick = (id: string) => {
    const changed = toggleTodo(id);
    if (changed?.done) {
      const left = todoCounts(changed.subject).open;
      if (left === 0) addNote({ kind: 'goal', title: 'To-do list cleared', message: changed.subject ? `Everything for ${subjectLabel(changed.subject, profile)} is done.` : 'Everything on your list is done.', key: `todos-clear-${changed.subject}` });
    }
  };
  return <div className="rounded-xl border border-line bg-canvas p-4" data-testid="session-plan">
    <div className="flex items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold"><GraduationCap size={13} /> Session plan</p>
      {subjects.length > 0 && <button type="button" onClick={() => openSettings('subjects')} className="text-[10px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">Edit subjects</button>}
    </div>
    <div className="mt-2.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Subject">
      {subjects.length === 0
        ? <button type="button" onClick={() => openSettings('subjects')} className="studio-button !min-h-8 text-[11px]">Choose your subjects</button>
        : <>
          <button type="button" role="radio" aria-checked={!plan.subject} onClick={() => setPlan({ subject: '' })} className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${!plan.subject ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>No subject</button>
          {subjects.map((u) => <button key={u.id} type="button" role="radio" aria-checked={plan.subject === u.id} title={subjectLabel(u.id, profile)} onClick={() => setPlan({ subject: plan.subject === u.id ? '' : u.id })}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${plan.subject === u.id ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>{subjectShort(u.id, profile)}</button>)}
        </>}
    </div>
    <label htmlFor="plan-goal" className="mt-3.5 flex items-center gap-1.5 text-[11px] font-semibold"><Target size={12} /> Goal for this block</label>
    <div className="mt-1.5 flex gap-2">
      <input id="plan-goal" type="text" maxLength={160} value={plan.goal} onChange={(e) => setPlan({ goal: e.target.value })} placeholder="e.g. Finish questions 1 to 5 without notes" className="field" autoComplete="off" />
      {plan.goal && <button type="button" onClick={() => setPlan({ goal: '' })} className="studio-button !min-h-9 shrink-0 text-[11px]" aria-label="Clear the goal">Clear</button>}
    </div>
    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-3.5 flex w-full items-center justify-between text-left text-[11px] font-semibold">
      <span className="flex items-center gap-1.5"><ListChecks size={13} /> To-do list <span className="font-mono text-muted">{counts.open} open{counts.done ? `, ${counts.done} done` : ''}</span></span>
      <ChevronDown size={14} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    <AnimatePresence initial={false}>{open && <motion.div initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
      <div className="mt-2 flex gap-2">
        <input type="text" value={draft} maxLength={140} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder={plan.subject ? `Add a to-do for ${subjectShort(plan.subject, profile)}` : 'Add a to-do'} aria-label="New to-do" className="field" autoComplete="off" />
        <button type="button" onClick={submit} disabled={!draft.trim()} className="studio-button !min-h-9 shrink-0" aria-label="Add to-do"><Plus size={14} /></button>
      </div>
      {plan.subject && todos.some((t) => t.subject !== plan.subject) && <div className="mt-2 flex gap-1.5 text-[10px]">
        {(['subject', 'all'] as const).map((id) => <button key={id} type="button" aria-pressed={scope === id} onClick={() => setScope(id)} className={`rounded-full border px-2.5 py-0.5 font-semibold ${scope === id ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:text-ink'}`}>{id === 'subject' ? 'This subject' : 'All'}</button>)}
      </div>}
      <ul className="mt-2 grid gap-1" aria-label="To-do list">
        <AnimatePresence initial={false}>{shown.map((t, i) => <motion.li key={t.id} layout={!reduce} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} data-testid="todo" data-done={t.done} className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-raised">
          <button type="button" role="checkbox" aria-checked={t.done} aria-label={`${t.text}${t.done ? ', done' : ''}`} onClick={() => tick(t.id)} className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${t.done ? 'border-ink bg-ink text-canvas' : 'border-muted/60 hover:border-ink'}`}>
            <motion.span initial={false} animate={{ scale: t.done ? 1 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }} className="flex"><Check size={12} strokeWidth={3} /></motion.span>
          </button>
          <span className={`min-w-0 flex-1 break-words text-[12px] leading-snug ${t.done ? 'text-muted line-through' : ''}`}>{t.text}{t.subject && <span className="ml-1.5 font-mono text-[9px] text-muted">{subjectShort(t.subject, profile)}</span>}</span>
          {!t.done && <button type="button" onClick={() => setPlan({ goal: t.text })} className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-muted opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100" aria-label={`Use "${t.text}" as the goal`}>Goal</button>}
          <span className="flex opacity-0 focus-within:opacity-100 group-hover:opacity-100">
            <button type="button" onClick={() => moveTodo(t.id, -1)} disabled={i === 0} aria-label="Move up" className="rounded p-1 text-muted hover:text-ink disabled:opacity-30"><ArrowUp size={11} /></button>
            <button type="button" onClick={() => moveTodo(t.id, 1)} disabled={i === shown.length - 1} aria-label="Move down" className="rounded p-1 text-muted hover:text-ink disabled:opacity-30"><ArrowDown size={11} /></button>
            <button type="button" onClick={() => removeTodo(t.id)} aria-label="Remove" className="rounded p-1 text-muted hover:text-ink"><Trash2 size={11} /></button>
          </span>
        </motion.li>)}</AnimatePresence>
        {!shown.length && <li className="px-1.5 py-2 text-[11px] text-muted">Nothing here yet. Add the next small step.</li>}
      </ul>
      {counts.done > 0 && <button type="button" onClick={clearDoneTodos} className="mt-1.5 text-[10px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">Clear {counts.done} done</button>}
    </motion.div>}</AnimatePresence>
  </div>;
}
