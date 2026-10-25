// The download page, as one self-contained HTML file (no external fonts, scripts or images, so it also works offline from a saved copy).
export const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;
const day = (iso) => new Date(iso).toISOString().slice(0, 10);

const ICON_STUDY = '<svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#171717"/><g fill="#fff"><rect x="11.4" y="20" width="5.2" height="24" rx="2.6"/><rect x="20.4" y="15" width="5.2" height="34" rx="2.6"/><rect x="29.4" y="10" width="5.2" height="44" rx="2.6"/><rect x="38.4" y="17" width="5.2" height="30" rx="2.6"/><rect x="47.4" y="22" width="5.2" height="20" rx="2.6"/></g></svg>';
const ICON_MD = '<svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#171717"/><text x="32" y="41" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-weight="700" font-size="24" fill="#fff">.md</text></svg>';
const ICON_HELPER = '<svg viewBox="0 0 128 128" width="44" height="44" aria-hidden="true"><rect width="128" height="128" rx="28" fill="#171717"/><rect x="23" y="31" width="82" height="66" rx="8" fill="none" stroke="#fff" stroke-width="6"/><rect x="20" y="44" width="88" height="4.5" fill="#fff"/><g fill="#fff"><rect x="34" y="66" width="7" height="14" rx="3.5"/><rect x="47" y="61" width="7" height="24" rx="3.5"/><rect x="60" y="56" width="7" height="34" rx="3.5"/><rect x="73" y="62" width="7" height="22" rx="3.5"/><rect x="86" y="67" width="7" height="12" rx="3.5"/></g></svg>';

function card({ id, icon, title, lead, version, extra, button, sha, file, notes, size, more }) {
  return `<section class="card" id="${id}" aria-labelledby="${id}-h">
  <div class="top">${icon}<div><h2 id="${id}-h">${esc(title)}</h2><p class="lead">${esc(lead)}</p></div></div>
  <p class="meta"><span>Version ${esc(version)}</span><span>${esc(size)}</span>${extra ? `<span>${esc(extra)}</span>` : ''}</p>
  <p class="actions">${button}</p>
  <details><summary>What is new</summary><p>${esc(notes)}</p></details>
  <details><summary>Check the file (SHA-256)</summary><p class="hash"><code id="${id}-sha">${esc(sha)}</code> <button type="button" class="copy" data-copy="${id}-sha">Copy</button></p><p class="small">In PowerShell: <code>Get-FileHash .\\${esc(file)} -Algorithm SHA256</code>. The two values must match.</p></details>
  ${more ?? ''}
</section>`;
}

