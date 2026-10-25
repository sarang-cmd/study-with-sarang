import assert from 'node:assert/strict';
import { loadModule } from './_load.mjs';
import { startMock } from './_mock-supabase.mjs';

const mock = await startMock();
const { anon, serviceRole, rows, flags } = mock;
const URL_BASE = mock.url;
const server = { close: () => mock.close() };

// ---- two "devices": each has its own localStorage, Storage class and module instance --------------
function makeDevice() {
  const store = new Map();
  const fresh = () => class Store { getItem(k) { return store.has(k) ? store.get(k) : null; } setItem(k, v) { store.set(k, String(v)); } removeItem(k) { store.delete(k); } };
  const device = { store, Store: fresh(), listeners: [] };
  device.local = new device.Store();
  device.window = { dispatchEvent: () => true, addEventListener() {} };
  device.activate = () => { globalThis.Storage = device.Store; globalThis.localStorage = device.local; globalThis.window = device.window; globalThis.CustomEvent = class { constructor(t) { this.type = t; } }; };
  // A reload: a brand new page over the same saved storage.
  device.boot = async () => { device.Store = fresh(); device.local = new device.Store(); device.activate(); const mod = await loadModule('src/lib/cloud.ts'); mod.installTracker(); return mod; };
  return device;
}
const P = 'study-with-sarang:';
const mix = (id, name, updatedAt) => ({ id, name, favorite: false, createdAt: '2026-10-01T00:00:00Z', updatedAt, mix: {} });
const read = (d, key) => JSON.parse(d.local.getItem(P + key) ?? 'null');
const write = (d, key, value) => { d.activate(); d.local.setItem(P + key, JSON.stringify(value)); };

// ---- pure rules ----------------------------------------------------------------------------------
const { mergeKey, SYNC_KEYS } = await loadModule('src/lib/syncMerge.ts');
const items = SYNC_KEYS[P + 'mixes'];
const j = (v) => JSON.stringify(v);
const m = (input) => JSON.parse(mergeKey(items, { localMod: 0, remoteMod: 0, ...input }));
assert.deepEqual(m({ base: j([mix('a', 'A', '1')]), local: j([]), remote: j([mix('a', 'A', '1')]) }), [], 'a local deletion travels');
assert.deepEqual(m({ base: j([mix('a', 'A', '1')]), local: j([mix('a', 'A', '1')]), remote: j([]) }), [], 'a remote deletion travels');
assert.equal(m({ base: j([mix('a', 'A', '1')]), local: j([mix('a', 'A2', '2')]), remote: j([]) }).length, 1, 'an edit beats a delete');
assert.deepEqual(m({ base: null, local: j([mix('a', 'A', '1')]), remote: j([mix('b', 'B', '1')]) }).map((x) => x.id), ['a', 'b'], 'new items from both sides are kept');
assert.equal(m({ base: j([mix('a', 'A', '2026-10-01')]), local: j([mix('a', 'Local', '2026-10-02')]), remote: j([mix('a', 'Remote', '2026-10-03')]) })[0].name, 'Remote', 'the newer edit wins');
assert.equal(m({ base: j([mix('a', 'A', '1')]), local: j([mix('a', 'A', '1')]), remote: j([mix('a', 'Remote', '2')]) })[0].name, 'Remote', 'untouched local takes the remote edit');
assert.equal(mergeKey(SYNC_KEYS[P + 'timer-settings'], { base: '1', local: '1', remote: '2', localMod: 9, remoteMod: 1 }), '2', 'unchanged here, changed there');
assert.equal(mergeKey(SYNC_KEYS[P + 'timer-settings'], { base: '1', local: '3', remote: '2', localMod: 9, remoteMod: 1 }), '3', 'both changed: newer wins');
assert.equal(mergeKey(SYNC_KEYS[P + 'listening'], { base: null, local: '{"a":5,"b":1}', remote: '{"a":2,"c":4}', localMod: 0, remoteMod: 0 }), '{"a":5,"b":1,"c":4}', 'minutes listened merge by maximum');
assert.equal(mergeKey(items, { base: null, local: null, remote: null, localMod: 0, remoteMod: 0 }), null);
console.log('PASS merge rules');

