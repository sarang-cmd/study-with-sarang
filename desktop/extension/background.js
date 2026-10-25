// Study with Sarang browser helper. It sends the website (and, if you allow it, the page title) of the tab you are looking at
// to the desktop app on THIS computer (127.0.0.1). It never talks to any other address and ignores private windows.
const DEFAULTS = { port: 47615, token: '', enabled: true, sendTitle: true };
const settings = () => chrome.storage.local.get(DEFAULTS);

async function badge(text, color) {
  try { await chrome.action.setBadgeText({ text }); await chrome.action.setBadgeBackgroundColor({ color }); } catch (e) { /* The toolbar is not ready. */ }
}

async function report() {
  const c = await settings();
  if (!c.enabled || !c.token) { badge(c.token ? 'off' : '?', '#6b7280'); return; }
  let win; try { win = await chrome.windows.getLastFocused(); } catch (e) { return; }
  if (!win || !win.focused) return; // Another program is in front: the app already knows.
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  if (!tab) return;
  let host = '';
  try { const url = new URL(tab.url || ''); if (url.protocol === 'http:' || url.protocol === 'https:') host = url.hostname; } catch (e) { /* An internal page. */ }
  const brave = typeof navigator.brave !== 'undefined';
  const browser = brave ? 'brave' : /Edg\//.test(navigator.userAgent) ? 'msedge' : /OPR\//.test(navigator.userAgent) ? 'opera' : 'chrome';
  try {
    const res = await fetch(`http://127.0.0.1:${c.port}/tab`, {
      method: 'POST',
      headers: { authorization: `Bearer ${c.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ host, title: c.sendTitle ? (tab.title || '') : '', browser, incognito: !!tab.incognito }),
    });
    badge(res.ok ? '' : '!', res.ok ? '#16a34a' : '#dc2626');
  } catch (e) { badge('!', '#dc2626'); } // The app is not running. That is fine.
}

chrome.tabs.onActivated.addListener(report);
chrome.tabs.onUpdated.addListener((id, change) => { if (change.url || change.title || change.status === 'complete') report(); });
chrome.windows.onFocusChanged.addListener(report);
chrome.storage.onChanged.addListener(report);
chrome.runtime.onStartup.addListener(report);
chrome.runtime.onInstalled.addListener(() => { chrome.alarms.create('beat', { periodInMinutes: 0.5 }); report(); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'beat') report(); });
chrome.alarms.get('beat').then((a) => { if (!a) chrome.alarms.create('beat', { periodInMinutes: 0.5 }); });
