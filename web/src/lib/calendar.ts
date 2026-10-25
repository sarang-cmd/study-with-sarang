/**
 * Your study blocks as a calendar. Builds a standard .ics file (what Google Calendar, Apple Calendar, Outlook and
 * Thunderbird all read) from your logged sessions. You can download it any time with no account, or, when you are
 * signed in to cloud sync, keep a private link that calendar apps subscribe to and that is refreshed after every block.
 * Pure functions only, so the whole file format is tested without a browser.
 */
import type { SessionEntry } from './tracking';

export interface CalendarSettings {
  enabled: boolean;          // Keep the private link up to date (needs cloud sync)
  title: 'subject' | 'generic'; // "Studied Physics HL" or just "Study block"
  includeGoal: boolean;      // The goal you set, and whether you reached it, in the details
  includeTask: boolean;      // The task name in the details
  includeStats: boolean;     // Distractions and the sound mix in the details
  minMinutes: number;        // Blocks shorter than this are left out
  days: number;              // How far back the calendar reaches
  exams: boolean;            // Your exam date as an all-day event
  busy: boolean;             // Show as busy (blocks other bookings) or free
}
export const defaultCalendar: CalendarSettings = { enabled: false, title: 'subject', includeGoal: false, includeTask: false, includeStats: false, minMinutes: 5, days: 120, exams: true, busy: false };

const flag = (v: unknown, f: boolean) => (typeof v === 'boolean' ? v : f);
const num = (v: unknown, f: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : f);
export function sanitizeCalendar(raw: unknown): CalendarSettings {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const d = defaultCalendar;
  return { enabled: flag(r.enabled, d.enabled), title: r.title === 'generic' ? 'generic' : 'subject', includeGoal: flag(r.includeGoal, d.includeGoal), includeTask: flag(r.includeTask, d.includeTask), includeStats: flag(r.includeStats, d.includeStats), minMinutes: num(r.minMinutes, d.minMinutes, 1, 120), days: num(r.days, d.days, 7, 365), exams: flag(r.exams, d.exams), busy: flag(r.busy, d.busy) };
}

