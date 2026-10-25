/**
 * Optional Supabase sync. Off until the user signs in. Talks to the project's REST and Auth
 * endpoints directly with fetch, using only the public (anon or publishable) key. Row Level Security
 * on the `study_sync` table (supabase/schema.sql) keeps every user's row private.
 */
import { DEFAULT_SUPABASE_KEY, DEFAULT_SUPABASE_URL, WEB_URL } from './cloudDefaults';
import { SYNC_KEYS, mergeKey } from './syncMerge';

const CONFIG_KEY = 'study-with-sarang:cloud';
const META_KEY = 'study-with-sarang:cloud-meta';
export const CLOUD_EVENT = 'sws:cloud';
const TABLE = 'study_sync';
const TIMEOUT_MS = 12000;

export interface CloudUser { id: string; email: string }
export interface CloudSession { accessToken: string; refreshToken: string; expiresAt: number; user: CloudUser }
export interface CloudConfig { url: string; anonKey: string; auto: boolean; session: CloudSession | null; lastSync: number }
interface Meta { base: Record<string, string | null>; mod: Record<string, number>; rev: number }

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
export const BUILT_IN = { url: (env.VITE_SUPABASE_URL ?? '').trim() || DEFAULT_SUPABASE_URL, anonKey: (env.VITE_SUPABASE_ANON_KEY ?? '').trim() || DEFAULT_SUPABASE_KEY };

// ---- storage: raw access that bypasses the change tracker below ----------------------------------
const nativeSet = typeof Storage !== 'undefined' ? Storage.prototype.setItem : null;
const nativeRemove = typeof Storage !== 'undefined' ? Storage.prototype.removeItem : null;
const rawSet = (key: string, value: string) => { try { (nativeSet ?? localStorage.setItem).call(localStorage, key, value); } catch { /* Full or blocked. */ } };
const rawRemove = (key: string) => { try { (nativeRemove ?? localStorage.removeItem).call(localStorage, key); } catch { /* Ignore. */ } };
const rawGet = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };

export const emptyConfig = (): CloudConfig => ({ url: BUILT_IN.url, anonKey: BUILT_IN.anonKey, auto: true, session: null, lastSync: 0 });
export function readConfig(): CloudConfig {
  try {
    const raw = JSON.parse(rawGet(CONFIG_KEY) ?? 'null') as Partial<CloudConfig> | null;
    const base = emptyConfig();
    if (!raw || typeof raw !== 'object') return base;
    const s = raw.session;
    const session = s && typeof s === 'object' && typeof s.accessToken === 'string' && typeof s.refreshToken === 'string' && s.user && typeof s.user.id === 'string'
      ? { accessToken: s.accessToken, refreshToken: s.refreshToken, expiresAt: Number(s.expiresAt) || 0, user: { id: s.user.id, email: String(s.user.email ?? '') } } : null;
    return { url: typeof raw.url === 'string' && raw.url ? raw.url : base.url, anonKey: typeof raw.anonKey === 'string' && raw.anonKey ? raw.anonKey : base.anonKey, auto: raw.auto !== false, session, lastSync: Number(raw.lastSync) || 0 };
  } catch { return emptyConfig(); }
}
let config = readConfig();
export const getConfig = () => config;
function saveConfig(patch: Partial<CloudConfig>) {
  config = { ...config, ...patch };
  rawSet(CONFIG_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent(CLOUD_EVENT));
}
export const isSignedIn = () => Boolean(config.session);

function readMeta(): Meta {
  try {
    const raw = JSON.parse(rawGet(META_KEY) ?? 'null') as Partial<Meta> | null;
    return { base: raw?.base && typeof raw.base === 'object' ? raw.base : {}, mod: raw?.mod && typeof raw.mod === 'object' ? raw.mod : {}, rev: Number(raw?.rev) || 0 };
  } catch { return { base: {}, mod: {}, rev: 0 }; }
}
let meta = readMeta();
const saveMeta = () => rawSet(META_KEY, JSON.stringify(meta));

