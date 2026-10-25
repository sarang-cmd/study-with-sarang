import { useSyncExternalStore } from 'react';
/**
 * The session rhythm: a short question before a focus block (what for, how long), a short wrap-up after it (did it work, what next),
 * and a mindful idea for the break. Each part can be switched off on its own in Settings > Timer.
 * The study techniques below come from the learning research (Dunlosky et al. 2013 review of study techniques, Roediger and Karpicke 2006
 * on retrieval practice, Cepeda et al. 2006 on spacing): practice testing and spaced review help far more than re-reading.
 */
export interface SessionSettings {
  askStart: boolean;      // Ask for a goal and a length before a focus block starts
  askMinutes: boolean;    // ... including how long
  wrapUp: boolean;        // A short check-in after a block: goal reached? what next?
  rate: boolean;          // The wrap-up also asks how focused you felt (1 to 5)
  breakIdeas: boolean;    // Show a mindful idea during breaks
  breakNotify: boolean;   // Put the idea in the break notification too
  techniques: boolean;    // Offer study technique chips in the start question
  reviewLater: boolean;   // Offer to schedule reviews after a block
  reviewDays: number[];   // When: days after the block
}
export const defaultSession: SessionSettings = { askStart: true, askMinutes: true, wrapUp: true, rate: true, breakIdeas: true, breakNotify: true, techniques: true, reviewLater: true, reviewDays: [1, 3, 7] };
const flag = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
export function sanitizeSession(raw: unknown, base: SessionSettings = defaultSession): SessionSettings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const days = Array.isArray(r.reviewDays) ? [...new Set(r.reviewDays.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)).map((n) => Math.max(1, Math.min(90, Math.round(n)))))].sort((a, b) => a - b).slice(0, 5) : base.reviewDays;
  return {
    askStart: flag(r.askStart, base.askStart), askMinutes: flag(r.askMinutes, base.askMinutes), wrapUp: flag(r.wrapUp, base.wrapUp), rate: flag(r.rate, base.rate),
    breakIdeas: flag(r.breakIdeas, base.breakIdeas), breakNotify: flag(r.breakNotify, base.breakNotify), techniques: flag(r.techniques, base.techniques),
    reviewLater: flag(r.reviewLater, base.reviewLater), reviewDays: days.length ? days : base.reviewDays,
  };
}

// ---- study techniques ----------------------------------------------------------------------------------
export interface Technique { id: string; label: string; goal: string; why: string }
/** Goal starters. The "why" lines are what the research found, in plain words. */
export const TECHNIQUES: Technique[] = [
  { id: 'recall', label: 'Blank-page recall', goal: 'Write everything I remember about ', why: 'Close the book and write what you remember (blurting), then check the gaps. Practice testing rated "high utility" in the Dunlosky review; re-reading rated "low".' },
  { id: 'questions', label: 'Practice questions', goal: 'Do practice questions on ', why: 'Testing yourself beats rereading: Roediger and Karpicke (2006) found students who practised retrieval kept clearly more a week later.' },
  { id: 'teach', label: 'Explain it aloud', goal: 'Explain out loud, in plain words: ', why: 'The Feynman technique: if you cannot explain it simply, you have found what to study next.' },
  { id: 'past', label: 'Past paper, timed', goal: 'One past paper question under exam timing: ', why: 'Practising under exam conditions trains retrieval and pacing together.' },
  { id: 'mixed', label: 'Mix topics', goal: 'Mixed practice across topics: ', why: 'Interleaving (switching topics) feels harder but helps you choose the right method, not just run one.' },
  { id: 'fix', label: 'Fix my mistakes', goal: 'Redo the questions I got wrong in ', why: 'Errors you have found are the cheapest improvement: redo them without looking at the answer.' },
];