// ---- key safety and url checks -------------------------------------------------------------------
const probe = await makeDevice().boot();
assert.ok(probe.checkPublicKey(serviceRole).includes('service-role'), 'service-role key refused');
assert.ok(probe.checkPublicKey('sb_secret_abc').includes('secret'), 'secret key refused');
assert.equal(probe.checkPublicKey(anon), null); assert.equal(probe.checkPublicKey('sb_publishable_abc123'), null);
assert.ok(probe.checkPublicKey('hello'));
assert.equal(probe.normalizeUrl('https://abc.supabase.co/rest/v1'), 'https://abc.supabase.co');
assert.equal(probe.normalizeUrl('http://evil.example'), null); assert.equal(probe.normalizeUrl('http://localhost:54321'), 'http://localhost:54321');
assert.equal(probe.normalizeUrl('https://user:pw@abc.supabase.co'), null);
console.log('PASS public key and url checks');

// ---- device A signs up and syncs ------------------------------------------------------------------
const A = makeDevice(); let a = await A.boot();
assert.equal(a.setProject(URL_BASE, anon), null);
write(A, 'mixes', [mix('m1', 'Rain', '2026-10-01T10:00:00Z'), mix('m2', 'Cafe', '2026-10-01T11:00:00Z')]);
write(A, 'timer-settings', { focusMin: 30 });
await assert.rejects(a.signIn('s@x.test', 'nope'), /Wrong email or password|Invalid/);
assert.equal(await a.signUp('s@x.test', 'correct horse'), 'signed-in');
assert.equal(a.isSignedIn(), true);
let r = await a.syncNow();
assert.equal(r.pushed, true); assert.deepEqual(r.pulled, []);
assert.equal(rows.size, 1);
assert.equal(JSON.parse(rows.get('u-1').data.keys[P + 'mixes'].value).length, 2);
console.log('PASS sign up and first push');

// ---- device B signs in and receives it -----------------------------------------------------------
const B = makeDevice(); let b = await B.boot();
b.setProject(URL_BASE, anon); await b.signIn('s@x.test', 'correct horse');
r = await b.syncNow();
assert.ok(r.pulled.includes(P + 'mixes') && r.pulled.includes(P + 'timer-settings'));
assert.equal(read(B, 'mixes').length, 2);
assert.equal(read(B, 'timer-settings').focusMin, 30);
B.activate(); B.local.setItem(P + 'mixes', '[]');
assert.equal(read(B, 'mixes').length, 2, 'stale in-memory writes are held back until reload');
assert.deepEqual(b.pendingReload().sort(), [P + 'mixes', P + 'timer-settings']);
console.log('PASS second device pulls, stale writes are frozen');

// ---- edits and deletions travel; "reload" = fresh module instance over the same storage -----------
b = await B.boot();
assert.equal(b.pendingReload().length, 0);
B.activate(); B.local.setItem(P + 'mixes', JSON.stringify([mix('m1', 'Rain (quiet)', '2026-10-02T09:00:00Z'), mix('m3', 'Library', '2026-10-02T09:30:00Z')]));
await b.syncNow();
a = await A.boot(); A.activate();
r = await a.syncNow();
assert.deepEqual(read(A, 'mixes').map((x) => x.id).sort(), ['m1', 'm3'], 'delete (m2), edit (m1) and add (m3) all arrived');
assert.equal(read(A, 'mixes').find((x) => x.id === 'm1').name, 'Rain (quiet)');
console.log('PASS edits, additions and deletions merge');