// ---- change tracking: remember when each synced key last changed on this device -------------------
const frozen = new Set<string>();
let trackerOn = false;
export function installTracker() {
  if (trackerOn || typeof Storage === 'undefined') return;
  trackerOn = true;
  const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (key: string, value: string) {
    if (this === localStorage && key in SYNC_KEYS) {
      if (frozen.has(key)) return; // A newer cloud copy is waiting for a reload; don't overwrite it with stale state.
      const before = this.getItem(key);
      set.call(this, key, value);
      if (before !== String(value)) touched(key);
      return;
    }
    set.call(this, key, value);
  };
  Storage.prototype.removeItem = function (key: string) {
    if (this === localStorage && key in SYNC_KEYS) {
      if (frozen.has(key)) return;
      const had = this.getItem(key) !== null;
      remove.call(this, key);
      if (had) touched(key);
      return;
    }
    remove.call(this, key);
  };
}
let dirtyTimer: ReturnType<typeof setTimeout> | undefined;
function touched(key: string) {
  meta.mod[key] = Date.now(); saveMeta();
  if (!config.session || !config.auto) return;
  clearTimeout(dirtyTimer);
  dirtyTimer = setTimeout(() => { void syncNow({ quiet: true }); }, 4000);
}
export const pendingReload = () => [...frozen];

// ---- validation ---------------------------------------------------------------------------------
export function normalizeUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch { return null; }
}
/** The key shipped in a client must be the public one. Refuse anything that looks like a secret. */
export function checkPublicKey(key: string): string | null {
  const text = key.trim();
  if (!text) return 'Paste the project\'s anon (public) key.';
  if (/^sb_secret_/i.test(text)) return 'That is a secret key. Use the anon / publishable key instead, and keep the secret one private.';
  if (text.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(text.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };
      if (payload.role === 'service_role') return 'That is the service-role key, which bypasses all security. Use the anon key instead.';
    } catch { return 'That does not look like a Supabase key.'; }
  } else if (!/^sb_publishable_/i.test(text)) return 'That does not look like a Supabase anon or publishable key.';
  return null;
}
export const configured = () => Boolean(normalizeUrl(config.url) && !checkPublicKey(config.anonKey));
export function setProject(url: string, anonKey: string): string | null {
  const origin = normalizeUrl(url);
  if (!origin) return 'Use the project URL, like https://abcd.supabase.co.';
  const problem = checkPublicKey(anonKey);
  if (problem) return problem;
  saveConfig({ url: origin, anonKey: anonKey.trim() });
  return null;
}
export const setAuto = (auto: boolean) => saveConfig({ auto });

// ---- http ---------------------------------------------------------------------------------------
export class CloudError extends Error { constructor(message: string, readonly status = 0) { super(message); } }
async function http(path: string, init: RequestInit & { token?: string } = {}): Promise<{ status: number; body: unknown }> {
  const base = normalizeUrl(config.url);
  if (!base) throw new CloudError('Add your Supabase project URL first.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Publishable keys (sb_publishable_...) are not JWTs, so they go in `apikey` only. A legacy anon key is a JWT and may also be the bearer.
    const bearer = init.token ?? (config.anonKey.split('.').length === 3 ? config.anonKey : undefined);
    const { token: _token, ...rest } = init; void _token;
    const response = await fetch(`${base}${path}`, {
      ...rest, signal: controller.signal, cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { apikey: config.anonKey, ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    });
    const text = await response.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { status: response.status, body };
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw new CloudError('The server took too long to answer.');
    throw new CloudError('Could not reach Supabase. Check your connection and the project URL.');
  } finally { clearTimeout(timer); }
}
function reason(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    const text = [o.msg, o.message, o.error_description, o.error].find((v) => typeof v === 'string') as string | undefined;
    if (text) {
      if (/invalid login/i.test(text)) return 'Wrong email or password.';
      if (/already registered|already been registered/i.test(text)) return 'That email already has an account. Sign in instead.';
      if (/relation .* does not exist|schema cache/i.test(text)) return `The ${TABLE} table is missing. Run supabase/schema.sql in your project.`;
      if (/email not confirmed/i.test(text)) return 'Confirm your email first. Use the Create account tab and the code from the email, or ask for a new one.';
      if (/rate limit|too many|security purposes/i.test(text)) return 'Too many emails were requested. Wait a minute and try again.';
      if (/token has expired|otp_expired|invalid/i.test(text) && /token|otp|code/i.test(text)) return 'That code did not work or has expired. Ask for a new one.';
      return text.slice(0, 200);
    }
  }
  return fallback;
}

