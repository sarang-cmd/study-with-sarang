import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Award, Bell, BookOpen, Check, Compass, Focus, GraduationCap, ListChecks, MonitorSmartphone, Play, Sparkles, Timer, X } from 'lucide-react';
import { TOUR_EVENT, isReturning, readTour, shouldAutoOpen, writeTour } from '../lib/tutorial';
import { setPrefs, usePrefs } from '../lib/prefs';
import { addTodo, setPlan, useTodos, usePlan } from '../lib/plan';
import { activeSubjects, useProfile } from '../lib/subjects';
import { useDesktop } from '../context/DesktopContext';
import { useSettings } from '../context/SettingsContext';
import { isDesktop } from '../lib/desktop';
import { openAiGuide } from './agent/AiGuide';
import { SubjectsTab } from './settings/SubjectsTab';

interface Step { id: string; title: string; icon: typeof Play; desktopOnly?: boolean }
const STEPS: Step[] = [
  { id: 'welcome', title: 'Welcome', icon: Sparkles },
  { id: 'subjects', title: 'What you study', icon: GraduationCap },
  { id: 'sound', title: 'Sound and timer', icon: Timer },
  { id: 'plan', title: 'Goal and to-dos', icon: ListChecks },
  { id: 'progress', title: 'Progress and unlocks', icon: Award },
  { id: 'focus', title: 'Why it works', icon: Focus },
  { id: 'desktop', title: 'Beyond the window', icon: MonitorSmartphone, desktopOnly: true },
  { id: 'ai', title: 'Optional AI', icon: Compass },
  { id: 'more', title: 'Want more?', icon: Compass },
  { id: 'done', title: 'Ready', icon: Check },
];
const goTo = (hash: string) => { location.hash = hash; };

