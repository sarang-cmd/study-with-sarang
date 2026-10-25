const $ = (id) => document.getElementById(id);
chrome.storage.local.get({ port: 47615, token: '', enabled: true, sendTitle: true }).then((c) => { $('token').value = c.token; $('port').value = c.port; $('enabled').checked = c.enabled; $('title').checked = c.sendTitle; });
$('save').addEventListener('click', async () => {
  const c = { token: $('token').value.trim(), port: Number($('port').value) || 47615, enabled: $('enabled').checked, sendTitle: $('title').checked };
  await chrome.storage.local.set(c);
  try {
    const res = await fetch(`http://127.0.0.1:${c.port}/ping`, { headers: { authorization: `Bearer ${c.token}` } });
    $('msg').textContent = res.ok ? 'Connected. The app can see which website is open.' : res.status === 401 ? 'The app says the code is wrong. Copy it again.' : `The app answered with ${res.status}.`;
  } catch (e) { $('msg').textContent = 'The app is not running, or drift detection and the browser helper are not turned on yet.'; }
});
