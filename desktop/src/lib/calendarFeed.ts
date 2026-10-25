import { useSyncExternalStore } from 'react';
import { CloudError, cloudBase, cloudRest, getConfig, isSignedIn } from './cloud';
import { buildIcs, feedUrl, fingerprint, pushFeed, readFeedToken, removeFeed, rotateFeed, validToken, type CalendarSettings, type FeedDeps } from './calendar';
import type { SessionEntry } from './tracking';
import { examDate, subjectLabel, getProfile, curriculum } from './subjects';
import { randomToken } from './drift';

/** The state of your private calendar link on this device. The link itself lives in your cloud row, so every device shows the same one. */
export interface FeedState { token: string; hash: string; pushedAt: number; status: 'idle' | 'working' | 'ok' | 'error'; message: string; missing: boolean }
const KEY = 'study-with-sarang:calendar-feed';
const initial = (): FeedState => {
  try { const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<FeedState> | null; return { token: validToken(r?.token) ? r!.token! : '', hash: typeof r?.hash === 'string' ? r.hash : '', pushedAt: Number(r?.pushedAt) || 0, status: 'idle', message: '', missing: false }; } catch { return { token: '', hash: '', pushedAt: 0, status: 'idle', message: '', missing: false }; }
};
let state = initial();
const listeners = new Set<() => void>();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ token: state.token, hash: state.hash, pushedAt: state.pushedAt })); } catch { /* Kept for this visit. */ } };
const patch = (p: Partial<FeedState>) => { state = { ...state, ...p }; save(); listeners.forEach((fn) => fn()); };
export const getFeedState = () => state;
export const useFeedState = () => useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, getFeedState, getFeedState);
export const currentFeedUrl = () => (state.token && cloudBase() ? feedUrl(cloudBase(), state.token) : '');

function deps(): FeedDeps | null {
  const user = getConfig().session?.user.id; if (!user) return null;
  return { rest: cloudRest, userId: user, newToken: randomToken };
}
export function calendarText(sessions: SessionEntry[], opts: CalendarSettings, now = Date.now()): string {
  const profile = getProfile(); const date = examDate(profile);
  const season = curriculum(profile.curriculum).seasons.find((x) => x.id === profile.exam.season);
  const label = `Exams: ${curriculum(profile.curriculum).label}${season ? ` ${season.label}` : ''}${profile.exam.year ? ` ${profile.exam.year}` : ''}`;
  return buildIcs(sessions, opts, { now, subjectName: (id) => subjectLabel(id, profile), exam: date ? { date, label } : null });
}
const explain = (error: unknown) => (error instanceof CloudError ? error.message : 'Could not reach the calendar service.');

/** Brings the stored calendar up to date. Does nothing when nothing changed, or when you are not signed in. */
let busy = false;
export async function syncFeed(sessions: SessionEntry[], opts: CalendarSettings, force = false): Promise<void> {
  const d = deps(); if (!d || busy) return;
  const ics = calendarText(sessions, opts); const hash = fingerprint(ics);
  if (!force && hash === state.hash && state.token) return;
  busy = true; patch({ status: 'working', message: '' });
  try {
    const res = await pushFeed(ics, d, state.token || undefined);
    if (res.ok) patch({ token: res.token, hash, pushedAt: Date.now(), status: 'ok', message: '', missing: false });
    else patch({ status: 'error', message: res.message, missing: res.missing === true });
  } catch (error) { patch({ status: 'error', message: explain(error) }); } finally { busy = false; }
}
export async function refreshToken(): Promise<void> {
  const d = deps(); if (!d) return;
  try { const found = await readFeedToken(d); if ('error' in found) patch({ status: 'error', message: found.error, missing: found.missing === true }); else if (found.token) patch({ token: found.token, status: 'idle', message: '' }); } catch (error) { patch({ status: 'error', message: explain(error) }); }
}
export async function newLink(sessions: SessionEntry[], opts: CalendarSettings): Promise<void> {
  const d = deps(); if (!d) return;
  patch({ status: 'working' });
  try { const res = await rotateFeed(calendarText(sessions, opts), d); if (res.ok) patch({ token: res.token, hash: fingerprint(calendarText(sessions, opts)), pushedAt: Date.now(), status: 'ok', message: '' }); else patch({ status: 'error', message: res.message, missing: res.missing === true }); } catch (error) { patch({ status: 'error', message: explain(error) }); }
}
export async function stopSharing(): Promise<boolean> {
  const d = deps(); if (!d) { patch({ token: '', hash: '' }); return true; }
  try { const res = await removeFeed(d); if (res.ok) { patch({ token: '', hash: '', pushedAt: 0, status: 'idle', message: '' }); return true; } patch({ status: 'error', message: res.message }); } catch (error) { patch({ status: 'error', message: explain(error) }); }
  return false;
}
export const canShare = () => isSignedIn();