// ---- auth ---------------------------------------------------------------------------------------
interface TokenBody { access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number; user?: { id?: string; email?: string } }
function adopt(body: unknown): CloudSession | null {
  const t = body as TokenBody | null;
  if (!t || typeof t.access_token !== 'string' || typeof t.refresh_token !== 'string' || !t.user?.id) return null;
  return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: (t.expires_at ?? Math.floor(Date.now() / 1000) + (t.expires_in ?? 3600)) * 1000, user: { id: t.user.id, email: t.user.email ?? '' } };
}
function begin(session: CloudSession) { meta = { base: {}, mod: meta.mod, rev: 0 }; saveMeta(); saveConfig({ session }); }
export async function signIn(email: string, password: string) {
  const { status, body } = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
  const session = status === 200 ? adopt(body) : null;
  if (!session) throw new CloudError(reason(body, 'Could not sign in.'), status);
  begin(session);
}
const PENDING_KEY = 'study-with-sarang:cloud-pending';
const PENDING_MS = 24 * 3600_000;
const setPending = (email: string) => rawSet(PENDING_KEY, JSON.stringify({ email: email.trim().toLowerCase(), at: Date.now() }));
function pendingEmail(): string | null {
  try { const p = JSON.parse(rawGet(PENDING_KEY) ?? 'null') as { email?: string; at?: number } | null; return p && typeof p.email === 'string' && Date.now() - Number(p.at) < PENDING_MS ? p.email : null; } catch { return null; }
}

/** Where a confirmation link should land. Only the hosted web app can receive one; the desktop app uses the emailed code. */
export function redirectTarget(): string {
  if (typeof location === 'undefined') return WEB_URL;
  const { protocol, hostname, origin, pathname } = location;
  if (!/^https?:$/.test(protocol)) return WEB_URL;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) return WEB_URL;
  return origin + pathname;
}
const withRedirect = (path: string) => { const to = redirectTarget(); return to ? `${path}${path.includes('?') ? '&' : '?'}redirect_to=${encodeURIComponent(to)}` : path; };

