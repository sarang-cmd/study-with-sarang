const $ = (id) => document.getElementById(id);
$('ver').textContent = `Version ${chrome.runtime.getManifest().version}`;
async function render() {
  const s = await check();
  const [title, text] = STATE_TEXT[s.state] ?? STATE_TEXT.refused;
  $('dot').className = `dot ${s.state}`; $('title').textContent = title; $('text').textContent = text;
  $('enabled').checked = s.enabled !== false;
  $('connect').hidden = !['not-paired', 'wrong-code'].includes(s.state);
  const last = (await chrome.storage.session?.get({ lastHost: '' }))?.lastHost;
  $('now').textContent = s.state === 'connected' ? (last ? `Reporting: ${last}` : 'Nothing reported yet. Switch to a web page.') : '';
}
$('enabled').addEventListener('change', async () => { await chrome.storage.local.set({ enabled: $('enabled').checked }); render(); });
$('settings').addEventListener('click', () => { chrome.runtime.openOptionsPage(); window.close(); });
$('connect').addEventListener('click', async () => { $('msg').textContent = 'Connecting...'; const r = await pair(); $('msg').textContent = r.ok ? 'Connected.' : r.why; render(); });
render();
