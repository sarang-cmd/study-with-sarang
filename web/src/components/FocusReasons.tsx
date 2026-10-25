import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Heart, Lightbulb, Scale, ShieldCheck } from 'lucide-react';
import { APPEALS, QUESTIONS, questionFor, setWhy, useWhy, type Appeal } from '../lib/reasons';
import { countdownLabel, daysUntil, examDate, useProfile } from '../lib/subjects';
import { setPlan, usePlan } from '../lib/plan';
import { formatDuration } from '../lib/tracking';
import { useTimer } from '../context/TimerContext';
import { useDesktop } from '../context/DesktopContext';
import { notify } from './ui/toast';

const ICON = { ethos: ShieldCheck, logos: Scale, pathos: Heart } as const;
// Triangle corners in a 300 x 240 box: logos top, ethos bottom left, pathos bottom right.
const POS: Record<Appeal, { x: number; y: number }> = { logos: { x: 150, y: 34 }, ethos: { x: 44, y: 196 }, pathos: { x: 256, y: 196 } };

/**
 * "The case for starting": three kinds of reason (ethos, logos, pathos) and a short Socratic conversation with yourself.
 * Meant to persuade you only with true things, and to leave the decision with you.
 */
export function FocusReasons() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<Appeal>('logos');
  const why = useWhy(); const plan = usePlan(); const profile = useProfile();
  const { sessions } = useTimer(); const { run } = useDesktop();
  const [qIndex, setQIndex] = useState(() => QUESTIONS.indexOf(questionFor()));
  const q = QUESTIONS[qIndex]; const [answer, setAnswer] = useState('');
  const own = useMemo(() => {
    const done = sessions.filter((s) => s.seconds >= 300); const total = done.reduce((sum, s) => sum + s.seconds, 0);
    const week = done.filter((s) => Date.now() - new Date(s.startedAt).getTime() < 7 * 86_400_000);
    const withGoal = done.filter((s) => s.goal && s.goalMet); return { count: done.length, total, week: week.length, met: withGoal.length };
  }, [sessions]);
  const days = daysUntil(examDate(profile));
  const accept = (useAsGoal: boolean, start: boolean) => {
    const text = answer.trim(); if (!text) return;
    if (useAsGoal) { setPlan({ goal: text.slice(0, 140) }); notify({ message: 'That is now your goal for the next block', variant: 'success', duration: 2200 }); }
    if (start) run('timer.start');
    setAnswer('');
  };
  return <section id="reasons" aria-labelledby="reasons-heading" data-testid="focus-reasons" className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7">
    <p className="section-label mb-3">The case for starting</p>
    <h2 id="reasons-heading" className="text-[26px] font-semibold leading-tight tracking-tight">Three reasons, one question<span className="text-faint">.</span></h2>
    <p className="mt-2 max-w-[640px] text-[12px] leading-relaxed text-muted">A good argument rests on three things: whether you can trust it (ethos), whether it makes sense (logos) and whether it matters to you (pathos). Here they are, honestly. Then a question to answer for yourself. The decision is always yours.</p>
    <div className="mt-6 grid items-center gap-6 md:grid-cols-[300px_1fr]">
      <svg viewBox="0 0 300 262" role="group" aria-label="The three kinds of reason" className="mx-auto w-full max-w-[300px]">
        <motion.polygon points={`${POS.logos.x},${POS.logos.y} ${POS.pathos.x},${POS.pathos.y} ${POS.ethos.x},${POS.ethos.y}`} fill="none" stroke="currentColor" strokeWidth="1.2" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} className="text-line" style={{ stroke: 'currentColor', opacity: .35 }} />
        {APPEALS.map((a) => { const p = POS[a.id]; const Icon = ICON[a.id]; const on = open === a.id; return <g key={a.id} transform={`translate(${p.x} ${p.y})`}>
          <motion.circle r={on ? 30 : 26} fill={on ? 'currentColor' : 'transparent'} stroke="currentColor" strokeWidth="1.4" animate={{ r: on ? 30 : 26 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className={on ? 'text-ink' : 'text-ink/60'} />
          <foreignObject x="-14" y="-14" width="28" height="28" pointerEvents="none"><div className={`grid h-7 w-7 place-items-center ${on ? 'text-canvas' : 'text-ink'}`}><Icon size={16} /></div></foreignObject>
          <text y={a.id === 'logos' ? -38 : 46} textAnchor="middle" className="fill-current text-[11px] font-semibold text-ink">{a.name}</text>
        </g>; })}
      </svg>
      <div>
        <div role="tablist" aria-label="Kinds of reason" className="flex flex-wrap gap-2">
          {APPEALS.map((a) => <button key={a.id} role="tab" id={`tab-${a.id}`} aria-selected={open === a.id} aria-controls={`panel-${a.id}`} data-testid={`appeal-${a.id}`} type="button" onClick={() => setOpen(a.id)} className={`rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${open === a.id ? 'border-ink bg-ink text-canvas' : 'border-line hover:border-ink'}`}>{a.name}: {a.line}</button>)}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={open} role="tabpanel" id={`panel-${open}`} aria-labelledby={`tab-${open}`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }} transition={{ duration: .18 }} className="mt-4 text-[12.5px] leading-[1.75]">
            {open === 'ethos' && <div className="grid gap-2">
              <p><strong>Trust, earned honestly.</strong> This app makes no promise about grades. The sound mixes are not tested for effects on the brain, the study videos come from other people, and the research notes say where the evidence stops. Your own record is the best evidence you can get.</p>
              <p className="rounded-xl border border-line bg-canvas px-3.5 py-3" data-testid="own-record">{own.count ? <>Your record: <strong>{own.count}</strong> block{own.count === 1 ? '' : 's'} of five minutes or more, <strong>{formatDuration(own.total)}</strong> in total, <strong>{own.week}</strong> in the last 7 days{own.met ? <>, and you reached your goal in <strong>{own.met}</strong></> : ''}.</> : 'Your record starts with your first block. After a few, this shows what you actually did, which is more convincing than anything we could say.'}</p>
            </div>}
            {open === 'logos' && <div className="grid gap-2">
              <p><strong>The reasoning.</strong> Three ideas with a good evidence base behind them:</p>
              <ul className="grid gap-1.5 pl-1">
                <li><strong>A specific goal beats "do your best".</strong> Goal-setting research (Locke and Latham) keeps finding that clear, reachable goals lead to better performance than vague ones.</li>
                <li><strong>An if-then plan beats good intentions.</strong> Deciding in advance "if X happens, I will do Y" (implementation intentions, Gollwitzer) helps people follow through.</li>
                <li><strong>Starting is the costly part.</strong> A short, bounded block with an end in sight makes starting cheaper. Nothing magic about 25 minutes: pick the length that works for you.</li>
              </ul>
              <p className="text-muted">These are findings about groups of people. They may or may not hold for you, so test them with your own blocks.</p>
            </div>}
            {open === 'pathos' && <div className="grid gap-2">
              <p><strong>What it is for.</strong> Effort is easier when it points at something you care about.</p>
              {days !== null && <p className="rounded-xl border border-line bg-canvas px-3.5 py-3"><strong>{countdownLabel(days)}</strong> until your exams. Each block is a small share of that.</p>}
              <label className="block text-[11px] font-semibold">In one sentence, why does this matter to you?
                <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={240} placeholder="For example: so I can study medicine, or so I stop dreading Sunday nights" data-testid="why-input" className="field mt-1 w-full text-[12.5px] font-normal" /></label>
              <p className="text-[11px] text-muted">Only you see this. It stays on this device.</p>
            </div>}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>

    <div className="mt-7 rounded-2xl border border-ink/30 p-5" data-testid="socratic">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted"><Lightbulb size={13} /> A question for you</p>
      <p className="mt-2 text-[17px] font-semibold leading-snug tracking-tight" data-testid="socratic-question">{q.ask}</p>
      <p className="mt-1 text-[11.5px] text-muted">{q.why}</p>
      <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} maxLength={140} placeholder={q.starter ? `${q.starter}...` : 'Write what you would say'} aria-label="Your answer" data-testid="socratic-answer" className="field mt-3 w-full resize-none text-[12.5px]" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="studio-button" disabled={!answer.trim()} onClick={() => accept(true, false)} data-testid="socratic-goal">Use it as my goal</button>
        <button type="button" className="studio-button !bg-ink !text-canvas disabled:opacity-40" disabled={!answer.trim()} onClick={() => accept(true, true)} data-testid="socratic-start">Use it and start the timer <ArrowRight size={13} /></button>
        <button type="button" className="ml-auto text-[11px] text-muted underline" onClick={() => { setQIndex((qIndex + 1) % QUESTIONS.length); setAnswer(''); }} data-testid="socratic-next">Ask me another</button>
      </div>
      {plan.goal && <p className="mt-3 text-[11px] text-muted">Current goal: {plan.goal}</p>}
    </div>
  </section>;
}