/** Returns 'signed-in', or 'confirm' when an emailed code is needed first. */
export async function signUp(email: string, password: string): Promise<'signed-in' | 'confirm'> {
  if (password.length < 8) throw new CloudError('Use a password of at least 8 characters.');
  const { status, body } = await http(withRedirect('/auth/v1/signup'), { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
  if (status >= 400) throw new CloudError(reason(body, 'Could not create the account.'), status);
  const session = adopt(body);
  if (session) { begin(session); return 'signed-in'; }
  setPending(email);
  return 'confirm';
}
/** Finishes sign-up with the 6 digit code from the confirmation email. */
export async function verifySignup(email: string, token: string) {
  const { status, body } = await http('/auth/v1/verify', { method: 'POST', body: JSON.stringify({ type: 'signup', email: email.trim(), token: token.trim() }) });
  const session = status === 200 ? adopt(body) : null;
  if (!session) throw new CloudError(reason(body, 'That code did not work or has expired. Ask for a new one.'), status);
  rawRemove(PENDING_KEY); begin(session);
}
export async function resendSignup(email: string) {
  const { status, body } = await http(withRedirect('/auth/v1/resend'), { method: 'POST', body: JSON.stringify({ type: 'signup', email: email.trim() }) });
  if (status >= 400) throw new CloudError(reason(body, 'Could not send a new code.'), status);
  setPending(email);
}

// ---- landing from an email link (web) -----------------------------------------------------------
export interface AuthNotice { kind: 'success' | 'error' | 'info'; title: string; message: string }
const NOTICE_EVENT = 'sws:auth-notice';
let notices: AuthNotice[] = [];
function announce(notice: AuthNotice) { notices.push(notice); if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(NOTICE_EVENT, { detail: notice })); }
/** Calls back for notices that already happened, then for new ones. */
export function onAuthNotice(callback: (notice: AuthNotice) => void): () => void {
  const pending = notices; notices = []; pending.forEach(callback);
  const listener = (event: Event) => { notices = notices.filter((n) => n !== (event as CustomEvent<AuthNotice>).detail); callback((event as CustomEvent<AuthNotice>).detail); };
  window.addEventListener(NOTICE_EVENT, listener);
  return () => window.removeEventListener(NOTICE_EVENT, listener);
}

/**
 * Supabase email links arrive as `#access_token=...&type=signup` (or `#error_description=...`). This removes that hash
 * from the address bar at once, so the token is never left in history or shared by accident, then finishes sign-in
 * only when it is safe: the token must be real (the server confirms it), of a sign-in kind, and belong to the address
 * that was just used here to create an account. Anything else only shows a message, which prevents a stranger's link
 * from signing you into their account.
 */
export function captureAuthHash(): Promise<void> {
  if (typeof location === 'undefined' || !/[#&](access_token|error_description|error_code)=/.test(location.hash)) return Promise.resolve();
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* Not critical. */ }
  const failure = params.get('error_description') ?? (params.get('error_code') ? 'The link did not work.' : null);
  if (failure) {
    const expired = /expired|invalid/i.test(`${failure} ${params.get('error_code') ?? ''}`);
    announce({ kind: 'error', title: 'That email link did not work', message: expired ? 'It may have expired or been opened already. Request a new code and use that instead.' : failure.replace(/\+/g, ' ').slice(0, 160) });
    return Promise.resolve();
  }
  const access = params.get('access_token') ?? '', refresh = params.get('refresh_token') ?? '', type = params.get('type') ?? '';
  if (!access || !refresh) return Promise.resolve();
  if (!['signup', 'magiclink', 'invite'].includes(type) || !configured()) { announce({ kind: 'info', title: 'Link opened', message: 'Sign in with your email and password to continue.' }); return Promise.resolve(); }
  return http('/auth/v1/user', { token: access }).then(({ status, body }) => {
    const user = status === 200 && body && typeof body === 'object' ? (body as { id?: string; email?: string }) : null;
    if (!user?.id) { announce({ kind: 'error', title: 'That email link did not work', message: 'It may have expired. Request a new code and use that instead.' }); return; }
    const email = String(user.email ?? '').toLowerCase();
    if (config.session) { announce({ kind: 'success', title: 'Email confirmed', message: 'You are already signed in.' }); return; }
    if (email && email === pendingEmail()) {
      const expires = Number(params.get('expires_at')) || Math.floor(Date.now() / 1000) + (Number(params.get('expires_in')) || 3600);
      rawRemove(PENDING_KEY); begin({ accessToken: access, refreshToken: refresh, expiresAt: expires * 1000, user: { id: user.id, email } });
      announce({ kind: 'success', title: 'Email confirmed', message: 'You are signed in. Your data will sync.' });
      void syncNow({ quiet: true }).catch(() => undefined);
    } else announce({ kind: 'success', title: 'Email confirmed', message: 'Now sign in with your email and password.' });
  }, () => announce({ kind: 'error', title: 'Could not finish', message: 'Check your connection, then sign in with your email and password.' }));
}
export async function sendCode(email: string) {
  const { status, body } = await http('/auth/v1/otp', { method: 'POST', body: JSON.stringify({ email: email.trim(), create_user: true }) });
  if (status >= 400) throw new CloudError(reason(body, 'Could not send the code.'), status);
}
export async function verifyCode(email: string, token: string) {
  const { status, body } = await http('/auth/v1/verify', { method: 'POST', body: JSON.stringify({ type: 'email', email: email.trim(), token: token.trim() }) });
  const session = status === 200 ? adopt(body) : null;
  if (!session) throw new CloudError(reason(body, 'That code did not work. Request a new one.'), status);
  begin(session);
}
export async function signOut() {
  const token = config.session?.accessToken;
  if (token) { try { await http('/auth/v1/logout', { method: 'POST', token }); } catch { /* Signing out locally is what matters. */ } }
  frozen.clear(); meta = { base: {}, mod: meta.mod, rev: 0 }; saveMeta();
  saveConfig({ session: null, lastSync: 0 });
}
async function token(): Promise<string> {
  const session = config.session;
  if (!session) throw new CloudError('Sign in first.');
  if (session.expiresAt - Date.now() > 60_000) return session.accessToken;
  const { status, body } = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refreshToken }) });
  const next = status === 200 ? adopt(body) : null;
  if (!next) { if (status >= 400 && status < 500) saveConfig({ session: null }); throw new CloudError('Your sign-in expired. Sign in again.', status); }
  saveConfig({ session: next });
  return next.accessToken;
}