// ---- concurrent writer: the first PATCH loses the race, sync retries and still lands --------------
a = await A.boot(); write(A, 'mixes', [...read(A, 'mixes'), mix('m4', 'Forest', '2026-10-03T08:00:00Z')]);
flags.failNextPatch = true;
r = await a.syncNow(); assert.equal(r.pushed, true);
assert.ok(JSON.parse(rows.get('u-1').data.keys[P + 'mixes'].value).some((x) => x.id === 'm4'));
console.log('PASS revision conflict is retried');

// ---- another account never sees these rows ---------------------------------------------------------
const C = makeDevice(); const c = await C.boot();
c.setProject(URL_BASE, anon); assert.equal(await c.signUp('other@x.test', 'another pass'), 'signed-in');
r = await c.syncNow(); assert.deepEqual(r.pulled, [], 'a different user has an empty cloud copy');
assert.equal(read(C, 'mixes'), null);
console.log('PASS accounts are isolated');

// ---- email code, expiry refresh, replace buttons, delete, sign out, errors ---------------------------
const D = makeDevice(); const d = await D.boot(); d.setProject(URL_BASE, anon);
await d.sendCode('code@x.test'); await assert.rejects(d.verifyCode('code@x.test', '000000'), /invalid|expired|code/i);
await d.verifyCode('code@x.test', '123456'); assert.equal(d.isSignedIn(), true);
console.log('PASS sign in with an email code');

a = await A.boot(); A.activate();
const cfg = JSON.parse(A.local.getItem('study-with-sarang:cloud')); cfg.session.expiresAt = Date.now() - 1000; A.local.setItem('study-with-sarang:cloud', JSON.stringify(cfg));
a = await A.boot(); await a.syncNow(); assert.notEqual(a.getConfig().session.accessToken, cfg.session.accessToken, 'an expired token is refreshed');
console.log('PASS token refresh');

write(A, 'timer-settings', { focusMin: 99 }); await a.syncNow({ mode: 'use-cloud' });
assert.equal(read(A, 'timer-settings').focusMin, 30, 'Use the cloud copy replaces this device');
a = await A.boot(); write(A, 'timer-settings', { focusMin: 99 }); await a.syncNow({ mode: 'use-device' });
assert.equal(JSON.parse(rows.get('u-1').data.keys[P + 'timer-settings'].value).focusMin, 99, 'Use this device replaces the cloud');
b = await B.boot(); await b.syncNow(); assert.equal(read(B, 'timer-settings').focusMin, 99);
console.log('PASS replace buttons');

flags.dropTable = true; a = await A.boot();
await assert.rejects(a.syncNow(), /study_sync table is missing/);
flags.dropTable = false;
await a.deleteCloudCopy(); assert.equal(rows.has('u-1'), false, 'the cloud copy can be deleted');
await a.signOut(); assert.equal(a.isSignedIn(), false);
await assert.rejects(a.syncNow(), /Sign in first/);
a.setProject('http://127.0.0.1:1', anon);
await assert.rejects(a.signIn('s@x.test', 'correct horse'), /Could not reach/);
console.log('PASS errors, delete and sign out');