/** The first-run tour. Opens by itself once (and once more per big release), can be skipped for good, and re-runs from Settings, About. */
export function Tutorial() {
  const reduce = useReducedMotion();
  const { info, run } = useDesktop();
  const { openSettings } = useSettings();
  const [prefs] = usePrefs();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [returning, setReturning] = useState(false);
  const [todo, setTodo] = useState(''); const [goal, setGoal] = useState('');
  const steps = useMemo(() => STEPS.filter((s) => (!s.desktopOnly || isDesktop) && (prefs.advanced ? s.id !== 'more' : !['focus', 'desktop', 'ai'].includes(s.id))), [prefs.advanced]);
  const profile = useProfile(); const todos = useTodos(); const plan = usePlan();
  const off = Boolean(info?.noTour) || /[?&]notour\b/.test(location.search);

  useEffect(() => {
    if (!shouldAutoOpen(readTour(), off)) return;
    const timer = window.setTimeout(() => { setReturning(isReturning()); setStep(0); setOpen(true); }, 2200);
    return () => window.clearTimeout(timer);
  }, [off]);
  useEffect(() => {
    const on = (e: Event) => { setReturning(false); setStep(Math.max(0, Math.min(steps.length - 1, Number((e as CustomEvent).detail?.step) || 0))); setOpen(true); };
    window.addEventListener(TOUR_EVENT, on); return () => window.removeEventListener(TOUR_EVENT, on);
  }, [steps.length]);
  const close = (skipped: boolean) => { writeTour({ done: !skipped, skipped }); setOpen(false); };
  useEffect(() => { if (!open) return; const on = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(true); } }; window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on); }, [open]);

  const current = steps[step]; const last = step === steps.length - 1;
  const card = (title: string, text: string) => <div className="rounded-2xl border border-line px-3.5 py-3"><p className="text-[12.5px] font-semibold">{title}</p><p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{text}</p></div>;
  const body: Record<string, ReactNode> = {
    welcome: <div className="grid gap-3" data-testid="tour-welcome">
      <p className="text-[13px] leading-relaxed">{returning ? 'Welcome back. Version 2 adds a lot: subjects and exams, goals and to-dos, a notification bell with unlocks, a floating puck, automations, a distraction check, a calendar feed and an optional AI assistant. This two-minute tour shows where things are.' : 'A calm place to study: sound you can shape, a timer, goals, and a record of what you actually did. This two-minute tour shows where things are. Everything is optional.'}</p>
      <p className="text-[11.5px] font-semibold">How much do you want to see?</p>
      <div role="radiogroup" aria-label="Essentials or everything" className="grid gap-2 sm:grid-cols-2">
        {([[false, 'Essentials', 'Sound, a timer with a goal, your progress. Calm and focused. Recommended.'], [true, 'Everything', 'All features: automations, distraction check, study room, calendar, assistant and more.']] as [boolean, string, string][]).map(([value, name, blurb]) => <button key={name} type="button" role="radio" aria-checked={prefs.advanced === value} onClick={() => setPrefs({ advanced: value })} data-testid={`tour-level-${value ? 'all' : 'essentials'}`} className={`rounded-2xl border px-3.5 py-3 text-left transition-colors ${prefs.advanced === value ? 'border-ink bg-ink/[.05]' : 'border-line hover:border-ink/50'}`}><span className="block text-[12.5px] font-semibold">{name}</span><span className="mt-0.5 block text-[11px] leading-snug text-muted">{blurb}</span></button>)}
      </div>
      <p className="text-[11px] text-muted">Change it any time under Settings, Advanced.</p>
    </div>,
    subjects: <div className="grid gap-3" data-testid="tour-subjects">
      <p className="text-[12.5px] leading-relaxed text-muted">Pick your programme (IB with your year and May or November session, GCSE, IGCSE, CBSE, or your own subjects). It gives you per-subject statistics and an exam countdown. Skip it if you like; nothing breaks.</p>
      <div className="max-h-[48vh] overflow-y-auto rounded-2xl border border-line p-3 pr-2"><SubjectsTab /></div>
    </div>,
    sound: <div className="grid gap-2.5 sm:grid-cols-2" data-testid="tour-sound">
      {card('Studio page', 'Pick a mix, or shape your own: depth, texture, motion, layers like rain and cafe. Space plays or pauses.')}
      {card('Timer', 'Pomodoro, countdown or stopwatch. Blocks are logged with a subject, a goal and your distractions.')}
      {card('Zen view and study room', 'Press Z for a quiet full screen. In the Library you can save your own study videos and play one instead of sound.')}
      {card('Voice', 'Hold the push-to-talk key and say "volume forty" or "start the timer". Free dictation allows 5 a day; your own key has no such limit.')}
      <div className="sm:col-span-2"><button type="button" className="studio-button" onClick={() => run('sound.play')}><Play size={13} /> Play a sound now</button></div>
    </div>,
    plan: <div className="grid gap-3" data-testid="tour-plan">
      <p className="text-[12.5px] leading-relaxed text-muted">Before a block, set what you are working on and one clear goal. After it, one tap records whether you got there. Try it:</p>
      <label className="block text-[11.5px] font-semibold">Goal for your next block<input className="field mt-1 w-full text-[12.5px] font-normal" value={goal || plan.goal} onChange={(e) => setGoal(e.target.value)} maxLength={140} placeholder="Two past paper questions on waves" data-testid="tour-goal" onBlur={() => { if (goal.trim()) setPlan({ goal: goal.trim() }); }} /></label>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = addTodo(todo, plan.subject); if (t) setTodo(''); }}>
        <input className="field flex-1 text-[12.5px]" value={todo} onChange={(e) => setTodo(e.target.value)} maxLength={140} placeholder="Add a first to-do" aria-label="Add a first to-do" data-testid="tour-todo" /><button type="submit" className="studio-button" disabled={!todo.trim()} data-testid="tour-todo-add">Add</button>
      </form>
      {todos.length > 0 && <ul className="grid gap-1 text-[11.5px] text-muted" data-testid="tour-todos">{todos.slice(0, 4).map((t) => <li key={t.id} className="flex items-center gap-1.5"><Check size={11} />{t.text}</li>)}</ul>}
      <p className="text-[11px] text-muted">Subject for this block: {plan.subject ? activeSubjects(profile).find((s) => s.id === plan.subject)?.name ?? 'chosen' : 'none chosen yet'}. You can set it under the timer.</p>
    </div>,
    progress: <div className="grid gap-2.5 sm:grid-cols-2" data-testid="tour-progress">
      {card('Progress page', 'A heatmap for every year, totals per subject, charts you can filter. Your own record, kept on this device.')}
      {card('Unlocks', 'Over 90 achievements. They are meant to take real effort, and some are secret. Each unlock gets its own small animation.')}
      <div className="flex items-start gap-2 rounded-2xl border border-line px-3.5 py-3 sm:col-span-2"><Bell size={15} className="mt-0.5 shrink-0" /><p className="text-[11.5px] leading-relaxed text-muted"><strong className="text-ink">The bell</strong> in the top bar keeps unlocks, goal results and reminders in one list, with filters. You decide what it tells you under Settings, Notifications.</p></div>
    </div>,
    focus: <div className="grid gap-3" data-testid="tour-focus">
      <p className="text-[12.5px] leading-relaxed text-muted">The Focus page makes the case for starting, in three kinds of reason (ethos, logos, pathos), and asks you one question to answer for yourself. It also has the optional <strong className="text-ink">neural lock</strong>: a gentle rhythm under your sound inspired by attention research. Off until you switch it on, and honest about what is not proven.</p>
      <div className="flex flex-wrap gap-2"><button type="button" className="studio-button" onClick={() => { close(false); goTo('reasons'); }}><BookOpen size={13} /> Show me the reasons</button><button type="button" className="studio-button" onClick={() => { close(false); goTo('neural'); }}>Show me neural lock</button></div>
    </div>,
    desktop: <div className="grid gap-2.5 sm:grid-cols-2" data-testid="tour-desktop">
      {card('Floating puck', 'A small always-on-top control for the timer and sound, over every window. Skip or pause from anywhere.')}
      {card('Monitors and snap', 'Keep the app on a chosen screen, send Zen to your second monitor when it connects, snap to halves and thirds.')}
      {card('Distraction check', 'Notices when you drift to sites you chose to avoid, using word lists on your computer. AI is optional.')}
      {card('Automations and macros', 'When a block ends, play a sound, show a message, open Zen. Build your own rules.')}
      <div className="flex flex-wrap gap-2 sm:col-span-2">{[['puck', 'Puck'], ['desktop', 'Window and monitors'], ['drift', 'Distraction check'], ['automations', 'Automations'], ['calendar', 'Calendar']].map(([tab, label]) => <button key={tab} type="button" className="studio-button" onClick={() => { close(false); openSettings(tab); }}>{label}</button>)}</div>
    </div>,
    ai: <div className="grid gap-3" data-testid="tour-ai">
      <p className="text-[12.5px] leading-relaxed text-muted">Nothing here needs AI. If you want it, an assistant can change settings, add to-dos and build automations for you, and AI can sharpen the distraction check. It uses your own free key (Groq, Gemini, OpenRouter, Mistral, GitHub Models) or a model on your computer. Dictation has a free shared helper, 5 a day.</p>
      <div className="flex flex-wrap gap-2"><button type="button" className="studio-button" onClick={() => openAiGuide()} data-testid="tour-ai-open"><Sparkles size={13} /> Open the AI walkthrough</button><span className="self-center text-[11px] text-muted">Or skip it. It is always under Settings, Assistant.</span></div>
    </div>,
    more: <div className="grid gap-3" data-testid="tour-more">
      <p className="text-[12.5px] leading-relaxed text-muted">You are using Essentials: the parts most people use every day. The rest is not gone, just tucked away: automations, the distraction check, the study room, calendar feed, Focus page, the AI assistant and the detailed settings.</p>
      <div className="flex flex-wrap gap-2"><button type="button" className="studio-button" onClick={() => setPrefs({ advanced: true })} data-testid="tour-show-all"><Sparkles size={13} /> Show everything now</button></div>
      <p className="text-[11px] text-muted">Or later: Settings, Advanced, \"Show everything\".</p>
    </div>,
    done: <div className="grid gap-3" data-testid="tour-done">
      <p className="text-[13px] leading-relaxed">That is the tour. Set a goal, start the timer, and see what one block feels like.</p>
      <div className="flex flex-wrap gap-2"><button type="button" className="studio-button !bg-ink !text-canvas" onClick={() => { close(false); run('timer.start'); }} data-testid="tour-start"><Play size={13} /> Start a first block</button><button type="button" className="studio-button" onClick={() => close(false)}>Just look around</button></div>
      <p className="text-[11px] text-muted">Show this tour again any time under Settings, About.</p>
    </div>,
  };

  return createPortal(<AnimatePresence>
    {open && <motion.div key="tour" className="fixed inset-0 z-[128] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div role="dialog" aria-modal="true" aria-label="Welcome tour" data-testid="tour" initial={reduce ? false : { opacity: 0, y: 20, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }} className="flex max-h-[92vh] w-full max-w-[600px] flex-col rounded-3xl border border-ink/20 bg-canvas p-5 shadow-2xl sm:p-6">
        <div className="flex items-center gap-2"><current.icon size={16} /><h2 className="flex-1 text-[15px] font-semibold" data-testid="tour-title">{current.title}</h2><span className="font-mono text-[10px] text-muted">{step + 1} / {steps.length}</span><button type="button" onClick={() => close(true)} aria-label="Close the tour" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:text-ink"><X size={16} /></button></div>
        <div className="mt-3 flex gap-1" aria-hidden="true">{steps.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-ink' : 'bg-line'}`} />)}</div>
        <div className="mt-4 min-h-[240px] flex-1 overflow-y-auto pr-1"><AnimatePresence mode="wait" initial={false}><motion.div key={current.id} initial={reduce ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: -18 }} transition={{ duration: .18 }}>{body[current.id]}</motion.div></AnimatePresence></div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="text-[11.5px] text-muted underline" onClick={() => close(true)} data-testid="tour-skip">Skip the tour</button><span className="flex-1" />
          {step > 0 && <button type="button" className="studio-button" onClick={() => setStep(step - 1)}><ArrowLeft size={13} /> Back</button>}
          {!last && <button type="button" className="studio-button !bg-ink !text-canvas" onClick={() => setStep(step + 1)} data-testid="tour-next">{step === 0 ? 'Start the tour' : 'Next'} <ArrowRight size={13} /></button>}
        </div>
      </motion.div>
    </motion.div>}
  </AnimatePresence>, document.body);
}