// ---- break ideas ---------------------------------------------------------------------------------------
export type BreakKind = 'eyes' | 'move' | 'breathe' | 'water' | 'reset' | 'outside' | 'rest';
export interface BreakIdea { id: string; kind: BreakKind; title: string; how: string; seconds: number; long?: boolean; breathe?: boolean }
export const BREAK_IDEAS: BreakIdea[] = [
  { id: 'eyes', kind: 'eyes', title: 'Look far away', how: 'Look at something about 6 metres (20 feet) away for 20 seconds. Let your eyes soften. (The 20-20-20 habit.)', seconds: 30 },
  { id: 'window', kind: 'eyes', title: 'Watch the sky', how: 'Look out of a window and name three things you can see. No phone.', seconds: 60 },
  { id: 'breathe', kind: 'breathe', title: 'Four slow breaths', how: 'Breathe in for 4, out for 6, four times. Let your shoulders drop on every out-breath.', seconds: 60, breathe: true },
  { id: 'water', kind: 'water', title: 'Drink some water', how: 'Fill your glass and drink it slowly. Sit back, no screen while you do.', seconds: 90 },
  { id: 'stretch', kind: 'move', title: 'Stretch your neck and back', how: 'Roll your shoulders, turn your head slowly each way, reach up and stretch tall.', seconds: 90 },
  { id: 'stand', kind: 'move', title: 'Stand up and move', how: 'Stand, walk to the next room and back, shake out your hands.', seconds: 120 },
  { id: 'eyesclosed', kind: 'rest', title: 'Close your eyes', how: 'Close your eyes for a minute. Notice sounds, then your breathing.', seconds: 60 },
  { id: 'tidy', kind: 'reset', title: 'Tidy one small thing', how: 'Clear a corner of your desk. A tidy space is a calmer start for the next block.', seconds: 120 },
  { id: 'plan', kind: 'reset', title: 'Name your next step', how: 'Write one line: what is the very first thing you will do after this break?', seconds: 60 },
  { id: 'walk', kind: 'outside', title: 'Take a short walk', how: 'Walk around the block or up and down the stairs. A change of scene resets your head.', seconds: 600, long: true },
  { id: 'air', kind: 'outside', title: 'Fresh air', how: 'Step outside or open a window. Feel the temperature and look at the horizon.', seconds: 300, long: true },
  { id: 'snack', kind: 'water', title: 'Eat something real', how: 'Have a proper snack and a drink away from your desk. Fruit, nuts or bread beat sweets.', seconds: 600, long: true },
  { id: 'song', kind: 'rest', title: 'Listen to one song', how: 'Put on one song you love, and only listen. Then stop.', seconds: 240, long: true },
];
/** An idea that fits the break (short breaks get short ideas, long breaks may use all) and is not the one just shown. */
export function pickBreakIdea(breakMinutes: number, avoid = '', rnd: () => number = Math.random, disabled: BreakKind[] = []): BreakIdea {
  const fits = BREAK_IDEAS.filter((i) => !disabled.includes(i.kind) && (i.long ? breakMinutes >= 10 : i.seconds <= Math.max(60, breakMinutes * 60 * .6)));
  const pool = fits.filter((i) => i.id !== avoid);
  const list = pool.length ? pool : fits.length ? fits : BREAK_IDEAS;
  return list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
}
export const BREAK_REMINDER = 'Try to avoid scrolling during a break: it keeps your brain busy and the next block starts tired.';

// ---- focus length presets ------------------------------------------------------------------------------
export interface LengthPreset { id: string; label: string; focusMin: number; shortMin: number; longMin: number; cycles: number; blurb: string }
export const LENGTH_PRESETS: LengthPreset[] = [
  { id: 'classic', label: '25 / 5 (classic Pomodoro)', focusMin: 25, shortMin: 5, longMin: 20, cycles: 4, blurb: 'The common starting point. Good for tasks you are reluctant to start.' },
  { id: 'long', label: '50 / 10', focusMin: 50, shortMin: 10, longMin: 25, cycles: 3, blurb: 'Longer blocks for problem sets and writing once you can settle quickly.' },
  { id: '5217', label: '52 / 17', focusMin: 52, shortMin: 17, longMin: 30, cycles: 3, blurb: 'The popular 52 minutes on, 17 off rhythm from workplace time tracking.' },
  { id: '9020', label: '90 / 20', focusMin: 90, shortMin: 20, longMin: 30, cycles: 2, blurb: 'One deep block, closer to a lecture. Take the break seriously.' },
];

export const MINUTE_CHOICES = [15, 25, 45, 60, 90];

// ---- the small bus between the timer and the dialogs -----------------------------------------------------
export interface BlockEnd { sessionId: string; seconds: number; goal: string; subject: string; task: string; mode: string }
const endFns = new Set<(info: BlockEnd) => void>();
export const onBlockEnd = (fn: (info: BlockEnd) => void) => { endFns.add(fn); return () => { endFns.delete(fn); }; };
export const emitBlockEnd = (info: BlockEnd) => endFns.forEach((fn) => fn(info));
const askFns = new Set<(startAfter: boolean) => void>();
export const onAskStart = (fn: (startAfter: boolean) => void) => { askFns.add(fn); return () => { askFns.delete(fn); }; };
export const hasAskListener = () => askFns.size > 0;
/** Open the start question. startAfter: pressing the main button also starts the timer (false: it only saves the goal and length). */
export const requestAskStart = (startAfter = true) => askFns.forEach((fn) => fn(startAfter));

// The break idea currently on show, shared by the timer card, the notification and the Zen view.
let idea: BreakIdea | null = null; let ideaMinutes = 5;
const ideaFns = new Set<() => void>();
const subIdea = (fn: () => void) => { ideaFns.add(fn); return () => { ideaFns.delete(fn); }; };
export const getBreakIdea = () => idea;
export const useBreakIdea = () => useSyncExternalStore(subIdea, getBreakIdea, getBreakIdea);
export function newBreakIdea(breakMinutes?: number, rnd?: () => number): BreakIdea {
  if (breakMinutes) ideaMinutes = breakMinutes;
  idea = pickBreakIdea(ideaMinutes, idea?.id ?? '', rnd); ideaFns.forEach((fn) => fn()); return idea;
}
export function clearBreakIdea() { if (idea) { idea = null; ideaFns.forEach((fn) => fn()); } }
