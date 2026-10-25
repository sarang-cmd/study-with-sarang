'use strict';
/** A tiny stand-in for the GitHub releases API and file downloads, for the update tests. */
const crypto = require('node:crypto');
const http = require('node:http');

async function startMockGithub({ version = '9.9.9', notes = 'Fixes and a calmer start.', payload } = {}) {
  const body = payload ?? Buffer.concat([Buffer.from('MZ'), crypto.randomBytes(200000)]);
  const sha = crypto.createHash('sha256').update(body).digest('hex');
  const state = { hits: [], mode: 'ok', latest: version, notes, body, sha, draft: false, prerelease: false, none: false, sumFile: true, digest: false, rateLimit: false };
  const server = http.createServer((req, res) => {
    state.hits.push(req.url);
    const base = `http://127.0.0.1:${server.address().port}`;
    if (req.url.startsWith('/repos/') && req.url.endsWith('/releases/latest')) {
      if (state.rateLimit) { res.writeHead(403); res.end('{}'); return; }
      if (state.none) { res.writeHead(404); res.end('{}'); return; }
      const name = `Study-with-Sarang-${state.latest}.exe`;
      const assets = [{ name, size: body.length, browser_download_url: `${base}/dl/${name}`, ...(state.digest ? { digest: `sha256:${sha}` } : {}) }];
      if (state.sumFile) assets.push({ name: `${name}.sha256`, size: 100, browser_download_url: `${base}/dl/${name}.sha256` });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ tag_name: `v${state.latest}`, body: state.notes, html_url: 'https://github.com/o/r/releases/tag/v' + state.latest, draft: state.draft, prerelease: state.prerelease, assets }));
      return;
    }
    if (req.url.startsWith('/dl/')) { res.writeHead(302, { location: `${base}/files${req.url.slice(3)}` }); res.end(); return; }
    if (req.url.endsWith('.sha256')) { res.writeHead(200); res.end(`${state.mode === 'badhash' ? 'a'.repeat(64) : sha}  Study-with-Sarang-${state.latest}.exe\n`); return; }
    if (req.url.startsWith('/files/')) {
      let data = body;
      if (state.mode === 'truncate') { res.writeHead(200, { 'content-length': String(body.length) }); res.write(body.subarray(0, 5000)); setTimeout(() => res.destroy(), 20); return; }
      if (state.mode === 'notexe') data = Buffer.from('<html>not a program</html>'.padEnd(body.length, ' '));
      res.writeHead(200, { 'content-length': String(data.length) });
      res.end(data);
      return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, state, close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }) };
}

module.exports = { startMockGithub };