export const MAX_EVENTS = 800;
const pad = (n: number) => String(n).padStart(2, '0');
export const icsUtc = (ms: number) => { const d = new Date(ms); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`; };
export const icsDate = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
/** Text values: backslash, semicolon, comma and line breaks are escaped; control characters dropped. */
export const icsEscape = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
/** Lines longer than 75 bytes are folded (a CRLF and a space), never in the middle of a character. */
export function icsFold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = []; let current = ''; let bytes = 0; let limit = 75;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    if (bytes + size > limit) { parts.push(current); current = ch; bytes = size; limit = 74; } else { current += ch; bytes += size; }
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export interface CalendarContext {
  now: number;
  subjectName: (id: string) => string;   // "Physics HL" for an id
  exam: { date: Date; label: string } | null;
}

export function sessionEvent(s: SessionEntry, opts: CalendarSettings, ctx: CalendarContext): string[] | null {
  const start = Date.parse(s.startedAt); if (!Number.isFinite(start)) return null;
  const end = start + Math.max(1, s.seconds) * 1000;
  const subject = s.subject ? ctx.subjectName(s.subject) : '';
  const summary = opts.title === 'subject' && subject ? `Studied ${subject}` : 'Study block';
  const lines: string[] = [];
  const mins = Math.max(1, Math.round(s.seconds / 60));
  lines.push(`${mins} min of ${s.mode === 'stopwatch' ? 'free-running study' : s.mode === 'countdown' ? 'countdown' : 'focus'}${s.completed ? '' : ' (stopped early)'}`);
  if (opts.includeGoal && s.goal) lines.push(`Goal: ${s.goal}${s.goalMet === 'yes' ? ' (reached)' : s.goalMet === 'partly' ? ' (partly reached)' : s.goalMet === 'no' ? ' (not reached)' : ''}`);
  if (opts.includeTask && s.task) lines.push(`Task: ${s.task}`);
  if (opts.includeStats) { lines.push(`Distractions: ${s.distractions}`); if (s.mixName) lines.push(`Sound: ${s.mixName}`); }
  return ['BEGIN:VEVENT', `UID:${s.id.replace(/[^A-Za-z0-9_-]/g, '')}@study-with-sarang`, `DTSTAMP:${icsUtc(end)}`, `DTSTART:${icsUtc(start)}`, `DTEND:${icsUtc(end)}`, `SUMMARY:${icsEscape(summary)}`, `DESCRIPTION:${icsEscape(lines.join('\n'))}`, 'CATEGORIES:Study', `TRANSP:${opts.busy ? 'OPAQUE' : 'TRANSPARENT'}`, 'END:VEVENT'];
}

export function buildIcs(sessions: SessionEntry[], opts: CalendarSettings, ctx: CalendarContext): string {
  const since = ctx.now - opts.days * 86_400_000;
  const kept = sessions.filter((s) => s.seconds >= opts.minMinutes * 60 && Date.parse(s.startedAt) >= since).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)).slice(-MAX_EVENTS);
  const out: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Study with Sarang//Study blocks//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Study with Sarang', 'X-WR-CALDESC:Your study blocks, made by the Study with Sarang app.', 'X-PUBLISHED-TTL:PT1H', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H'];
  for (const s of kept) { const ev = sessionEvent(s, opts, ctx); if (ev) out.push(...ev); }
  if (opts.exams && ctx.exam) {
    const next = new Date(ctx.exam.date.getFullYear(), ctx.exam.date.getMonth(), ctx.exam.date.getDate() + 1);
    out.push('BEGIN:VEVENT', `UID:exam-${icsDate(ctx.exam.date)}@study-with-sarang`, `DTSTAMP:${icsUtc(Date.UTC(ctx.exam.date.getFullYear(), 0, 1))}`, `DTSTART;VALUE=DATE:${icsDate(ctx.exam.date)}`, `DTEND;VALUE=DATE:${icsDate(next)}`, `SUMMARY:${icsEscape(ctx.exam.label)}`, 'CATEGORIES:Study', 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  out.push('END:VCALENDAR');
  return `${out.map(icsFold).join('\r\n')}\r\n`;
}

/** A short fingerprint, so a push happens only when the calendar really changed. */
export function fingerprint(text: string): string { let h = 2166136261; for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

export const FEED_PATH = '/functions/v1/calendar-feed';
export const feedUrl = (base: string, token: string) => `${base.replace(/\/+$/, '')}${FEED_PATH}?t=${token}`;
export const webcalUrl = (https: string) => https.replace(/^https?:/, "webcal:");
export const googleAddUrl = (https: string) => `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(webcalUrl(https))}`;
export const validToken = (t: unknown): t is string => typeof t === 'string' && /^[a-f0-9]{32,64}$/.test(t);

// ---------------------------------------------------------------------------------------------- the private link
export interface Rest { (path: string, init?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<{ status: number; body: unknown }> }
export interface FeedDeps { rest: Rest; userId: string; newToken: () => string }
export type FeedResult = { ok: true; token: string; created: boolean } | { ok: false; message: string; missing?: boolean };

const failText = (status: number, body: unknown, fallback: string) => {
  const text = body && typeof body === 'object' ? String((body as Record<string, unknown>).message ?? '') : '';
  if (status === 404 || /calendar_feeds|schema cache|does not exist/i.test(text)) return { ok: false as const, missing: true, message: 'The calendar table is missing. Run supabase/calendar.sql in your project (see the guide).' };
  return { ok: false as const, message: text || fallback };
};

/** The token of your private link, or null when you have none yet. */
export async function readFeedToken(deps: FeedDeps): Promise<{ token: string | null } | { error: string; missing?: boolean }> {
  const res = await deps.rest(`/rest/v1/calendar_feeds?select=token&user_id=eq.${deps.userId}`);
  if (res.status !== 200 || !Array.isArray(res.body)) { const f = failText(res.status, res.body, 'Could not read the calendar link.'); return { error: f.message, missing: f.missing }; }
  const row = res.body[0] as { token?: unknown } | undefined;
  return { token: row && validToken(row.token) ? row.token : null };
}

/** Saves the calendar text. Creates the private link the first time; later pushes never change the link, so two devices agree. */
export async function pushFeed(ics: string, deps: FeedDeps, preferred?: string): Promise<FeedResult> {
  const found = await readFeedToken(deps);
  if ('error' in found) return { ok: false, message: found.error, missing: found.missing };
  const now = new Date().toISOString();
  if (found.token) {
    const res = await deps.rest(`/rest/v1/calendar_feeds?user_id=eq.${deps.userId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ics, updated_at: now }) });
    if (res.status >= 400) return failText(res.status, res.body, 'Could not update the calendar.');
    return { ok: true, token: found.token, created: false };
  }
  const token = preferred && validToken(preferred) ? preferred : deps.newToken();
  const res = await deps.rest('/rest/v1/calendar_feeds', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: deps.userId, token, ics, updated_at: now }) });
  if (res.status >= 400) return failText(res.status, res.body, 'Could not create the calendar link.');
  return { ok: true, token, created: true };
}
/** A new link; the old one stops working at once. */
export async function rotateFeed(ics: string, deps: FeedDeps): Promise<FeedResult> {
  const token = deps.newToken();
  const found = await readFeedToken(deps);
  if ('error' in found) return { ok: false, message: found.error, missing: found.missing };
  const res = found.token
    ? await deps.rest(`/rest/v1/calendar_feeds?user_id=eq.${deps.userId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ token, ics, updated_at: new Date().toISOString() }) })
    : await deps.rest('/rest/v1/calendar_feeds', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: deps.userId, token, ics, updated_at: new Date().toISOString() }) });
  if (res.status >= 400) return failText(res.status, res.body, 'Could not make a new link.');
  return { ok: true, token, created: !found.token };
}
/** Stops sharing: the link and the stored calendar are deleted. */
export async function removeFeed(deps: FeedDeps): Promise<{ ok: boolean; message: string }> {
  const res = await deps.rest(`/rest/v1/calendar_feeds?user_id=eq.${deps.userId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  return res.status >= 400 ? { ok: false, message: 'Could not delete the link.' } : { ok: true, message: '' };
}
