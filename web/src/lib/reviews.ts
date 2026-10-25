import { useSyncExternalStore } from 'react';

/**
 * Spaced review: after a block you can ask for a reminder to look at the same topic again in a day, three days and a week.
 * Spreading practice out (spacing) is one of the best supported ways to remember things (Cepeda et al. 2006, 254 studies).
 * Reviews live on this device. They show up in the start question and as one daily note in the notification list.
 */
export interface Review { id: string; text: string; subject: string; due: string; created: string; done: boolean; step: number }
const KEY = 'study-with-sarang:reviews';
export const MAX_REVIEWS = 120;
const dayStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (from: Date, days: number) => { const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days, 12); return dayStr(d); };

export function sanitizeReviews(raw: unknown): Review[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>(); const out: Review[] = [];
  for (const item of raw.slice(0, MAX_REVIEWS)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.text !== 'string' || !r.text.trim() || typeof r.due !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.due) || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({ id: r.id.slice(0, 60), text: r.text.trim().slice(0, 140), subject: typeof r.subject === 'string' ? r.subject.slice(0, 80) : '', due: r.due, created: typeof r.created === 'string' ? r.created.slice(0, 30) : '', done: r.done === true, step: typeof r.step === 'number' ? Math.max(1, Math.min(9, Math.round(r.step))) : 1 });
  }
  return out;
}
let items: Review[] = [];
try { if (typeof localStorage !== 'undefined') items = sanitizeReviews(JSON.parse(localStorage.getItem(KEY) ?? '[]')); } catch { /* Start empty. */ }
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* Kept for this visit. */ } listeners.forEach((fn) => fn()); };
export const getReviews = () => items;
export const useReviews = () => useSyncExternalStore(subscribe, getReviews, getReviews);

let n = 0;
/** One reminder per chosen day. Returns how many were added. */
export function scheduleReviews(text: string, subject: string, days: number[], now = new Date()): number {
  const clean = text.trim().replace(/\s+/g, ' ').slice(0, 140);
  if (!clean || !days.length) return 0;
  // The same topic on the same day is not added twice.
  const added: Review[] = [];
  days.forEach((d, i) => {
    const due = addDays(now, d);
    if (items.some((r) => !r.done && r.text === clean && r.due === due)) return;
    added.push({ id: `${now.getTime().toString(36)}-${(n++).toString(36)}`, text: clean, subject, due, created: now.toISOString(), done: false, step: i + 1 });
  });
  if (!added.length) return 0;
  items = [...items, ...added].slice(-MAX_REVIEWS); save(); return added.length;
}
export const dueReviews = (today = dayStr(new Date()), list = items) => list.filter((r) => !r.done && r.due <= today).sort((a, b) => a.due.localeCompare(b.due));
export const upcomingReviews = (today = dayStr(new Date()), list = items) => list.filter((r) => !r.done && r.due > today).sort((a, b) => a.due.localeCompare(b.due));
export function completeReview(id: string) { items = items.map((r) => (r.id === id ? { ...r, done: true } : r)); save(); }
export function removeReview(id: string) { items = items.filter((r) => r.id !== id); save(); }
export function clearReviews() { items = []; save(); }
/** Done reviews older than a month are dropped so the list stays small. */
export function tidyReviews(today = new Date()) { const cut = addDays(today, -30); const next = items.filter((r) => !(r.done && r.due < cut)); if (next.length !== items.length) { items = next; save(); } }
export const todayStr = () => dayStr(new Date());
export function resetReviewsForTest() { items = []; save(); }
