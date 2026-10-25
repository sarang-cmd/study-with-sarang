'use strict';
/** A tiny stand-in for the website's update feed (/updates/latest.json) and its downloads, for the update tests. */
const crypto = require('node:crypto');
const http = require('node:http');

async function startMockFeed({ version = '9.9.9', notes = 'Fixes and a calmer start.', payload } = {}) {
  const body = payload ?? Buffer.concat([Buffer.from('MZ'), crypto.randomBytes(200000)]);
  const sha = crypto.createHash('sha256').update(body).digest('hex');
  const state = { hits: [], mode: 'ok', latest: version, notes, body, sha, none: false, noHash: false, rateLimit: false };
  const server = http.createServer((req, res) => {
    state.hits.push(req.url);
    const base = `http://127.0.0.1:${server.address().port}`;
    if (req.url.split('?')[0] === '/updates/latest.json') {
      if (state.rateLimit) { res.writeHead(503); res.end('{}'); return; }
      if (state.none) { res.writeHead(404); res.end('{}'); return; }
      const name = `Study-with-Sarang-${state.latest}.exe`;
      const windows = { file: name, url: `${base}/dl/${name}`, size: body.length, ...(state.noHash ? {} : { sha256: state.mode === 'badhash' ? 'a'.repeat(64) : sha }) };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ schema: 1, app: 'study-with-sarang', version: state.latest, notes: state.notes, page: `${base}/downloads`, windows }));
      return;
    }
    if (req.url.startsWith('/dl/')) { res.writeHead(302, { location: `${base}/files${req.url.slice(3)}` }); res.end(); return; }
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

module.exports = { startMockFeed };
