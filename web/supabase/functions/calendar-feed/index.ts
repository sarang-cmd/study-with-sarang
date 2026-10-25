// Calendar feed: GET ?t=<token> returns the private calendar (text/calendar) of the person who owns that token.
// Deploy with: supabase functions deploy calendar-feed --no-verify-jwt   (calendar apps cannot send a login)
// It only calls the SQL function calendar_feed_get (supabase/calendar.sql) with the public key. No secret key is used.
const URL_BASE = Deno.env.get('SUPABASE_URL') ?? '';
const KEY = Deno.env.get('CALENDAR_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const headers = {
  'content-type': 'text/calendar; charset=utf-8',
  'cache-control': 'public, max-age=300',
  'content-disposition': 'inline; filename="study-with-sarang.ics"',
  'x-robots-tag': 'noindex, nofollow',
};
const plain = (text: string, status: number) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

Deno.serve(async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return plain('Use GET.', 405);
  const token = new URL(request.url).searchParams.get('t') ?? '';
  if (!/^[a-f0-9]{32,64}$/.test(token)) return plain('Not found.', 404);
  if (!URL_BASE || !KEY) return plain('The calendar is not set up: the project key is missing.', 503);
  const response = await fetch(`${URL_BASE}/rest/v1/rpc/calendar_feed_get`, {
    method: 'POST',
    // A legacy anon key is a JWT and may also be the bearer; a publishable key (sb_publishable_...) goes in `apikey` only.
    headers: { apikey: KEY, ...(KEY.split('.').length === 3 ? { authorization: `Bearer ${KEY}` } : {}), 'content-type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  });
  if (!response.ok) return plain('The calendar could not be read.', 502);
  const ics = await response.json();
  if (typeof ics !== 'string' || !ics.startsWith('BEGIN:VCALENDAR')) return plain('Not found.', 404);
  return new Response(request.method === 'HEAD' ? null : ics, { status: 200, headers });
});
