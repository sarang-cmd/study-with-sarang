// Shared by the background worker, the popup and the settings page. It talks to one address only: the Study with Sarang
// desktop app on THIS computer (127.0.0.1). Nothing here contacts the internet.
const DEFAULTS = { port: 47615, token: '', enabled: true, sendTitle: true };
const getSettings = () => chrome.storage.local.get(DEFAULTS);
const base = (port) => `http://127.0.0.1:${port}`;

/** Is the app there, and is it waiting to be paired? Needs no code. */
async function hello(port) {
  try {
    const response = await fetch(`${base(port)}/hello`, { cache: 'no-store' });
    if (!response.ok) return { state: 'refused' };
    const body = await response.json();
    return { state: 'online', pairing: body.pairing === true };
  } catch (error) { return { state: 'offline' }; }
}

/** Fetches the pairing code from the app. It only answers while the person at the app has pressed "Pair the extension". */
async function pair() {
  const c = await getSettings();
  try {
    const response = await fetch(`${base(c.port)}/pair`, { cache: 'no-store' });
    if (response.status === 403) return { ok: false, why: 'The app is not waiting for a pairing. In Study with Sarang open Settings, Drift detection, Browser helper, press "Pair the extension", then press Connect here within two minutes.' };
    if (!response.ok) return { ok: false, why: `The app answered with ${response.status}.` };
    const body = await response.json();
    if (typeof body.token !== 'string' || !body.token) return { ok: false, why: 'The app did not send a pairing code.' };
    await chrome.storage.local.set({ token: body.token, port: Number(body.port) || c.port });
    return { ok: true };
  } catch (error) { return { ok: false, why: 'The app is not running, or the browser helper is not turned on in its settings yet.' }; }
}

/** One word for the whole situation: connected, offline, not-paired, wrong-code, off. */
async function check() {
  const c = await getSettings();
  if (!c.enabled) return { state: 'off', ...c };
  const seen = await hello(c.port);
  if (seen.state === 'offline') return { state: 'offline', ...c };
  if (seen.state === 'refused') return { state: 'refused', ...c };
  if (!c.token) return { state: 'not-paired', pairing: seen.pairing, ...c };
  try {
    const response = await fetch(`${base(c.port)}/ping`, { headers: { authorization: `Bearer ${c.token}` }, cache: 'no-store' });
    if (response.ok) return { state: 'connected', ...c };
    return { state: response.status === 401 ? 'wrong-code' : 'refused', pairing: seen.pairing, ...c };
  } catch (error) { return { state: 'offline', ...c }; }
}

const STATE_TEXT = {
  connected: ['Connected', 'The app can see which website is open.'],
  offline: ['App not running', 'Open Study with Sarang on this computer. This helper keeps trying.'],
  'not-paired': ['Not connected yet', 'In the app, press "Pair the extension", then press Connect here.'],
  'wrong-code': ['Code no longer matches', 'The app made a new pairing code. Press "Pair the extension" in the app, then Connect here.'],
  off: ['Paused', 'The helper is switched off, so nothing is reported.'],
  refused: ['The app refused the connection', 'Check the port in the settings, and that the browser helper is on in the app.'],
};
