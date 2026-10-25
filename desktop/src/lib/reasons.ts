/** Your own reason for studying, and the questions that help you find it. Stored on this device only. */
import { useSyncExternalStore } from 'react';

export const WHY_KEY = 'study-with-sarang:why';
let why = ''; try { if (typeof localStorage !== 'undefined') why = String(localStorage.getItem(WHY_KEY) ?? '').slice(0, 240); } catch { /* none yet */ }
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getWhy = () => why;
export const useWhy = () => useSyncExternalStore(subscribe, getWhy, getWhy);
export function setWhy(text: string) { why = text.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 240); try { localStorage.setItem(WHY_KEY, why); } catch { /* kept for this visit */ } listeners.forEach((fn) => fn()); }

/** Socratic questions: each one narrows a vague wish into a first step you chose yourself. The answer can become your goal. */
export interface Question { id: string; ask: string; why: string; starter: string }
export const QUESTIONS: Question[] = [
  { id: 'outcome', ask: 'When this block ends, what will exist that does not exist now?', why: 'A finished thing is easier to aim at than "study".', starter: 'Finish ' },
  { id: 'first', ask: 'What is the smallest first step you could take in the next two minutes?', why: 'Starting is the hard part. A tiny step makes it cheap.', starter: 'Open ' },
  { id: 'measure', ask: 'How will you know it went well?', why: 'A clear test lets you stop, and lets you feel progress.', starter: 'Do ' },
  { id: 'obstacle', ask: 'What usually pulls you away, and what will you do instead when it happens?', why: 'An if-then plan decided in advance beats willpower in the moment.', starter: 'If I get pulled away, I will ' },
  { id: 'enough', ask: 'If you only managed ten minutes, what would still count?', why: 'It lowers the bar for starting and keeps a bad day from becoming a lost day.', starter: 'Ten minutes: ' },
  { id: 'friend', ask: 'What would you tell a friend in your position?', why: 'Advice we give others is often kinder and more practical than what we tell ourselves.', starter: '' },
];
export const questionFor = (day = new Date()) => QUESTIONS[Math.floor(day.getTime() / 86_400_000) % QUESTIONS.length];

/** The three kinds of reason, after Aristotle: why you can trust it (ethos), why it makes sense (logos) and why it matters to you (pathos). */
export type Appeal = 'ethos' | 'logos' | 'pathos';
export const APPEALS: { id: Appeal; name: string; line: string }[] = [
  { id: 'ethos', name: 'Ethos', line: 'Why you can trust it' },
  { id: 'logos', name: 'Logos', line: 'Why it makes sense' },
  { id: 'pathos', name: 'Pathos', line: 'Why it matters to you' },
];
