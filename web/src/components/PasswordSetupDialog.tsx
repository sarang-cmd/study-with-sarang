import { KeyRound } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CloudError, cancelPasswordSetup, completePasswordSetup, onPasswordSetup, type PasswordSetup } from '../lib/cloud';
import { notify } from './ui/toast';

/** Opens when an email link (reset password or invitation) proves an address. The person chooses a password, and only then is anyone signed in. */
export function PasswordSetupDialog() {
  const [setup, setSetup] = useState<PasswordSetup | null>(null);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => onPasswordSetup(setSetup), []);
  useEffect(() => { if (setup) first.current?.focus(); }, [setup]);
  if (!setup) return null;
  const invite = setup.kind === 'invite';
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== again) { setProblem('The two passwords are not the same.'); return; }
    setBusy(true); setProblem('');
    try {
      await completePasswordSetup(password);
      setPassword(''); setAgain('');
      notify({ title: invite ? 'Account ready' : 'Password changed', message: 'You are signed in.', variant: 'success', id: 'password-setup' });
    } catch (error) { setProblem(error instanceof CloudError ? error.message : 'Something went wrong. Try again.'); } finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-[128] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm no-print">
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="password-setup-heading" data-testid="password-setup" className="w-full max-w-[420px] rounded-2xl border border-line bg-canvas p-6 shadow-2xl">
      <p className="section-label mb-2 flex items-center gap-2"><KeyRound size={13} aria-hidden="true" />{invite ? 'Invitation' : 'Reset password'}</p>
      <h2 id="password-setup-heading" className="text-[22px] font-semibold tracking-tight">{invite ? 'Choose a password' : 'Choose a new password'}</h2>
      <p className="mt-1 break-all text-[11px] text-muted">For {setup.session.user.email || 'your account'}. At least 8 characters.</p>
      <label className="mt-4 block text-[11px] font-semibold">New password<input ref={first} className="field mt-1 !min-h-10 font-normal" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <label className="mt-2 block text-[11px] font-semibold">Type it again<input className="field mt-1 !min-h-10 font-normal" type="password" required minLength={8} autoComplete="new-password" value={again} onChange={(event) => setAgain(event.target.value)} /></label>
      {problem && <p role="alert" className="mt-3 rounded-lg border border-ink px-3 py-2 text-[11px] font-semibold">{problem}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="submit" className="studio-button !bg-ink !text-canvas" disabled={busy}>{invite ? 'Create my account' : 'Save new password'}</button>
        <button type="button" className="studio-button" disabled={busy} onClick={cancelPasswordSetup}>Not now</button>
      </div>
    </form>
  </div>;
}
