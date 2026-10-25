import assert from 'node:assert/strict';
import http from 'node:http';
import { inviteUser, describeKey } from './invite-user.mjs';

const seen = [];
const server = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); seen.push({ path: req.url, auth: req.headers.authorization, body });
  const send = (code, value) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (body.email === 'taken@x.test') return send(422, { msg: 'A user with this email address has already been registered' });
  if (req.headers.apikey !== 'sb_secret_test') return send(401, { msg: 'invalid key' });
  send(200, { id: 'u-1', email: body.email });
}).listen(0);
await new Promise((r) => server.on('listening', r));
const url = `http://127.0.0.1:${server.address().port}`;
const secret = 'sb_secret_test';
const done = await inviteUser({ url, key: secret, email: ' New@X.test ', redirectTo: 'https://site.example/', name: 'Ada' });
assert.equal(done.email, 'New@X.test'); assert.equal(seen[0].path, '/auth/v1/invite?redirect_to=https%3A%2F%2Fsite.example%2F'); assert.equal(seen[0].auth, `Bearer ${secret}`); assert.deepEqual(seen[0].body, { email: 'New@X.test', data: { name: 'Ada' } });
await assert.rejects(inviteUser({ url, key: secret, email: 'taken@x.test' }), /already has an account/);
await assert.rejects(inviteUser({ url, key: 'sb_publishable_abc', email: 'a@x.test' }), /public \(publishable\) key/);
await assert.rejects(inviteUser({ url, key: '', email: 'a@x.test' }), /Set SUPABASE_SERVICE_ROLE_KEY/);
await assert.rejects(inviteUser({ url, key: secret, email: 'not-an-email' }), /does not look like an email/);
await assert.rejects(inviteUser({ url: 'https://evil.example.com', key: secret, email: 'a@x.test' }), /SUPABASE_URL should look like/);
await assert.rejects(inviteUser({ url, key: 'wrong_key', email: 'a@x.test' }), /not sent: invalid key/);
const anon = `x.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.y`; assert.equal(describeKey(anon), 'publishable');
assert.equal(describeKey(`x.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.y`), 'secret');
server.close();
console.log('Verified invite script: sends the secret key only as a header, refuses the public key, bad addresses and foreign hosts, explains existing accounts.');
