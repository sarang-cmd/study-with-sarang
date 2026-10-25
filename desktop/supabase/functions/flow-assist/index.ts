// Flow Cloud: a small shared helper for the Flow voice assistant.
// POST ?action=transcribe  (body: audio bytes)       -> { text }
// (chat is no longer offered here: the free shared helper is for dictation only; chat and the assistant use each person's own key)
// The Groq key lives only here (secret GROQ_API_KEY). Each person gets FLOW_PER_DEVICE requests a day,
// each network address FLOW_PER_IP, and the whole service FLOW_GLOBAL_DAILY, so a leaked app cannot run up a bill.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GROQ = 'https://api.groq.com/openai/v1';
const STT_MODEL = Deno.env.get('FLOW_STT_MODEL') ?? 'whisper-large-v3-turbo';
const CHAT_MODEL = Deno.env.get('FLOW_CHAT_MODEL') ?? 'llama-3.3-70b-versatile';
const PER_DEVICE = Number(Deno.env.get('FLOW_PER_DEVICE') ?? 5);
const PER_IP = Number(Deno.env.get('FLOW_PER_IP') ?? 20);
const GLOBAL = Number(Deno.env.get('FLOW_GLOBAL_DAILY') ?? 500);
const MAX_AUDIO = 1_500_000; // about 90 seconds of compressed speech

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-flow-device',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

async function sha(text: string) {
  const bytes = new TextEncoder().encode(`${Deno.env.get('FLOW_SALT') ?? 'flow'}:${text}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) return json({ error: 'The helper is not set up: GROQ_API_KEY is missing.' }, 503);

  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  if (action === 'chat') return json({ error: 'The free helper covers speech to text only. Add your own AI key for chat.' }, 403);
  if (action !== 'transcribe') return json({ error: 'Unknown action.' }, 400);

  const device = (request.headers.get('x-flow-device') ?? '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
  if (device.length < 16) return json({ error: 'Missing device id.' }, 400);
  const address = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';

  // Read and validate the body before spending any allowance.
  let audio: Uint8Array | null = null;
  let payload: { system?: string; text?: string } = {};
  if (action === 'transcribe') {
    audio = new Uint8Array(await request.arrayBuffer());
    if (audio.byteLength < 800) return json({ text: '' });
    if (audio.byteLength > MAX_AUDIO) return json({ error: 'That recording is too long.' }, 413);
  } else {
    try { payload = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
    if (typeof payload.text !== 'string' || typeof payload.system !== 'string') return json({ error: 'Bad request.' }, 400);
    payload.text = payload.text.slice(0, 500); payload.system = payload.system.slice(0, 6000);
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const hit = async (who: string, limit: number) => {
    const { data, error } = await db.rpc('flow_hit', { p_who: who, p_limit: limit });
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data[0] : data;
  };
  try {
    const mine = await hit(`d:${device}`, PER_DEVICE);
    if (!mine?.allowed) return json({ error: 'Daily allowance used up.', limit: PER_DEVICE }, 429);
    const net = await hit(`i:${await sha(address)}`, PER_IP);
    if (!net?.allowed) return json({ error: 'Daily allowance for this network used up.' }, 429);
    const all = await hit('g', GLOBAL);
    if (!all?.allowed) return json({ error: 'The shared helper is at its daily limit. Try tomorrow or add your own key.' }, 429);
  } catch (error) {
    return json({ error: `Counter failed: ${(error as Error).message}` }, 500);
  }

  try {
    if (action === 'transcribe') {
      const form = new FormData();
      form.append('file', new Blob([audio!], { type: request.headers.get('content-type') ?? 'audio/webm' }), 'flow.webm');
      form.append('model', STT_MODEL);
      form.append('response_format', 'json');
      form.append('temperature', '0');
      const language = url.searchParams.get('language');
      if (language === 'en' || language === 'de') form.append('language', language);
      const reply = await fetch(`${GROQ}/audio/transcriptions`, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form });
      if (!reply.ok) return json({ error: `Speech service answered ${reply.status}.` }, 502);
      const data = await reply.json();
      return json({ text: String(data.text ?? '').slice(0, 600) });
    }
    const reply = await fetch(`${GROQ}/chat/completions`, {
      method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: CHAT_MODEL, temperature: 0.1, max_tokens: 300, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: payload.system }, { role: 'user', content: payload.text }] }),
    });
    if (!reply.ok) return json({ error: `AI service answered ${reply.status}.` }, 502);
    const data = await reply.json();
    return json({ reply: String(data.choices?.[0]?.message?.content ?? '').slice(0, 2000) });
  } catch {
    return json({ error: 'Could not reach the AI service.' }, 502);
  }
});