export function downloadsPage({ primary, facts, helperZip, links, published }) {
  const study = card({
    id: 'study', icon: ICON_STUDY, title: 'Study with Sarang for Windows', version: facts.study.version, size: mb(facts.study.size), extra: `Released ${day(published)}`,
    lead: 'A calm study studio with its own window: focus timer, sound, a mini bar that stays on top, real notifications, media keys and voice commands. Free, works offline, no account needed.',
    button: `<a class="button" href="${esc(links.study.alias)}" data-testid="get-study">Download for Windows</a> <a class="button ghost" href="${esc(links.study.site)}">Use it in the browser</a>`,
    sha: facts.study.sha256, file: facts.study.file, notes: facts.study.notes,
  });
  const md = card({
    id: 'md', icon: ICON_MD, title: 'Sarang.md for Windows', version: facts.md.version, size: mb(facts.md.size), extra: `Released ${day(published)}`,
    lead: 'IB Maths AA HL lessons, a question bank and the full textbook for Units 1 to 3, in a window of its own that works offline. Free, no account needed.',
    button: `<a class="button" href="${esc(links.md.alias)}" data-testid="get-md">Download for Windows</a> <a class="button ghost" href="${esc(links.md.site)}">Use it in the browser</a>`,
    sha: facts.md.sha256, file: facts.md.file, notes: facts.md.notes,
  });
  const helper = card({
    id: 'helper', icon: ICON_HELPER, title: 'Study with Sarang Helper (browser extension)', version: facts.helper.version, size: mb(helperZip.size), extra: 'Chrome, Edge, Brave',
    lead: 'Tells the Study with Sarang desktop app which website is open, so drift detection can tell a lecture from a distraction. It talks only to the app on your own computer.',
    button: `<a class="button" href="${esc(links.helper.alias)}" data-testid="get-helper">Download the helper (zip)</a>`,
    sha: helperZip.sha256, file: helperZip.file, notes: facts.helper.notes,
    more: `<details open><summary>Install it in four steps</summary><ol>
      <li>Extract the zip. You get a folder called <b>Study-with-Sarang-Helper</b>.</li>
      <li>Open <code>chrome://extensions</code> (Edge: <code>edge://extensions</code>, Brave: <code>brave://extensions</code>) and switch on <b>Developer mode</b>.</li>
      <li>Choose <b>Load unpacked</b> and pick the extracted folder.</li>
      <li>In the app open <b>Settings, Drift detection, Browser helper</b>, press <b>Pair the extension</b>, then press <b>Connect to the app</b> on the helper's page. No code to copy.</li></ol>
      <p class="small">The desktop app can do the first steps for you: its <b>Install the helper</b> buttons open the right extensions page and copy the folder path. Chrome and Edge do not allow a program to install an extension silently from outside their stores, so Load unpacked stays your click. After that, the app keeps the folder current with each update.</p></details>`,
  });
  const order = primary === 'study' ? [study, helper, md] : [md, study, helper];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Downloads | ${primary === 'study' ? 'Study with Sarang' : 'Sarang.md'}</title>
<meta name="description" content="Download Study with Sarang, Sarang.md and the Study with Sarang Helper for Windows. Hosted on this website, free, with checksums.">
<style>
:root{--ink:#161616;--muted:#666;--line:#dcdcdc;--bg:#fff;--soft:#f7f7f7}
@media (prefers-color-scheme:dark){:root{--ink:#f2f2f2;--muted:#a3a3a3;--line:#343434;--bg:#121212;--soft:#1b1b1b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
header,main,footer{max-width:760px;margin:0 auto;padding:0 20px}header{padding-top:28px;display:flex;gap:14px;flex-wrap:wrap;align-items:center;justify-content:space-between}
nav{display:flex;gap:16px;font-size:14px;flex-wrap:wrap}a{color:inherit}h1{font-size:34px;letter-spacing:-.6px;margin:30px 0 6px}h2{font-size:19px;margin:0}
.sub{color:var(--muted);margin:0 0 24px}.card{border:1px solid var(--line);border-radius:18px;background:var(--soft);padding:20px 22px;margin:16px 0}
.top{display:flex;gap:14px;align-items:flex-start}.top svg{flex:none;border-radius:11px}.lead{margin:4px 0 0;color:var(--muted);font-size:15px}
.meta{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0;font-size:13px}.meta span{border:1px solid var(--line);border-radius:999px;padding:1px 10px;background:var(--bg)}
.actions{margin:14px 0 6px;display:flex;gap:10px;flex-wrap:wrap}.button{display:inline-flex;align-items:center;min-height:44px;padding:0 22px;border-radius:999px;background:var(--ink);color:var(--bg);font-weight:600;text-decoration:none;border:1px solid var(--ink)}
.button.ghost{background:transparent;color:var(--ink);border-color:var(--line)}.button:focus-visible,summary:focus-visible,a:focus-visible,.copy:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
details{border-top:1px solid var(--line);margin-top:12px;padding-top:10px}summary{cursor:pointer;font-weight:600;font-size:14px}details p,details ol{font-size:14px;margin:8px 0}ol{padding-left:20px}
code{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:1px 5px;word-break:break-all}
.hash{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap}.copy{border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:999px;padding:2px 12px;font:inherit;font-size:12px;cursor:pointer}.small{color:var(--muted);font-size:13px}
.note{border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:16px 0;font-size:14px}.note h3{margin:0 0 4px;font-size:15px}footer{padding-top:18px;padding-bottom:50px;color:var(--muted);font-size:13px}
</style></head>
<body>
<header><strong>Sarang</strong><nav><a href="${esc(links.md.site)}">Sarang.md</a><a href="${esc(links.study.site)}">Study with Sarang</a><a href="${esc(links.md.page)}">Downloads</a></nav></header>
<main>
<h1>Downloads</h1>
<p class="sub">Study with Sarang, Sarang.md and the browser helper. Every file is served from this website. Both apps check for updates by themselves and ask before installing.</p>
${order.join('\n')}
<div class="note"><h3>Windows may ask you to confirm once</h3><p>The installers are signed with a self-made certificate, not a paid one, so Windows SmartScreen can show "Windows protected your PC". Choose <b>More info</b>, then <b>Run anyway</b>. Compare the SHA-256 above with the file if you want to be sure it is untouched. macOS and Android versions are not available yet; the web versions work on any device.</p></div>
<div class="note"><h3>What the apps send</h3><p>The desktop apps work offline and send nothing about you. They contact this website only to look for a newer version. The web versions use Vercel Web Analytics and Speed Insights to count visits and measure speed, without cookies; each app has a switch to turn it off.</p></div>
</main>
<footer>Checksums for these files: <a href="SHA256SUMS.txt">SHA256SUMS.txt</a>. Update feed for the apps: <a href="${esc(links.feed)}">updates/latest.json</a>.</footer>
<script>document.querySelectorAll('.copy').forEach(function(b){b.addEventListener('click',function(){var t=document.getElementById(b.getAttribute('data-copy')).textContent;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){b.textContent='Copied'},function(){var r=document.createRange();r.selectNodeContents(document.getElementById(b.getAttribute('data-copy')));var s=getSelection();s.removeAllRanges();s.addRange(r);b.textContent='Selected, press Ctrl+C'})})})</script>
</body></html>`;
}
