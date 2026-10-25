const $ = (id) => document.getElementById(id);
const version = chrome.runtime.getManifest().version;
$('ver').textContent = `Version ${version}`;
const newer = (a, b) => { const x = String(a).split('.').map(Number); const y = String(b).split('.').map(Number); for (let i = 0; i < 3; i += 1) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
async function render() {
  const s = await check();
  const [title, text] = STATE_TEXT[s.state] ?? STATE_TEXT.refused;
  $('dot').className = `dot ${s.state}`; $('title').textContent = title; $('text').textContent = text;
  $('connect').hidden = s.state === 'connected' || s.state === 'offline' || s.state === 'off';
  $('enabled').checked = s.enabled !== false; $('title-on').checked = s.sendTitle !== false; $('port').value = s.port; $('token').value = s.token || '';
}
$('enabled').addEventListener('change', async () => { await chrome.storage.local.set({ enabled: $('enabled').checked }); render(); });
$('title-on').addEventListener('change', async () => { await chrome.storage.local.set({ sendTitle: $('title-on').checked }); });
$('recheck').addEventListener('click', render);
$('connect').addEventListener('click', async () => { $('msg').textContent = 'Connecting...'; const r = await pair(); $('msg').textContent = r.ok ? 'Connected. The app can now see which website is open.' : r.why; render(); });
$('save').addEventListener('click', async () => {
  await chrome.storage.local.set({ token: $('token').value.trim(), port: Number($('port').value) || 47615 });
  const s = await check(); $('msg').textContent = s.state === 'connected' ? 'Connected.' : (STATE_TEXT[s.state] ?? STATE_TEXT.refused)[1]; render();
});
// The one place this extension may look at the internet: the public update file, opened by you, on this page only.
fetch('https://study-with-sarang.vercel.app/updates/latest.json', { cache: 'no-store' }).then((r) => r.json()).then((feed) => {
  const e = feed.extension;
  $('update').innerHTML = '';
  if (e && newer(e.version, version)) { const a = document.createElement('a'); a.href = 'https://sarang-md.vercel.app/study-with-sarang/downloads/'; a.target = '_blank'; a.rel = 'noreferrer'; a.textContent = `Helper ${e.version} is available. Open the download page.`; $('update').append(a); }
  else $('update').textContent = `You have the newest helper (${version}).`;
}).catch(() => { $('update').textContent = 'Could not check for a newer helper right now.'; });
chrome.storage.onChanged.addListener(render);
render();
