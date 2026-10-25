/** The first-run tour: when to show it, and what it remembers. Re-runnable from Settings, About. */
export const TOUR_KEY = 'study-with-sarang:tutorial';
export const TOUR_VERSION = 2;
const EVENT = 'swa-tour';
export interface TourState { version: number; done: boolean; skipped: boolean; at: string }

export function readTour(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): TourState | null {
  try { const r = JSON.parse(storage?.getItem(TOUR_KEY) ?? 'null'); return r && typeof r === 'object' ? { version: Number(r.version) || 1, done: r.done === true, skipped: r.skipped === true, at: String(r.at ?? '') } : null; } catch { return null; }
}
export function writeTour(state: { done: boolean; skipped: boolean }, storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage) {
  try { storage?.setItem(TOUR_KEY, JSON.stringify({ version: TOUR_VERSION, ...state, at: new Date().toISOString() })); } catch { /* shown again next time */ }
}
/** Show it by itself once per tour version, never when a test or a link says not to. */
export function shouldAutoOpen(seen: TourState | null, off: boolean): boolean { return !off && (!seen || seen.version < TOUR_VERSION); }
/** An existing user (they already have data) gets "what's new" wording instead of "welcome". */
export function isReturning(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): boolean {
  const filled = (key: string) => { try { const v = JSON.parse(storage?.getItem(key) ?? 'null'); return Array.isArray(v) && v.length > 0; } catch { return false; } };
  return filled('study-with-sarang:sessions') || filled('study-with-sarang:mixes');
}
export const openTour = (step = 0) => window.dispatchEvent(new CustomEvent(EVENT, { detail: { step } }));
export const TOUR_EVENT = EVENT;
