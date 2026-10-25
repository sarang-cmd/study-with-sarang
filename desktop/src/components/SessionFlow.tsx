import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Clock, Lightbulb, Target, X } from 'lucide-react';
import { useTimer } from '../context/TimerContext';
import { useSound } from '../context/SoundContext';
import { addNote } from '../lib/notifications';
import { completeReview, dueReviews, scheduleReviews, tidyReviews, todayStr, useReviews } from '../lib/reviews';
import { MINUTE_CHOICES, TECHNIQUES, onAskStart, onBlockEnd, requestAskStart, type BlockEnd } from '../lib/session';
import { setPlan, todoCounts, useTodos, usePlan } from '../lib/plan';
import { setPrefs, usePrefs } from '../lib/prefs';
import { activeSubjects, subjectLabel, subjectShort, useProfile } from '../lib/subjects';
import { dayStats, formatDuration } from '../lib/tracking';
import { notify } from './ui/toast';

const chip = (on: boolean) => `rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${on ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink hover:text-ink'}`;

/** Before a block: what is it for, and for how long. Escape cancels, Enter starts. */
function StartDialog({ startAfter, onClose }: { startAfter: boolean; onClose: () => void }) {
  const t = useTimer(); const [prefs] = usePrefs(); const plan = usePlan(); const todos = useTodos(); const profile = useProfile(); const reviews = useReviews();
  const x = prefs.session; const reduce = useReducedMotion();
  const [goal, setGoal] = useState(plan.goal);
  const [subject, setSubject] = useState(plan.subject);
  const current = t.mode === 'countdown' ? t.settings.countdownMin : t.settings.focusMin;
  const [minutes, setMinutes] = useState(current);
  const [tech, setTech] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const subjects = activeSubjects(profile);
  const open = todos.filter((item) => !item.done && (!subject || !item.subject || item.subject === subject)).slice(0, 4);
  const due = dueReviews(todayStr(), reviews).slice(0, 3);
  const showMinutes = x.askMinutes && t.mode !== 'stopwatch';
  const why = TECHNIQUES.find((item) => item.id === tech)?.why;
  useEffect(() => { input.current?.focus(); const len = input.current?.value.length ?? 0; input.current?.setSelectionRange(len, len); }, []);
  const go = () => {
    setPlan({ goal: goal.trim(), subject });
    if (showMinutes && minutes !== current) t.setSettings(t.mode === 'countdown' ? { countdownMin: minutes } : { focusMin: minutes });
    onClose();
    if (startAfter) t.startNow();
    else notify({ message: 'Goal saved for the next block.', variant: 'default', duration: 1800 });
  };
  const justStart = () => { onClose(); if (startAfter) t.startNow(); };
  const inputKey = (event: React.KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); go(); } };
  return <motion.div className="fixed inset-0 z-[126] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.div role="dialog" aria-modal="true" aria-label="What is this block for?" data-testid="session-start" initial={reduce ? false : { opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
      className="max-h-[92vh] w-[min(520px,100%)] overflow-y-auto rounded-3xl border border-line bg-surface p-5 shadow-float sm:p-6" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
      <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-muted"><Target size={12} /> Before you start</p><h2 className="mt-1.5 text-[19px] font-semibold tracking-tight">What is this block for?</h2></div>
        <button type="button" onClick={onClose} aria-label="Not now" className="rounded-md p-1.5 text-muted hover:text-ink"><X size={15} /></button></div>

      {due.length > 0 && <div className="mt-4 rounded-xl border border-line bg-canvas p-3" data-testid="review-due"><p className="flex items-center gap-1.5 text-[11px] font-semibold"><Lightbulb size={12} /> Due for review</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{due.map((r) => <button key={r.id} type="button" className={chip(false)} onClick={() => { setGoal(`Review: ${r.text}`); if (r.subject) setSubject(r.subject); completeReview(r.id); input.current?.focus(); }}>{r.text.length > 36 ? `${r.text.slice(0, 35)}...` : r.text}</button>)}</div></div>}

      {subjects.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Subject">
        <button type="button" role="radio" aria-checked={!subject} className={chip(!subject)} onClick={() => setSubject('')}>No subject</button>
        {subjects.map((s) => <button key={s.id} type="button" role="radio" aria-checked={subject === s.id} title={subjectLabel(s.id, profile)} className={chip(subject === s.id)} onClick={() => setSubject(subject === s.id ? '' : s.id)}>{subjectShort(s.id, profile)}</button>)}
      </div>}

      <label htmlFor="start-goal" className="mt-4 block text-[12px] font-semibold">Your goal for this block</label>
      <input id="start-goal" ref={input} className="field mt-1.5" maxLength={160} value={goal} onChange={(e) => setGoal(e.target.value)} onKeyDown={inputKey} placeholder="e.g. Finish questions 1 to 5 without notes" autoComplete="off" data-testid="start-goal" />
      {open.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Your open to-dos">{open.map((item) => <button key={item.id} type="button" className={chip(goal === item.text)} onClick={() => setGoal(item.text)}>{item.text.length > 34 ? `${item.text.slice(0, 33)}...` : item.text}</button>)}</div>}

      {x.techniques && <div className="mt-4" data-testid="start-techniques"><p className="text-[11px] font-semibold text-muted">How will you study it? (optional)</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{TECHNIQUES.map((item) => <button key={item.id} type="button" aria-pressed={tech === item.id} className={chip(tech === item.id)} onClick={() => { setTech(item.id); const starts = TECHNIQUES.map((q) => q.goal); if (!goal.trim() || starts.some((s) => goal.startsWith(s))) setGoal(item.goal + (subject ? `${subjectShort(subject, profile)}` : '')); input.current?.focus(); }}>{item.label}</button>)}</div>
        {why && <p className="mt-2 text-[11px] leading-relaxed text-muted" data-testid="technique-why">{why}</p>}</div>}

      {showMinutes && <div className="mt-4"><p className="flex items-center gap-1.5 text-[12px] font-semibold"><Clock size={12} /> How long?</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Minutes">
          {MINUTE_CHOICES.map((m) => <button key={m} type="button" role="radio" aria-checked={minutes === m} className={chip(minutes === m)} onClick={() => setMinutes(m)}>{m} min</button>)}
          <label className="flex items-center gap-1.5 text-[11px] text-muted"><input type="number" min={1} max={180} className="field !min-h-8 !w-[68px] !py-1 text-[12px]" value={minutes} onChange={(e) => setMinutes(Math.max(1, Math.min(180, Math.round(Number(e.target.value) || 1))))} onKeyDown={inputKey} aria-label="Custom minutes" data-testid="start-minutes" />min</label>
        </div>
        <p className="mt-1.5 text-[10px] text-muted">{t.mode === 'countdown' ? 'This becomes your countdown length.' : 'This becomes your focus length. Change it any time in Timer settings.'}</p></div>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" className="studio-button !bg-ink !text-canvas" onClick={go} data-testid="start-go">{startAfter ? 'Start' : 'Save goal'}</button>
        {startAfter && <button type="button" className="studio-button" onClick={justStart} data-testid="start-skip">Just start</button>}
        <span className="flex-1" />
        <button type="button" className="text-[11px] text-muted underline underline-offset-2 hover:text-ink" onClick={() => { setPrefs({ session: { ...x, askStart: false } }); onClose(); if (startAfter) t.startNow(); }} data-testid="start-never">Do not ask again</button>
      </div>
    </motion.div>
  </motion.div>;
}

/** After a block: did it work, and what next. A card in the corner, never in the way. */
function WrapUp({ info, onClose }: { info: BlockEnd; onClose: () => void }) {
  const t = useTimer(); const sound = useSound(); const [prefs] = usePrefs(); const profile = useProfile(); const todos = useTodos(); const reduce = useReducedMotion();
  const x = prefs.session;
  const [outcome, setOutcome] = useState<'' | 'yes' | 'partly' | 'no'>('');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState(false);
  const today = useMemo(() => dayStats(t.sessions, sound.listening, 1)[0], [t.sessions, sound.listening]);
  const minutes = Math.max(1, Math.round(info.seconds / 60));
  const onBreak = t.mode === 'pomodoro' && t.phase !== 'focus';
  const open = todoCounts(undefined, todos).open;
  const label = info.goal || info.task;
  const save = () => {
    if (outcome) {
      t.setGoalOutcome(info.sessionId, outcome);
      if (outcome === 'yes') addNote({ kind: 'goal', title: 'Goal reached', message: `${info.goal}${info.subject ? ` (${subjectShort(info.subject, profile)})` : ''}`, key: `goal-${info.sessionId}` });
    }
    if (rating) t.rateSession(info.sessionId, rating);
    if (review && label) { const n = scheduleReviews(label, info.subject, x.reviewDays); if (n) notify({ message: `Review reminders set for ${x.reviewDays.map((d) => `day ${d}`).join(', ')}.`, variant: 'default', duration: 2600 }); }
  };
  const done = (then: () => void) => () => { save(); onClose(); then(); };
  const keepBreak = done(() => undefined);
  const another = done(() => { if (info.goal) setPlan({ goal: info.goal, subject: info.subject }); if (onBreak) t.skip(); else t.startNow(); });
  const fresh = done(() => { setPlan({ goal: '' }); requestAskStart(false); });
  const finishDay = done(() => { if (t.running) t.reset(); sound.pause(); notify({ title: 'Good session', message: `${formatDuration(today.focusSeconds, true)} of focus today.`, variant: 'success', id: 'day-done', duration: 4200 }); });
  return <motion.div role="dialog" aria-label="Block finished" data-testid="session-wrap" initial={reduce ? false : { y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}
    className="fixed bottom-4 left-4 z-[121] max-h-[calc(100vh-32px)] w-[min(380px,calc(100vw-32px))] overflow-y-auto rounded-2xl border border-ink bg-canvas p-4 shadow-float">
    <button type="button" onClick={() => { save(); onClose(); }} aria-label="Close" className="absolute right-2.5 top-2.5 rounded-md p-1 text-muted hover:text-ink"><X size={13} /></button>
    <p className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-muted"><Check size={11} /> Block logged · {minutes} min{info.subject ? ` · ${subjectShort(info.subject, profile)}` : ''}</p>
    <p className="mt-1.5 text-[14px] font-semibold leading-snug">Nice work. {info.goal ? 'Did you reach your goal?' : 'What next?'}</p>
    {info.goal && <>
      <p className="mt-0.5 text-[12px] leading-snug text-muted">{info.goal}</p>
      <div className="mt-2.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Goal outcome">
        {([['yes', 'Yes'], ['partly', 'Partly'], ['no', 'Not yet']] as const).map(([id, name]) => <button key={id} type="button" role="radio" aria-checked={outcome === id} onClick={() => setOutcome(id)} data-testid={`wrap-${id}`} className={chip(outcome === id)}>{name}</button>)}
      </div></>}
    {x.rate && <div className="mt-3"><p className="text-[11px] font-semibold text-muted">How focused did you feel?</p>
      <div className="mt-1.5 flex gap-1.5" role="radiogroup" aria-label="Focus rating">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} onClick={() => setRating(n)} data-testid={`wrap-rate-${n}`} className={`h-8 w-8 rounded-full border text-[12px] font-semibold ${rating === n ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>{n}</button>)}</div></div>}
    {x.reviewLater && label && <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] leading-snug"><input type="checkbox" className="mt-0.5" checked={review} onChange={(e) => setReview(e.target.checked)} data-testid="wrap-review" /><span><span className="font-semibold">Remind me to review this</span> <span className="text-muted">after {x.reviewDays.join(', ')} days. Spaced review beats cramming.</span></span></label>}
    <p className="mt-3.5 text-[11px] font-semibold text-muted">What next?</p>
    <div className="mt-1.5 flex flex-wrap gap-2">
      {onBreak && <button type="button" className="studio-button !bg-ink !text-canvas" onClick={keepBreak} data-testid="wrap-break">Take the break</button>}
      {!onBreak && <button type="button" className="studio-button !bg-ink !text-canvas" onClick={keepBreak} data-testid="wrap-ok">Done</button>}
      <button type="button" className="studio-button" onClick={another} data-testid="wrap-another">{onBreak ? 'Skip the break' : 'Another block'}{info.goal ? ', same goal' : ''}</button>
      <button type="button" className="studio-button" onClick={fresh} data-testid="wrap-new">New goal</button>
      <button type="button" className="studio-button" onClick={finishDay} data-testid="wrap-finish">I am done for now</button>
    </div>
    {open > 0 && <p className="mt-2.5 text-[10px] text-muted">{open} to-do{open === 1 ? '' : 's'} still open.</p>}
  </motion.div>;
}

/** Mounted once. Shows the start question and the wrap-up when they are switched on. */
export function SessionFlow() {
  const [start, setStart] = useState<{ startAfter: boolean } | null>(null);
  const [wrap, setWrap] = useState<BlockEnd | null>(null);
  const [prefs] = usePrefs();
  const wrapOn = prefs.session.wrapUp;
  const t = useTimer();
  useEffect(() => onAskStart((startAfter) => setStart({ startAfter })), []);
  useEffect(() => onBlockEnd((info) => { if (wrapOn) setWrap(info); }), [wrapOn]);
  // A new block started by hand closes the old card.
  useEffect(() => { if (t.running && t.phase === 'focus') setWrap(null); }, [t.running, t.phase]);
  // Existing users: one note explaining that the app now starts with Essentials.
  useEffect(() => {
    if (prefs.essentialsSeen) return;
    setPrefs({ essentialsSeen: true });
    addNote({ kind: 'system', title: 'A calmer start', message: 'Study with Sarang now starts with Essentials: sound, a timer with a goal, and your progress. Everything else is one switch away: Settings > Advanced > Show everything.', key: 'essentials-2-1' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Reviews due today appear once a day in the notification list.
  useEffect(() => {
    tidyReviews();
    const n = dueReviews().length;
    if (n > 0 && prefs.session.reviewLater) addNote({ kind: 'reminder', title: `${n} review${n === 1 ? '' : 's'} due`, message: 'Start a block to review them. They are listed in the start question.', key: `reviews-${todayStr()}` });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>
    {createPortal(<AnimatePresence>{start && <StartDialog key="start" startAfter={start.startAfter} onClose={() => setStart(null)} />}</AnimatePresence>, document.body)}
    <AnimatePresence>{wrap && <WrapUp key={wrap.sessionId} info={wrap} onClose={() => setWrap(null)} />}</AnimatePresence>
  </>;
}
