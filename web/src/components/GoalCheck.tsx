import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Target, X } from 'lucide-react';
import { useTimer } from '../context/TimerContext';
import { setPending, setPlan, usePending } from '../lib/plan';
import { addNote } from '../lib/notifications';
import { subjectShort, useProfile } from '../lib/subjects';
import { notify } from './ui/toast';

/** After a block that had a goal: did you get there? One tap, and it is saved with the block. */
export function GoalCheck() {
  const pending = usePending(); const { setGoalOutcome } = useTimer(); const profile = useProfile(); const reduce = useReducedMotion();
  const answer = (outcome: 'yes' | 'partly' | 'no' | '') => {
    if (!pending) return;
    if (outcome) setGoalOutcome(pending.sessionId, outcome);
    if (outcome === 'yes') {
      setPlan({ goal: '' });
      addNote({ kind: 'goal', title: 'Goal reached', message: `${pending.goal}${pending.subject ? ` (${subjectShort(pending.subject, profile)})` : ''}`, key: `goal-${pending.sessionId}` });
      notify({ title: 'Goal reached', message: pending.goal, variant: 'success', kind: 'goal', record: false, duration: 3500 });
    }
    setPending(null);
  };
  return <AnimatePresence>{pending && <motion.div key={pending.sessionId} role="dialog" aria-label="Did you reach your goal?" data-testid="goal-check" initial={reduce ? false : { y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
    className="fixed bottom-4 left-4 z-[120] w-[min(360px,calc(100vw-32px))] rounded-2xl border border-ink bg-canvas p-4 shadow-float">
    <button type="button" onClick={() => answer('')} aria-label="Ask me later" className="absolute right-2.5 top-2.5 rounded-md p-1 text-muted hover:text-ink"><X size={13} /></button>
    <p className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-muted"><Target size={11} /> Block logged · {pending.minutes} min</p>
    <p className="mt-1.5 text-[13px] font-semibold leading-snug">Did you reach your goal?</p>
    <p className="mt-0.5 text-[12px] leading-snug text-muted">{pending.goal}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="studio-button !bg-ink !text-canvas" onClick={() => answer('yes')}>Yes</button>
      <button type="button" className="studio-button" onClick={() => answer('partly')}>Partly</button>
      <button type="button" className="studio-button" onClick={() => answer('no')}>Not yet</button>
    </div>
  </motion.div>}</AnimatePresence>;
}