// ---- sync ---------------------------------------------------------------------------------------
interface Snapshot { v: 1; keys: Record<string, { value: string | null; mod: number }> }
interface Row { data: Snapshot; rev: number }
const EMPTY: Snapshot = { v: 1, keys: {} };
async function fetchRow(): Promise<Row | null> {
  const t = await token();
  const { status, body } = await http(`/rest/v1/${TABLE}?select=data,rev&user_id=eq.${config.session!.user.id}`, { token: t });
  if (status !== 200 || !Array.isArray(body)) throw new CloudError(reason(body, 'Could not read your cloud copy.'), status);
  const row = body[0] as { data?: Snapshot; rev?: number } | undefined;
  if (!row) return null;
  const data = row.data && typeof row.data === 'object' && row.data.keys && typeof row.data.keys === 'object' ? row.data : EMPTY;
  return { data, rev: Number(row.rev) || 1 };
}
/** An authenticated call to the project's REST API for other features (the calendar link). Throws CloudError when not signed in. */
export async function cloudRest(path: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}): Promise<{ status: number; body: unknown }> {
  const t = await token();
  return http(path, { ...init, token: t });
}
export const cloudBase = () => normalizeUrl(config.url) ?? '';
/** false means someone else wrote first and the caller should merge again. */
async function pushRow(row: Row | null, data: Snapshot): Promise<boolean> {
  const t = await token();
  const user = config.session!.user.id;
  const headers = { Prefer: 'return=representation' };
  if (!row) {
    const { status, body } = await http(`/rest/v1/${TABLE}`, { method: 'POST', token: t, headers, body: JSON.stringify({ user_id: user, data, rev: 1 }) });
    if (status === 409) return false;
    if (status >= 400) throw new CloudError(reason(body, 'Could not save to the cloud.'), status);
    return true;
  }
  const { status, body } = await http(`/rest/v1/${TABLE}?user_id=eq.${user}&rev=eq.${row.rev}`, { method: 'PATCH', token: t, headers, body: JSON.stringify({ data, rev: row.rev + 1, updated_at: new Date().toISOString() }) });
  if (status >= 400) throw new CloudError(reason(body, 'Could not save to the cloud.'), status);
  return Array.isArray(body) && body.length > 0;
}

export type SyncMode = 'merge' | 'use-cloud' | 'use-device';
export interface SyncResult { pulled: string[]; pushed: boolean; at: number }
let running: Promise<SyncResult> | null = null;

