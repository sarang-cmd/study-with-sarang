#!/usr/bin/env node
// Invites a person by email, so the owner can create accounts without opening the dashboard.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<secret key> \
//     node scripts/invite-user.mjs person@example.com [--redirect https://site/] [--name "Their name"]
//
// The secret (service role) key comes from the environment of this one command. It is never read from a file,
// never printed and never part of the app. Keep it on your own computer. The person gets the "Invite user"
// email, opens it, chooses a password and is signed in. Nothing here runs inside the app, in a browser or in the ZIP.
import { pathToFileURL } from 'node:url';

export function describeKey(key) {
  if (!key) return 'missing';
  if (/^sb_publishable_/.test(key)) return 'publishable';
  if (/^sb_secret_/.test(key)) return 'secret';
  try { const role = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role; return role === 'service_role' ? 'secret' : role === 'anon' ? 'publishable' : 'unknown'; } catch { return 'unknown'; }
}

export async function inviteUser({ url, key, email, redirectTo, name, fetchImpl = fetch }) {
  const clean = String(email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error(`"${clean}" does not look like an email address.`);
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url ?? '') && !/^http:\/\/127\.0\.0\.1:\d+$/.test(url ?? '')) throw new Error('SUPABASE_URL should look like https://<project-ref>.supabase.co');
  const kind = describeKey(key);
  if (kind === 'missing') throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for this command (Dashboard, Project Settings, API Keys, secret key).');
  if (kind === 'publishable') throw new Error('That is the public (publishable) key. Inviting needs the secret key, which must stay on your computer.');
  const target = new URL('/auth/v1/invite', url); if (redirectTo) target.searchParams.set('redirect_to', redirectTo);
  const response = await fetchImpl(target, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ email: clean, data: name ? { name } : {} }) });
  const text = await response.text(); let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { /* keep empty */ }
  if (!response.ok) {
    const why = body.msg || body.message || body.error_description || `HTTP ${response.status}`;
    if (response.status === 422 || /already/i.test(why)) throw new Error(`${clean} already has an account. Use Forgot password in the app instead.`);
    throw new Error(`The invitation was not sent: ${why}`);
  }
  return { id: body.id ?? '', email: body.email ?? clean };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2); const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const email = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
  if (!email || args.includes('--help')) { console.log('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/invite-user.mjs person@example.com [--redirect https://site/] [--name "Name"]'); process.exit(email ? 0 : 1); }
  try {
    const done = await inviteUser({ url: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, email, redirectTo: flag('--redirect'), name: flag('--name') });
    console.log(`Invitation sent to ${done.email}. They open the email, choose a password and are signed in.`);
  } catch (error) { console.error(error.message); process.exit(1); }
}