// ---- built-in project, confirmation by code, email links -------------------------------------------
{
  const E = makeDevice(); const e = await E.boot();
  assert.equal(e.BUILT_IN.url, 'https://fykzmhxvhdrxvqkkhlnd.supabase.co', 'the built-in project is set');
  assert.ok(e.BUILT_IN.anonKey.startsWith('sb_publishable_') && !/secret|service/i.test(e.BUILT_IN.anonKey), 'only a publishable key is embedded');
  assert.equal(e.configured(), true, 'sign in is available without any setup');
  assert.equal(e.checkPublicKey(e.BUILT_IN.anonKey), null);
  e.setProject(URL_BASE, mock.publishable);
  flags.requireConfirm = true;
  // A publishable key is not a JWT, so it must not be sent as a bearer token
  globalThis.location = { protocol: 'https:', hostname: 'study.example', origin: 'https://study.example', pathname: '/app/', search: '', hash: '' };
  globalThis.history = { replaceState: (_s, _t, url) => { globalThis.location.hash = ''; globalThis.__replaced = url; } };
  assert.equal(await e.signUp('new@x.test', 'long password 1'), 'confirm');
  assert.equal(flags.lastAuth, undefined, 'no Authorization header with a publishable key');
  assert.equal(flags.lastRedirect, 'https://study.example/app/', 'the confirmation link returns to the web app');
  assert.equal(e.isSignedIn(), false);
  await assert.rejects(e.signIn('new@x.test', 'long password 1'), /Confirm your email first/);
  await assert.rejects(e.verifySignup('new@x.test', '000000'), /did not work|expired/i);
  await e.resendSignup('new@x.test');
  await assert.rejects(e.verifySignup('new@x.test', '654321'), /did not work|expired/i, 'an old code stops working after a resend');
  await e.verifySignup('new@x.test', '777777');
  assert.equal(e.isSignedIn(), true); assert.equal(e.getConfig().session.user.email, 'new@x.test');
  console.log('PASS built-in project and sign-up confirmation by code');

  // Forgot password: the reply never reveals whether an address exists, the code is single use, and only a new password signs in
  await e.signOut(); assert.equal(e.isSignedIn(), false);
  await e.requestPasswordReset('nobody@x.test'); await e.requestPasswordReset('new@x.test');
  assert.equal(flags.recoverCalls, 2, 'asking for a reset never fails for an unknown address'); assert.equal(flags.lastRedirect, 'https://study.example/app/');
  await assert.rejects(e.verifyRecovery('new@x.test', '000000'), /did not work|expired/i);
  const proven = await e.verifyRecovery('new@x.test', '246810');
  assert.equal(e.isSignedIn(), false, 'a proven code alone does not sign anyone in');
  await assert.rejects(e.verifyRecovery('new@x.test', '246810'), /did not work|expired/i, 'a reset code works once');
  await assert.rejects(e.completePasswordSetup('short', proven), /at least 8/);
  await e.completePasswordSetup('a brand new password', proven);
  assert.equal(e.isSignedIn(), true); assert.equal(flags.passwordChanges, 1);
  await e.signOut();
  await assert.rejects(e.signIn('new@x.test', 'long password 1'), /Wrong email or password/);
  await e.signIn('new@x.test', 'a brand new password'); assert.equal(e.isSignedIn(), true);
  console.log('PASS forgot password: code, new password, old password no longer works');

  // A reset or invitation link in the address bar opens the password setup instead of signing in
  await e.signOut();
  const resetUser = [...mock.users.values()].find((x) => x.email === 'new@x.test');
  globalThis.location = { protocol: 'https:', hostname: 'study.example', origin: 'https://study.example', pathname: '/app/', search: '', hash: '' };
  const hashFor = (type) => `#access_token=${mock.mintToken(resetUser)}&refresh_token=r-${type}&expires_in=3600&type=${type}`;
  globalThis.location.hash = hashFor('recovery');
  await e.captureAuthHash();
  assert.equal(e.isSignedIn(), false, 'a recovery link does not sign in by itself'); assert.equal(e.currentPasswordSetup()?.kind, 'recovery'); assert.equal(globalThis.location.hash, '', 'the token is removed from the address');
  await e.completePasswordSetup('chosen after the link'); assert.equal(e.isSignedIn(), true); assert.equal(e.currentPasswordSetup(), null);
  await e.signOut(); globalThis.location.hash = hashFor('invite'); await e.captureAuthHash(); assert.equal(e.currentPasswordSetup()?.kind, 'invite'); e.cancelPasswordSetup(); assert.equal(e.currentPasswordSetup(), null); assert.equal(e.isSignedIn(), false);
  console.log('PASS reset and invite links open the password setup');

  // The desktop app and local previews are not valid link targets
  for (const [hostname, origin, protocol] of [['app.study-with-sarang.localhost', 'http://app.study-with-sarang.localhost:5173', 'http:'], ['localhost', 'http://localhost:5173', 'http:'], ['', 'null', 'file:']]) {
    globalThis.location = { protocol, hostname, origin, pathname: '/', search: '', hash: '' };
    assert.equal(e.redirectTarget(), '', `no redirect from ${hostname || protocol}`);
  }

  // An email link: token in the hash. It is stripped at once and only adopted for the address that signed up here.
  const mint = (email) => { const u = [...mock.users.values()].find((x) => x.email === email); const r = [...mock.users.values()]; void r; return u; };
  async function land(device, hash) {
    device.activate(); const mod = await device.boot();
    globalThis.location = { protocol: 'https:', hostname: 'study.example', origin: 'https://study.example', pathname: '/app/', search: '', hash };
    globalThis.__replaced = null; const got = []; globalThis.window.addEventListener = (t, fn) => { void t; void fn; };
    const stop = []; globalThis.window.dispatchEvent = (ev) => { if (ev.detail) got.push(ev.detail); return true; };
    globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail; } };
    await mod.captureAuthHash();
    return { mod, got, hashAfter: globalThis.location.hash, stop };
  }
  // device F signs up (pending), then lands from the real link
  const F = makeDevice(); const f = await F.boot(); f.setProject(URL_BASE, mock.publishable);
  assert.equal(await f.signUp('link@x.test', 'long password 2'), 'confirm');
  const linkUser = { id: 'u-link', email: 'link@x.test', password: 'long password 2' }; mock.users.set(linkUser.id, linkUser);
  mock.tokens.set('at-link', linkUser.id);
  let out = await land(F, '#access_token=at-link&refresh_token=rt-link&expires_in=3600&token_type=bearer&type=signup');
  assert.equal(out.hashAfter, '', 'the token is removed from the address'); assert.equal(globalThis.__replaced, '/app/');
  assert.equal(out.mod.isSignedIn(), true, 'the matching address is signed in'); assert.equal(out.got[0].kind, 'success');
  // a stranger's link on a device with no pending sign-up does not sign anyone in
  const G = makeDevice(); const g = await G.boot(); g.setProject(URL_BASE, mock.publishable);
  mock.users.set('u-evil', { id: 'u-evil', email: 'attacker@x.test', password: 'x' }); mock.tokens.set('at-evil', 'u-evil');
  out = await land(G, '#access_token=at-evil&refresh_token=rt-evil&expires_in=3600&type=signup');
  assert.equal(out.mod.isSignedIn(), false, 'an unexpected link never signs you in'); assert.equal(out.hashAfter, '');
  assert.match(out.got[0].message, /Now sign in/);
  // a forged token is rejected by the server
  out = await land(G, '#access_token=forged&refresh_token=rt&type=signup');
  assert.equal(out.mod.isSignedIn(), false); assert.equal(out.got[0].kind, 'error');
  // a recovery link is never adopted as a sign-in: it only opens the password setup, for a token the server confirms
  out = await land(G, '#access_token=at-link&refresh_token=rt-link&type=recovery'); assert.equal(out.mod.isSignedIn(), false); assert.equal(out.mod.currentPasswordSetup()?.kind, 'recovery'); out.mod.cancelPasswordSetup();
  out = await land(G, '#access_token=forged&refresh_token=rt&type=recovery'); assert.equal(out.mod.currentPasswordSetup(), null); assert.equal(out.got[0].kind, 'error');
  // an expired link shows a friendly message and clears the address
  out = await land(G, '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  assert.equal(out.hashAfter, ''); assert.equal(out.got[0].kind, 'error'); assert.match(out.got[0].message, /new code/);
  // ordinary hashes (page routes) are left alone
  out = await land(G, '#studio'); assert.equal(out.hashAfter, '#studio'); assert.equal(out.got.length, 0);
  flags.requireConfirm = false; delete globalThis.location; delete globalThis.history;
  console.log('PASS email links: token stripped, adopted only for the matching sign-up, strangers and forgeries refused');
}
server.close();
console.log('Verified cloud sync: merge rules, key safety, sign up, sign in, two devices, deletions, conflicts, isolation, refresh and errors.');