export function syncNow(options: { mode?: SyncMode; quiet?: boolean } = {}): Promise<SyncResult> {
  if (running) return running;
  running = doSync(options.mode ?? 'merge').finally(() => { running = null; });
  if (options.quiet) running.catch(() => undefined);
  return running;
}
async function doSync(mode: SyncMode): Promise<SyncResult> {
  if (!config.session) throw new CloudError('Sign in first.');
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await fetchRow();
    const remote = row?.data ?? EMPTY;
    const outgoing: Snapshot = { v: 1, keys: {} };
    const apply: Record<string, string | null> = {};
    const nextBase: Record<string, string | null> = {};
    for (const [key, spec] of Object.entries(SYNC_KEYS)) {
      const local = rawGet(key);
      const theirs = remote.keys[key]?.value ?? null;
      const localMod = meta.mod[key] ?? 0, remoteMod = remote.keys[key]?.mod ?? 0;
      const merged = mode === 'use-cloud' ? theirs : mode === 'use-device' ? local
        : mergeKey(spec, { base: meta.base[key] ?? null, local, remote: theirs, localMod, remoteMod });
      if (merged !== local) apply[key] = merged;
      nextBase[key] = merged;
      if (merged !== theirs) outgoing.keys[key] = { value: merged, mod: Math.max(Date.now(), localMod) };
      else if (remote.keys[key]) outgoing.keys[key] = remote.keys[key];
    }
    const changed = Object.keys(outgoing.keys).some((key) => outgoing.keys[key].value !== (remote.keys[key]?.value ?? null)) || !row;
    if (changed && !(await pushRow(row, { v: 1, keys: { ...remote.keys, ...outgoing.keys } }))) continue;
    const pulled: string[] = [];
    for (const [key, value] of Object.entries(apply)) {
      if (value === null) rawRemove(key); else rawSet(key, value);
      frozen.add(key); pulled.push(key);
    }
    meta = { base: nextBase, mod: meta.mod, rev: (row?.rev ?? 0) + (changed ? 1 : 0) };
    saveMeta();
    const at = Date.now();
    saveConfig({ lastSync: at });
    return { pulled, pushed: changed, at };
  }
  throw new CloudError('Another device kept changing the cloud copy. Try again in a moment.');
}

export async function deleteCloudCopy() {
  if (!config.session) throw new CloudError('Sign in first.');
  const t = await token();
  const { status, body } = await http(`/rest/v1/${TABLE}?user_id=eq.${config.session.user.id}`, { method: 'DELETE', token: t });
  if (status >= 400) throw new CloudError(reason(body, 'Could not delete the cloud copy.'), status);
  meta = { base: {}, mod: meta.mod, rev: 0 }; saveMeta();
}

/** Used once at startup, before the app renders, so the first screen already has the merged data. */
export async function bootSync(limitMs = 2500): Promise<SyncResult | null> {
  installTracker();
  if (!config.session || !config.auto || !configured()) return null;
  try {
    const result = await Promise.race([syncNow(), new Promise<null>((resolve) => setTimeout(() => resolve(null), limitMs))]);
    if (result) { for (const key of result.pulled) frozen.delete(key); } // Nothing has rendered yet, so nothing is stale.
    return result;
  } catch { return null; }
}
let schedulerOn = false;
/** Re-sync when the window regains focus and every few minutes, only while signed in. */
export function startScheduler(onResult: (result: SyncResult) => void, onError: (error: CloudError) => void) {
  if (schedulerOn) return; schedulerOn = true;
  const tick = (force = false) => {
    if (!config.session || !config.auto || !configured()) return;
    if (!force && Date.now() - config.lastSync < 60_000) return;
    syncNow().then(onResult, (error) => onError(error as CloudError));
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
  window.addEventListener('focus', () => tick());
  window.addEventListener('online', () => tick(true));
  setInterval(() => tick(), 5 * 60_000);
}
