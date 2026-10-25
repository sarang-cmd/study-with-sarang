import http from 'node:http';

/** A small stand-in for a Supabase project (Auth + PostgREST with per-user rows), for tests. */
export async function startMock() {
  const users = new Map(), tokens = new Map(), refresh = new Map(), rows = new Map();
  const flags = { failNextPatch: false, dropTable: false, requireConfirm: false, lastRedirect: null, lastAuth: undefined, pendingUsers: new Map() };
  const publishable = 'sb_publishable_mockkey123';
  let n = 0;
  const anon = `x.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.y`;
  const serviceRole = `x.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.y`;
  function session(user) {
    const access = `at-${++n}`, ref = `rt-${n}`; tokens.set(access, user.id); refresh.set(ref, user.id);
    return { access_token: access, refresh_token: ref, expires_in: 3600, user: { id: user.id, email: user.email } };
  }
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const text = Buffer.concat(chunks).toString(); const body = text ? JSON.parse(text) : {};
    const url = new URL(req.url, 'http://x');
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const send = (code, value) => { res.writeHead(code, { 'content-type': 'application/json', ...cors }); res.end(value === undefined ? '' : JSON.stringify(value)); };
    if (req.headers.apikey !== anon && req.headers.apikey !== publishable) return send(401, { message: 'No API key found in request' });
    const path = url.pathname;
    flags.lastAuth = req.headers.authorization;
    if (path === '/auth/v1/user' && req.method === 'PUT') {
      const uid = tokens.get((req.headers.authorization ?? '').replace('Bearer ', '')); const u = uid && users.get(uid);
      if (!u) return send(401, { msg: 'invalid JWT' });
      if (typeof body.password !== 'string' || body.password.length < 8) return send(422, { msg: 'Password should be at least 8 characters' });
      u.password = body.password; flags.passwordChanges = (flags.passwordChanges ?? 0) + 1; return send(200, { id: u.id, email: u.email });
    }
    if (path === '/auth/v1/recover') { flags.lastRedirect = url.searchParams.get('redirect_to'); const u = [...users.values()].find((x) => x.email === body.email); if (u) u.recovery = '246810'; flags.recoverCalls = (flags.recoverCalls ?? 0) + 1; return send(200, {}); }
    if (path === '/auth/v1/verify' && body.type === 'recovery') { const u = [...users.values()].find((x) => x.email === body.email); return u && u.recovery && body.token === u.recovery ? (u.recovery = '', send(200, session(u))) : send(403, { msg: 'Token has expired or is invalid' }); }
    if (path === '/auth/v1/user') { const uid = tokens.get((req.headers.authorization ?? '').replace('Bearer ', '')); const u = uid && users.get(uid); return u ? send(200, { id: u.id, email: u.email }) : send(401, { msg: 'invalid JWT' }); }
    if (path === '/auth/v1/resend') { const p = flags.pendingUsers.get(body.email); if (!p) return send(200, {}); p.code = '777777'; flags.lastRedirect = url.searchParams.get('redirect_to'); return send(200, {}); }
    if (path === '/auth/v1/signup') {
      if ([...users.values()].some((u) => u.email === body.email)) return send(422, { msg: 'User already registered' });
      flags.lastRedirect = url.searchParams.get('redirect_to');
      const user = { id: `u-${users.size + 1}`, email: body.email, password: body.password }; users.set(user.id, user);
      if (flags.requireConfirm) { flags.pendingUsers.set(body.email, { user, code: '654321' }); users.delete(user.id); return send(200, { id: user.id, email: user.email }); }
      return send(200, session(user));
    }
    if (path === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'password') {
        if (flags.pendingUsers.has(body.email)) return send(400, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
        const user = [...users.values()].find((u) => u.email === body.email && u.password === body.password);
        return user ? send(200, session(user)) : send(400, { error_description: 'Invalid login credentials' });
      }
      const id = refresh.get(body.refresh_token); return id ? send(200, session(users.get(id))) : send(400, { error_description: 'Invalid Refresh Token' });
    }
    if (path === '/auth/v1/otp') { users.set('otp', { ...(users.get('otp') ?? { id: `u-${users.size + 1}` }), email: body.email, code: '123456' }); return send(200, {}); }
    if (path === '/auth/v1/verify' && body.type === 'signup') {
      const p = flags.pendingUsers.get(body.email);
      if (!p || body.token !== p.code) return send(403, { msg: 'Token has expired or is invalid' });
      flags.pendingUsers.delete(body.email); users.set(p.user.id, p.user); return send(200, session(p.user));
    }
    if (path === '/auth/v1/verify') { const u = users.get('otp'); return u && body.token === u.code ? send(200, session(u)) : send(403, { msg: 'Token has expired or is invalid' }); }
    if (path === '/auth/v1/logout') return send(204);
    if (path === '/rest/v1/study_sync') {
      if (flags.dropTable) return send(404, { message: "Could not find the table 'public.study_sync' in the schema cache" });
      const uid = tokens.get((req.headers.authorization ?? '').replace('Bearer ', ''));
      if (!uid) return send(401, { message: 'JWT expired' });
      const filterUser = url.searchParams.get('user_id')?.replace('eq.', '');
      if (req.method === 'GET') return send(200, rows.has(uid) && (!filterUser || filterUser === uid) ? [{ data: rows.get(uid).data, rev: rows.get(uid).rev }] : []);
      if (req.method === 'POST') { if (body.user_id !== uid) return send(403, { message: 'new row violates row-level security policy' }); if (rows.has(uid)) return send(409, { message: 'duplicate key' }); rows.set(uid, { data: body.data, rev: body.rev }); return send(201, [body]); }
      if (req.method === 'PATCH') {
        const want = Number(url.searchParams.get('rev').replace('eq.', ''));
        const row = rows.get(uid);
        if (flags.failNextPatch) { flags.failNextPatch = false; if (row) row.rev += 1; return send(200, []); }
        if (!row || row.rev !== want) return send(200, []);
        rows.set(uid, { data: body.data, rev: body.rev }); return send(200, [body]);
      }
      if (req.method === 'DELETE') { rows.delete(uid); return send(204); }
    }
    send(404, {});
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));



  return { url: `http://127.0.0.1:${server.address().port}`, anon, publishable, serviceRole, users, tokens, rows, flags, mintToken: (user) => session(user).access_token, close: () => server.close() };
}
