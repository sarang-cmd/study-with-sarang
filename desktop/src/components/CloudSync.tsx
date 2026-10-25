import { Cloud, CloudOff, Copy, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import schemaSql from '../../supabase/schema.sql?raw';
import {
  BUILT_IN, CLOUD_EVENT, CloudError, configured, deleteCloudCopy, getConfig, pendingReload, sendCode, setAuto, setProject, signIn, signOut, signUp,
  resendSignup, startScheduler, syncNow, verifyCode, verifySignup, type SyncMode,
} from '../lib/cloud';
import { notify } from './ui/toast';

type Way = 'password' | 'create' | 'code';
const ago = (time: number) => {
  if (!time) return 'not yet';
  const s = Math.max(0, Math.round((Date.now() - time) / 1000));
  return s < 45 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : new Date(time).toLocaleDateString();
};
const WHAT = 'Saved mixes, time log, minutes listened, video playlist, timer settings' as const;

export function useCloud() {
  const [, bump] = useState(0);
  useEffect(() => {
    const update = () => bump((n) => n + 1);
    window.addEventListener(CLOUD_EVENT, update);
    const timer = setInterval(update, 30_000);
    return () => { window.removeEventListener(CLOUD_EVENT, update); clearInterval(timer); };
  }, []);
  return getConfig();
}

export function CloudSync({ number = '08', extraSynced, embedded = false }: { number?: string; extraSynced?: string; embedded?: boolean }) {
  const config = useCloud();
  const [way, setWay] = useState<Way>('password');
  const [email, setEmail] = useState(config.session?.user.email ?? '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [url, setUrl] = useState(config.url);
  const [key, setKey] = useState(config.anonKey);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');
  const [editing, setEditing] = useState(false);
  const ready = configured();
  const stale = pendingReload();

  useEffect(() => {
    startScheduler(
      (result) => { if (result.pulled.length) notify({ title: 'Cloud copy received', message: 'Another device changed your data. Reload to use it.', variant: 'success', duration: 12000, id: 'cloud-reload', actions: { label: 'Reload', onClick: () => location.reload() } }); },
      () => undefined,
    );
  }, []);

  async function run(work: () => Promise<string | void>) {
    setBusy(true); setProblem(''); setMessage('');
    try { const done = await work(); if (done) setMessage(done); }
    catch (error) { setProblem(error instanceof CloudError ? error.message : 'Something went wrong. Try again.'); }
    finally { setBusy(false); }
  }
  const sync = (mode: SyncMode = 'merge') => run(async () => {
    const result = await syncNow({ mode });
    if (result.pulled.length) { notify({ title: 'Cloud copy received', message: 'Reload to use the synced data.', variant: 'success', duration: 12000, id: 'cloud-reload', actions: { label: 'Reload', onClick: () => location.reload() } }); return 'Synced. Reload to use the data that came from the cloud.'; }
    return result.pushed ? 'Synced. Your changes are saved to the cloud.' : 'Already up to date.';
  });
  function saveProject(event: FormEvent) {
    event.preventDefault();
    const error = setProject(url, key);
    if (error) { setProblem(error); setMessage(''); } else { setProblem(''); setMessage('Project saved.'); setEditing(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (way === 'password') { await signIn(email, password); setPassword(''); await sync(); return 'Signed in.'; }
      if (way === 'create' && confirming) { await verifySignup(email, code); setCode(''); setConfirming(false); await syncNow(); return 'Email confirmed. You are signed in.'; }
      if (way === 'create') {
        const outcome = await signUp(email, password); setPassword('');
        if (outcome === 'confirm') { setConfirming(true); return `We sent a 6 digit code to ${email.trim()}. Type it below. If that address already has an account, no code is sent: use the Sign in tab.`; }
        await syncNow(); return 'Account created and signed in.';
      }
      if (!codeSent) { await sendCode(email); setCodeSent(true); return 'Code sent. Check your email and type the code below.'; }
      await verifyCode(email, code); setCode(''); setCodeSent(false); await syncNow(); return 'Signed in.';
    });
  }
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); notify({ message: `${what} copied`, variant: 'success', duration: 1800 }); } catch { /* Blocked. */ } };
  const field = 'field mt-1 !min-h-10 font-normal';

  return <section id="cloud" aria-labelledby="cloud-heading" className={embedded ? '' : 'mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7'}>
    <div className="flex items-start justify-between gap-4">
      <div>
        {number && <p className="section-label mb-3">{number} / Cloud sync</p>}
        <h2 id="cloud-heading" className="text-[26px] font-semibold leading-tight tracking-tight">Optional. Take it to every device.</h2>
        <p className="mt-2 max-w-[640px] text-[12px] leading-relaxed text-muted">The studio works fully without an account and keeps everything on this device. Sign in only if you want your data on more than one device. It syncs through a private cloud project. Each account can only read its own data, and nothing is shared or used for ads.</p>
      </div>
      {config.session ? <Cloud size={23} className="shrink-0 text-muted" aria-hidden="true" /> : <CloudOff size={23} className="shrink-0 text-muted" aria-hidden="true" />}
    </div>

    <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-canvas p-4 sm:p-5">
        {config.session && !editing ? <>
          <h3 className="text-[14px] font-semibold tracking-tight">Signed in</h3>
          <p className="mt-1 break-all text-[11px] text-muted">{config.session.user.email || 'Your account'} · last synced {ago(config.lastSync)}</p>
          {stale.length > 0 && <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink px-3 py-2 text-[11px]">
            <span>Newer data arrived from the cloud. Reload to use it.</span>
            <button type="button" className="studio-button !min-h-8" onClick={() => location.reload()}><RefreshCw size={12} />Reload now</button>
          </div>}
          <label className="mt-4 flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5">
            <span><span className="block text-[11px] font-semibold">Sync automatically</span><span className="mt-0.5 block text-[10px] leading-snug text-muted">At start, a few seconds after a change, and when you come back to the window.</span></span>
            <input type="checkbox" role="switch" className="mt-0.5 h-4 w-4 shrink-0 accent-ink" checked={config.auto} onChange={(event) => setAuto(event.target.checked)} />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="studio-button" disabled={busy} onClick={() => void sync()}><RefreshCw size={13} className={busy ? 'animate-spin' : ''} />Sync now</button>
            <button type="button" className="studio-button" disabled={busy} onClick={() => void run(async () => { await signOut(); return 'Signed out. Your data stays on this device.'; })}><LogOut size={13} />Sign out</button>
          </div>
          <details className="mt-4 rounded-xl border border-line">
            <summary className="cursor-pointer px-3 py-2.5 text-[11px] font-semibold">Advanced</summary>
            <div className="grid gap-2 border-t border-line p-3">
              <button type="button" className="studio-button justify-start" disabled={busy} onClick={() => { if (window.confirm('Replace the data on this device with the cloud copy? Unsynced local changes are lost.')) void sync('use-cloud'); }}>Replace this device with the cloud copy</button>
              <button type="button" className="studio-button justify-start" disabled={busy} onClick={() => { if (window.confirm('Replace the cloud copy with the data on this device?')) void sync('use-device'); }}>Replace the cloud copy with this device</button>
              <button type="button" className="studio-button justify-start" disabled={busy} onClick={() => { if (window.confirm('Delete your synced copy from the cloud? Data on your devices is not touched.')) void run(async () => { await deleteCloudCopy(); return 'Cloud copy deleted.'; }); }}><Trash2 size={13} />Delete the cloud copy</button>
              <button type="button" className="studio-button justify-start" onClick={() => setEditing(true)}>Use a different Supabase project</button>
            </div>
          </details>
        </> : ready && !editing ? <form onSubmit={submit}>
          <h3 className="text-[14px] font-semibold tracking-tight">Sign in to sync</h3>
          <div role="tablist" aria-label="How to sign in" className="mt-3 grid grid-cols-3 gap-1 rounded-full border border-line bg-raised p-1 text-[11px] font-semibold">
            {([['password', 'Sign in'], ['create', 'Create account'], ['code', 'Email code']] as [Way, string][]).map(([id, label]) =>
              <button key={id} type="button" role="tab" aria-selected={way === id} onClick={() => { setWay(id); setProblem(''); setMessage(''); setCodeSent(false); setConfirming(false); }} className={`min-h-8 rounded-full px-2 ${way === id ? 'bg-ink text-canvas' : 'text-muted hover:text-ink'}`}>{label}</button>)}
          </div>
          <label className="mt-3 block text-[11px] font-semibold">Email<input className={field} type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {way !== 'code' && !(way === 'create' && confirming) && <label className="mt-2 block text-[11px] font-semibold">Password<input className={field} type="password" required minLength={way === 'create' ? 8 : 1} autoComplete={way === 'create' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
          {way === 'create' && confirming && <label className="mt-2 block text-[11px] font-semibold">Confirmation code<input className={field} inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6,8}" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} aria-describedby="confirm-help" /></label>}
          {way === 'create' && confirming && <p id="confirm-help" className="mt-1 text-[10px] leading-relaxed text-muted">Check spam if it does not arrive within a minute. The email link also works when opened in this browser.</p>}
          {way === 'code' && codeSent && <label className="mt-2 block text-[11px] font-semibold">Code from the email<input className={field} inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} /></label>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="submit" className="studio-button !bg-ink !text-canvas" disabled={busy}>{way === 'password' ? 'Sign in' : way === 'create' ? (confirming ? 'Confirm' : 'Create account') : codeSent ? 'Verify code' : 'Email me a code'}</button>
            {way === 'create' && confirming && <button type="button" className="studio-button" disabled={busy} onClick={() => void run(async () => { await resendSignup(email); return 'A new code is on its way. Only the newest one works.'; })}>Send a new code</button>}
          </div>
          <details className="mt-4 rounded-xl border border-line">
            <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold">Advanced</summary>
            <div className="border-t border-line p-3"><button type="button" className="studio-button" onClick={() => setEditing(true)}>Use a different Supabase project</button></div>
          </details>
        </form> : <form onSubmit={saveProject}>
          <h3 className="text-[14px] font-semibold tracking-tight">Your Supabase project</h3>
          <label className="mt-3 block text-[11px] font-semibold">Project URL<input className={field} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://abcdefgh.supabase.co" spellCheck={false} autoComplete="off" /></label>
          <label className="mt-2 block text-[11px] font-semibold">Anon (public) key<input className={field} value={key} onChange={(event) => setKey(event.target.value)} placeholder="eyJ... or sb_publishable_..." spellCheck={false} autoComplete="off" /></label>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">Only the public key belongs here. The app refuses service-role and secret keys.{BUILT_IN.url ? ' The app comes with a project already set up, so you only need this to use your own.' : ''}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" className="studio-button !bg-ink !text-canvas">Save project</button>
            {BUILT_IN.url && <button type="button" className="studio-button" onClick={() => { setUrl(BUILT_IN.url); setKey(BUILT_IN.anonKey); const error = setProject(BUILT_IN.url, BUILT_IN.anonKey); if (error) setProblem(error); else { setProblem(''); setMessage('Back to the built-in project.'); setEditing(false); } }}>Use the built-in project</button>}
            {(ready || config.session) && <button type="button" className="studio-button" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
        </form>}
        {(problem || message) && <p role={problem ? 'alert' : 'status'} className={`mt-3 rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${problem ? 'border-ink font-semibold' : 'border-line text-muted'}`}>{problem || message}</p>}
      </div>

      <div className="rounded-xl border border-line bg-canvas p-4 sm:p-5">
        <h3 className="text-[14px] font-semibold tracking-tight">What syncs, and what does not</h3>
        <p className="mt-2 text-[11px] leading-relaxed text-muted"><strong className="text-ink">Synced:</strong> {WHAT}{extraSynced ? `, ${extraSynced}` : ''}. Deletions and edits are merged, so a mix you remove on one device is removed on the others.</p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted"><strong className="text-ink">Stays on each device:</strong> theme, the running timer, window and shortcut settings, voice mode, and any video files you added from disk.</p>
        <details className="mt-4 rounded-xl border border-line">
          <summary className="cursor-pointer px-3 py-2.5 text-[11px] font-semibold">Set up your own Supabase project (2 minutes)</summary>
          <ol className="grid gap-1.5 border-t border-line px-3 py-3 text-[11px] leading-relaxed text-muted">
            <li><strong className="text-ink">1.</strong> Create a free project at supabase.com.</li>
            <li><strong className="text-ink">2.</strong> Open SQL Editor, paste the setup below, press Run. It creates one private table with Row Level Security.</li>
            <li><strong className="text-ink">3.</strong> Open Project Settings, API. Copy the Project URL and the anon (public) key into this page.</li>
            <li><strong className="text-ink">4.</strong> Authentication, Providers: keep Email on. For the email code option, edit the Magic Link template to include {'{{ .Token }}'}. Turn off Confirm email if you want instant sign-up.</li>
          </ol>
          <div className="border-t border-line p-3"><button type="button" className="studio-button" onClick={() => void copy(schemaSql, 'Setup SQL')}><Copy size={12} />Copy the setup SQL</button></div>
        </details>
      </div>
    </div>
  </section>;
}
