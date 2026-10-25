/**
 * Flow's cloud helpers: turning speech into text, working out an unclear request, and speaking an answer.
 * They are used only when the built-in command understanding is unsure (see lib/intent), never for what is clear.
 *
 * Any service that speaks the common "OpenAI-style" API can be used: Groq (free tier, Whisper), OpenAI, OpenRouter, Gemini,
 * Anthropic, a local server such as Ollama or LM Studio, or your own address. "Flow Cloud" is an optional shared helper with a small
 * daily allowance that you host yourself (supabase/functions/flow-assist). Keys are yours, stay on this device, and are never synced
 * or exported.
 */
import { COMMANDS, splitCommand } from './commands';

export type ProviderId = 'cloud' | 'groq' | 'gemini' | 'openrouter' | 'mistral' | 'github' | 'ollama' | 'openai' | 'anthropic' | 'custom';
/** free: what it costs you. "service" is the app's own shared helper, "tier" a provider's free plan, "local" runs on your computer. */
export type Cost = 'service' | 'tier' | 'local' | 'paid';
export interface ProviderInfo {
  id: ProviderId; label: string; short: string; baseUrl: string; stt?: string; chat?: string; tts?: string; ttsVoice?: string;
  needsKey: boolean; keyUrl?: string; note: string; ttsFormat?: 'mp3' | 'wav'; ttsMax?: number;
  cost: Cost; freeNote: string;   // What "free" means here, and its catch
  steps: string[];                // How to get a key, in order
}
/** Free plans change often. Models and limits below were checked in October 2026; the walkthrough tells you to confirm on the provider's page. */
export const PROVIDERS_CHECKED = 'October 2026';
export const PROVIDERS: ProviderInfo[] = [
  { id: 'cloud', label: 'Flow Cloud (free dictation, 5 a day)', short: 'Flow Cloud', baseUrl: '', stt: 'whisper-large-v3-turbo', needsKey: false, cost: 'service', freeNote: 'Free speech to text, 5 requests a day per person, for the voice key only. Nothing else uses it.', steps: ['Nothing to do. It works as soon as the project is set up.'], note: 'Needs no key. 5 dictation requests a day, enforced by the service. Chat and the assistant always use your own key.' },
  { id: 'groq', label: 'Groq (free plan)', short: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', stt: 'whisper-large-v3-turbo', chat: 'openai/gpt-oss-20b', tts: 'canopylabs/orpheus-v1-english', ttsVoice: 'hannah', ttsFormat: 'wav', ttsMax: 190, needsKey: true, keyUrl: 'https://console.groq.com/keys', cost: 'tier', freeNote: 'Free plan, no card, email sign-up. Very fast. Open models only; roughly 30 requests a minute and 1,000 a day in 2026. Also does speech to text.', steps: ['Open console.groq.com and sign up with your email.', 'Open API Keys and press Create API key.', 'Copy the key (it starts with gsk_) and paste it here.'], note: 'Fast speech to text and chat, generous free plan.' },
  { id: 'gemini', label: 'Google Gemini (free tier)', short: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', chat: 'gemini-2.5-flash', tts: 'gemini-3.1-flash-tts-preview', ttsVoice: 'Kore', ttsFormat: 'wav', needsKey: true, keyUrl: 'https://aistudio.google.com/apikey', cost: 'tier', freeNote: 'Free for the Flash models, no card, a Google account. Catch: outside the EU, UK and EEA, Google may use free-tier prompts to improve its products.', steps: ['Open aistudio.google.com/apikey and sign in with Google.', 'Press Create API key.', 'Copy the key and paste it here.'], note: 'The most capable free chat models. No speech to text here, pair it with Groq for that.' },
  { id: 'openrouter', label: 'OpenRouter (free models)', short: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', chat: 'openai/gpt-oss-20b:free', needsKey: true, keyUrl: 'https://openrouter.ai/keys', cost: 'tier', freeNote: 'One key for about twenty free models (their names end in :free). 20 requests a minute and 50 a day, or 1,000 a day after a one-time $10 top-up. The free list changes often.', steps: ['Open openrouter.ai and sign up.', 'Open Keys and create a key.', 'Paste it here, then press "Find models" and pick one that ends in :free.'], note: 'Many models behind one key, some free. No speech to text.' },
  { id: 'mistral', label: 'Mistral (free plan)', short: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', chat: 'mistral-small-latest', needsKey: true, keyUrl: 'https://console.mistral.ai/api-keys', cost: 'tier', freeNote: 'A free plan with a monthly allowance, no card, phone verification. Catch: the free Experiment plan may use your prompts to improve models.', steps: ['Open console.mistral.ai and create an account (a phone number is checked).', 'Choose the free Experiment plan.', 'Open API keys, create one and paste it here.'], note: 'European provider with a free plan. Chat only.' },
  { id: 'github', label: 'GitHub Models (free for prototyping)', short: 'GitHub', baseUrl: 'https://models.github.ai/inference', chat: 'openai/gpt-4.1-mini', needsKey: true, keyUrl: 'https://github.com/settings/personal-access-tokens/new', cost: 'tier', freeNote: 'Free with a GitHub account, small daily limits. Uses a GitHub token with the "Models" permission instead of a key.', steps: ['Open github.com/settings/personal-access-tokens/new.', 'Give it a name and, under Permissions, allow Models (read).', 'Generate the token and paste it here.'], note: 'Several well-known models with a GitHub token. Chat only.' },
  { id: 'ollama', label: 'Ollama (on this computer)', short: 'Ollama', baseUrl: 'http://localhost:11434/v1', chat: 'llama3.2', needsKey: false, cost: 'local', freeNote: 'Free and private: runs on your own computer, nothing leaves it. Needs a reasonably modern PC and a download of a few GB.', steps: ['Install Ollama from ollama.com and start it.', 'In a terminal run: ollama pull llama3.2 (or another model that supports tools).', 'Come back and press Test. No key is needed.'], note: 'Runs locally. Pick a model that supports tools if you want the assistant to act.' },
  { id: 'openai', label: 'OpenAI (paid)', short: 'OpenAI', baseUrl: 'https://api.openai.com/v1', stt: 'gpt-4o-mini-transcribe', chat: 'gpt-4o-mini', tts: 'gpt-4o-mini-tts', ttsVoice: 'alloy', ttsFormat: 'mp3', needsKey: true, keyUrl: 'https://platform.openai.com/api-keys', cost: 'paid', freeNote: 'Paid, billed by use. Cheap models cost fractions of a cent per request.', steps: ['Open platform.openai.com and sign in.', 'Add a small prepaid balance under Billing.', 'Open API keys, create a key and paste it here.'], note: 'Speech to text, chat and voices.' },
  { id: 'anthropic', label: 'Anthropic Claude (paid)', short: 'Claude', baseUrl: 'https://api.anthropic.com/v1', chat: 'claude-haiku-4-5', needsKey: true, keyUrl: 'https://console.anthropic.com/settings/keys', cost: 'paid', freeNote: 'Paid, billed by use.', steps: ['Open console.anthropic.com and sign in.', 'Add credit under Billing.', 'Open API keys, create a key and paste it here.'], note: 'Chat only. Uses Anthropic\'s OpenAI-compatible endpoint.' },
  { id: 'custom', label: 'Custom address (LM Studio, others)', short: 'Custom', baseUrl: '', needsKey: false, cost: 'local', freeNote: 'Any server that speaks the common OpenAI-style API, on your computer or elsewhere.', steps: ['Start your server and note its address, for example http://localhost:1234/v1.', 'Type the address below, then a model name.', 'Press Test.'], note: 'Any OpenAI-style address. A key is optional.' },
];
/** Voices each service offers (for the picker). Names the service accepts; the first is the default. */
export const TTS_VOICES: Partial<Record<ProviderId, string[]>> = {
  groq: ['hannah', 'autumn', 'diana', 'austin', 'daniel', 'troy'],
  gemini: ['Kore', 'Puck', 'Charon', 'Zephyr', 'Fenrir', 'Leda', 'Aoede', 'Sulafat', 'Achird', 'Gacrux', 'Orus', 'Enceladus'],
  openai: ['alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'],
};
/** Voices that only speak English. German and other replies use the system voice instead. */
export const TTS_ENGLISH_ONLY: ProviderId[] = ['groq'];
export const providerInfo = (id: string) => PROVIDERS.find((item) => item.id === id) ?? PROVIDERS[0];

export type Kind = 'stt' | 'chat' | 'tts';
export interface FlowApiSettings {
  sttProvider: ProviderId | 'off'; chatProvider: ProviderId | 'off'; ttsEngine: 'off' | 'system' | ProviderId;
  sttModel: string; chatModel: string; ttsModel: string; ttsVoice: string;
  customUrl: string;     // Base address for "Custom"
  cloudUrl: string;      // Base address of Flow Cloud (your own Supabase function)
  language: 'auto' | 'en' | 'de';
  dailyLimit: number;    // Your own cap for your own keys, 0 = none
  cloudLimit: number;    // What the app expects Flow Cloud to allow per day (the service enforces it)
}
export type Keys = Partial<Record<ProviderId, string>>;

export interface Resolved { url: string; headers: Record<string, string>; model: string; provider: ProviderId; cloud: boolean }
export class FlowApiError extends Error {
  constructor(public code: 'no-provider' | 'no-key' | 'no-address' | 'limit' | 'cloud-unavailable' | 'http' | 'network' | 'bad-reply' | 'blocked', message: string, public status = 0) { super(message); }
}

function cleanBase(value: string): string {
  const text = value.trim().replace(/\/+$/, '');
  try {
    const url = new URL(text);
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && local)) return url.href.replace(/\/+$/, '');
  } catch { /* Not an address. */ }
  return '';
}

export function resolve(kind: Kind, settings: FlowApiSettings, keys: Keys, publishable?: { url: string; key: string }): Resolved {
  const choice = kind === 'stt' ? settings.sttProvider : kind === 'chat' ? settings.chatProvider : settings.ttsEngine;
  if (choice === 'off' || choice === 'system') throw new FlowApiError('no-provider', kind === 'stt' ? 'No speech-to-text service is chosen.' : kind === 'chat' ? 'No AI service is chosen.' : 'No voice service is chosen.');
  const info = providerInfo(choice);
  // A saved name that the provider has retired (Groq's playai voices were replaced by Orpheus in 2026) falls back to the current default.
  const saved = (kind === 'stt' ? settings.sttModel : kind === 'chat' ? settings.chatModel : settings.ttsModel).trim();
  const model = (kind === 'tts' && /^playai/i.test(saved) ? '' : saved) || (info[kind] ?? '');
  if (info.id === 'cloud') {
    if (kind !== 'stt') throw new FlowApiError('no-provider', 'The free shared helper covers speech to text only. Add your own key for chat and the assistant (Settings > Flow voice and AI).');
    const base = cleanBase(settings.cloudUrl || (publishable?.url ? `${publishable.url.replace(/\/+$/, '')}/functions/v1/flow-assist` : ''));
    if (!base) throw new FlowApiError('no-address', 'Flow Cloud has no address yet. See Settings > Flow.');
    const headers: Record<string, string> = {};
    if (publishable?.key) { headers.apikey = publishable.key; headers.authorization = `Bearer ${publishable.key}`; }
    return { url: base, headers, model, provider: 'cloud', cloud: true };
  }
  const base = info.id === 'custom' ? cleanBase(settings.customUrl) : info.baseUrl;
  if (!base) throw new FlowApiError('no-address', 'The custom address is missing or not allowed. Use https, or http on this computer.');
  if (!info[kind] && info.id !== 'custom') throw new FlowApiError('no-provider', `${info.label} does not offer ${kind === 'stt' ? 'speech to text' : kind === 'chat' ? 'chat' : 'voices'}.`);
  const key = (keys[info.id] ?? '').trim();
  if (info.needsKey && !key) throw new FlowApiError('no-key', `Add your ${info.label.split(' (')[0]} key in Settings > Flow.`);
  if (!model) throw new FlowApiError('no-provider', 'A model name is needed for this service.');
  const headers: Record<string, string> = {};
  if (key) headers.authorization = `Bearer ${key}`;
  if (kind === 'tts' && info.id === 'gemini') {
    // Gemini's voices use its own request format, not the OpenAI-style one.
    return { url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, headers: { 'x-goog-api-key': key }, model, provider: 'gemini', cloud: false };
  }
  const path = kind === 'stt' ? '/audio/transcriptions' : kind === 'chat' ? '/chat/completions' : '/audio/speech';
  return { url: `${base}${path}`, headers, model, provider: info.id, cloud: false };
}

// ---------------------------------------------------------------------------------------------- fetching
export interface HttpRequest { url: string; method: 'POST' | 'GET'; headers: Record<string, string>; body?: ArrayBuffer | string }
export interface HttpResponse { status: number; headers: Record<string, string>; body: ArrayBuffer }
export type Fetcher = (request: HttpRequest) => Promise<HttpResponse>;

/** The browser's own fetch. In the desktop app the shell's network layer is used instead (no browser cross-origin limits). */
export const browserFetcher: Fetcher = async (request) => {
  const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body as BodyInit | undefined, cache: 'no-store', credentials: 'omit' });
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
  return { status: response.status, headers, body: await response.arrayBuffer() };
};

const text = (response: HttpResponse) => new TextDecoder().decode(response.body);
function failure(response: HttpResponse, cloud: boolean): FlowApiError {
  let detail = '';
  try { const parsed = JSON.parse(text(response)) as { error?: string | { message?: string }; message?: string }; detail = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message ?? parsed.message ?? ''; } catch { detail = text(response).slice(0, 120); }
  detail = detail.replace(/\s+/g, ' ').slice(0, 160);
  if (response.status === 429 && cloud) return new FlowApiError('limit', 'Flow Cloud\'s allowance for today is used up. It resets tomorrow, or add your own key.', 429);
  if (response.status === 401 || response.status === 403) return new FlowApiError('http', `The service refused the key${detail ? `: ${detail}` : '.'}`, response.status);
  if (response.status === 404 && cloud) return new FlowApiError('cloud-unavailable', 'Flow Cloud is not set up at this address yet.', 404);
  if (response.status === 429) return new FlowApiError('http', 'The service says you are sending too many requests. Try again in a minute.', 429);
  return new FlowApiError('http', `The service answered ${response.status}${detail ? `: ${detail}` : '.'}`, response.status);
}

// ---------------------------------------------------------------------------------------------- daily allowance
export interface UsageStore { get(): { day: string; count: number } | null; set(value: { day: string; count: number }): void }
export const dayKey = (now = Date.now()) => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function usageToday(store: UsageStore, now = Date.now()): number { const v = store.get(); return v && v.day === dayKey(now) ? v.count : 0; }
export function limitFor(settings: FlowApiSettings, cloud: boolean): number { return cloud ? settings.cloudLimit : settings.dailyLimit; }
export function checkAllowance(store: UsageStore, settings: FlowApiSettings, cloud: boolean, now = Date.now()): { ok: boolean; used: number; limit: number } {
  const used = usageToday(store, now), limit = limitFor(settings, cloud);
  return { ok: limit <= 0 || used < limit, used, limit };
}
export function recordUse(store: UsageStore, now = Date.now()) { store.set({ day: dayKey(now), count: usageToday(store, now) + 1 }); }

export interface Deps { fetcher: Fetcher; usage: UsageStore; device: string; now?: () => number }

function guard(resolved: Resolved, settings: FlowApiSettings, deps: Deps) {
  const allowance = checkAllowance(deps.usage, settings, resolved.cloud, deps.now?.());
  if (!allowance.ok) throw new FlowApiError('limit', resolved.cloud ? `Flow Cloud allows ${allowance.limit} requests a day and you have used them. It resets tomorrow.` : `Your daily limit of ${allowance.limit} requests is used. Raise it in Settings > Flow.`);
}

// ---------------------------------------------------------------------------------------------- speech to text
const VOCAB = 'Voice commands for a focus app called Flow: play, pause, next, louder, quieter, volume forty, volume full, start timer, pause timer, skip break, zen mode, breathe, simple view, load mix, run macro.';

/** Whisper-style transcription of a short recording. Returns the words, or an empty string for silence. */
export async function transcribe(audio: ArrayBuffer, mime: string, settings: FlowApiSettings, keys: Keys, deps: Deps, publishable?: { url: string; key: string }, hints: string[] = []): Promise<string> {
  const target = resolve('stt', settings, keys, publishable);
  guard(target, settings, deps);
  const ext = /ogg/.test(mime) ? 'ogg' : /mp4|m4a|aac/.test(mime) ? 'm4a' : /wav/.test(mime) ? 'wav' : /mpeg|mp3/.test(mime) ? 'mp3' : 'webm';
  let response: HttpResponse;
  try {
    if (target.cloud) {
      response = await deps.fetcher({ url: `${target.url}?action=transcribe${settings.language !== 'auto' ? `&language=${settings.language}` : ''}`, method: 'POST', headers: { ...target.headers, 'content-type': mime || 'audio/webm', 'x-flow-device': deps.device }, body: audio });
    } else {
      const form = new FormData();
      form.append('file', new Blob([audio], { type: mime || 'audio/webm' }), `flow.${ext}`);
      form.append('model', target.model);
      form.append('response_format', 'json');
      form.append('temperature', '0');
      if (settings.language !== 'auto') form.append('language', settings.language);
      form.append('prompt', `${VOCAB}${hints.length ? ` Names: ${hints.slice(0, 20).join(', ')}.` : ''}`.slice(0, 600));
      const packed = new Response(form);
      response = await deps.fetcher({ url: target.url, method: 'POST', headers: { ...target.headers, 'content-type': packed.headers.get('content-type') ?? '' }, body: await packed.arrayBuffer() });
    }
  } catch (error) { if (error instanceof FlowApiError) throw error; throw new FlowApiError('network', 'Could not reach the speech service. Check your internet connection.'); }
  recordUse(deps.usage, deps.now?.());
  if (response.status < 200 || response.status >= 300) throw failure(response, target.cloud);
  try { const parsed = JSON.parse(text(response)) as { text?: unknown }; return typeof parsed.text === 'string' ? parsed.text.replace(/\s+/g, ' ').trim() : ''; } catch { throw new FlowApiError('bad-reply', 'The speech service sent something unexpected.'); }
}

// ---------------------------------------------------------------------------------------------- understanding and answering
export interface AskContext { mixNames: string[]; macroNames: string[]; playing: boolean; volume: number; timerRunning: boolean; level: string; answers: boolean; language: 'auto' | 'en' | 'de' }
export type AskResult = { type: 'command'; command: string; say?: string } | { type: 'answer'; text: string } | { type: 'none' };

/** Commands the assistant may use. Anything else it returns is ignored. */
export const ALLOWED_IDS = new Set([...COMMANDS.map((item) => item.id), 'calm.open', 'calm.close', 'calm.breathe', 'calm.scene', 'calm.wind', 'calm.ground', 'ui.simple', 'settings.open']);
const CALM_ARGS: Record<string, RegExp> = { 'calm.breathe': /^(box|478|coherent|relax|)$/, 'calm.wind': /^(\d{1,3}|off|)$/, 'calm.scene': /^(aurora|rain|stars|ripples|embers|drift)$/, 'ui.simple': /^(on|off|toggle)$/,
  'timer.countdown': /^\d{1,3}$/, 'timer.session': /^\d{0,3}(;[^\u0000-\u001f]{1,100})?$/, 'page.go': /^(studio|library|progress|focus)$/, 'theme.set': /^(dark|light|toggle)$/,
  'info': /^(time|date|today|streak|goal|todos|exam|left|playing)$/, 'system.volume': /^(up|down|mute)(:\d{1,2})?$/,
  'todo.add': /^[^\u0000-\u001f]{1,140}$/, 'todo.done': /^[^\u0000-\u001f]{1,140}$/, 'goal.set': /^[^\u0000-\u001f]{1,140}$/, 'goal.start': /^[^\u0000-\u001f]{1,140}$/, 'review.add': /^[^\u0000-\u001f]{1,140}$/ };
export function validateCommand(raw: string, ctx: Pick<AskContext, 'mixNames' | 'macroNames'>): string | null {
  const { id, arg } = splitCommand(raw.trim());
  if (!ALLOWED_IDS.has(id)) return null;
  if (id === 'volume.set') { const n = Number(arg); return Number.isFinite(n) ? `volume.set:${Math.max(0, Math.min(100, Math.round(n)))}` : null; }
  if (id === 'mix.load') { const hit = ctx.mixNames.find((name) => name.toLowerCase() === arg.toLowerCase()); return hit ? `mix.load:${hit}` : null; }
  if (id === 'macro.run') { const hit = ctx.macroNames.find((name) => name.toLowerCase() === arg.toLowerCase()); return hit ? `macro.run:${hit}` : null; }
  if (CALM_ARGS[id]) return CALM_ARGS[id].test(arg) ? (arg ? `${id}:${arg}` : id) : null;
  if (id === 'app.quit' || id === 'app.login' || id === 'app.update') return null;
  if (arg) return id === 'window.compact' || id === 'window.pin' ? `${id}:${arg.slice(0, 8)}` : null;
  return id;
}

export function buildSystemPrompt(ctx: AskContext): string {
  const list = COMMANDS.filter((item) => !['window.pin', 'shortcuts.toggle'].includes(item.id)).map((item) => `${item.id}${item.arg === 'volume' ? ':0-100' : item.arg === 'mix' ? ':<mix name>' : item.arg === 'macro' ? ':<macro name>' : ''} = ${item.label}`);
  list.push('calm.breathe[:box|478|coherent] = start a breathing guide', 'calm.open = open the calm screen', 'calm.close = close it', 'calm.scene:aurora|rain|stars|ripples|embers|drift = show a calm scene', 'ui.simple:on|off|toggle = simpler or full interface', 'settings.open = open settings');
  return [
    'You are Flow, the voice assistant inside a focus and ambient sound app. The user speaks short requests.',
    'Reply with ONE JSON object and nothing else.',
    'If the request maps to an app command, reply {"command":"<id[:arg]>"} using only these commands:',
    ...list,
    `Mixes the user has: ${ctx.mixNames.slice(0, 40).join(', ') || 'none'}.`,
    `Macros: ${ctx.macroNames.slice(0, 20).join(', ') || 'none'}.`,
    `State: sound ${ctx.playing ? 'playing' : 'paused'}, volume ${ctx.volume}, timer ${ctx.timerRunning ? 'running' : 'stopped'}, interface level ${ctx.level}.`,
    ctx.answers
      ? 'If it is a question or a request for help that is not a command, reply {"answer":"<one to three short sentences, plain text, no markdown>"}.'
      : 'If it is not a command, reply {"none":true}. Do not answer questions.',
    'If you cannot tell what is wanted, reply {"none":true}. Never invent commands. Use the same language as the user.',
  ].join('\n');
}

export function parseAsk(raw: string, ctx: AskContext): AskResult {
  let body = raw.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(body);
  if (fence) body = fence[1].trim();
  const start = body.indexOf('{'), end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return { type: 'none' };
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>; } catch { return { type: 'none' }; }
  if (typeof parsed.command === 'string') {
    const command = validateCommand(parsed.command, ctx);
    if (command) return { type: 'command', command, say: typeof parsed.say === 'string' ? parsed.say.slice(0, 160) : undefined };
  }
  if (ctx.answers && typeof parsed.answer === 'string' && parsed.answer.trim()) return { type: 'answer', text: parsed.answer.replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 700) };
  return { type: 'none' };
}

/** Asks the chat service what a sentence means. One request. */
export async function ask(sentence: string, ctx: AskContext, settings: FlowApiSettings, keys: Keys, deps: Deps, publishable?: { url: string; key: string }): Promise<AskResult> {
  const target = resolve('chat', settings, keys, publishable);
  guard(target, settings, deps);
  const system = buildSystemPrompt(ctx);
  let response: HttpResponse;
  try {
    if (target.cloud) {
      response = await deps.fetcher({ url: `${target.url}?action=chat`, method: 'POST', headers: { ...target.headers, 'content-type': 'application/json', 'x-flow-device': deps.device }, body: JSON.stringify({ system, text: sentence.slice(0, 500) }) });
    } else {
      const body: Record<string, unknown> = { model: target.model, temperature: 0.1, max_tokens: 300, messages: [{ role: 'system', content: system }, { role: 'user', content: sentence.slice(0, 500) }] };
      if (target.provider === 'groq' || target.provider === 'openai') body.response_format = { type: 'json_object' };
      response = await deps.fetcher({ url: target.url, method: 'POST', headers: { ...target.headers, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    }
  } catch (error) { if (error instanceof FlowApiError) throw error; throw new FlowApiError('network', 'Could not reach the AI service. Check your internet connection.'); }
  recordUse(deps.usage, deps.now?.());
  if (response.status < 200 || response.status >= 300) throw failure(response, target.cloud);
  let content = '';
  try { const parsed = JSON.parse(text(response)) as { choices?: { message?: { content?: unknown } }[]; reply?: unknown }; content = typeof parsed.reply === 'string' ? parsed.reply : String(parsed.choices?.[0]?.message?.content ?? ''); } catch { throw new FlowApiError('bad-reply', 'The AI service sent something unexpected.'); }
  return parseAsk(content, ctx);
}

/**
 * One plain chat request: a system prompt, a user message, the reply text. For features other than voice commands (drift check,
 * the study helper). With `ownKeyOnly` the free shared service is refused, so only the user's own key is ever used.
 */
export async function chatText(system: string, user: string, settings: FlowApiSettings, keys: Keys, deps: Deps, opts: { ownKeyOnly?: boolean; maxTokens?: number; json?: boolean } = {}, publishable?: { url: string; key: string }): Promise<string> {
  const target = resolve('chat', settings, keys, publishable);
  if (target.cloud && opts.ownKeyOnly) throw new FlowApiError('no-key', 'This needs your own AI key. Add one in Settings > Flow voice and AI.');
  guard(target, settings, deps);
  let response: HttpResponse;
  try {
    if (target.cloud) response = await deps.fetcher({ url: `${target.url}?action=chat`, method: 'POST', headers: { ...target.headers, 'content-type': 'application/json', 'x-flow-device': deps.device }, body: JSON.stringify({ system, text: user.slice(0, 500) }) });
    else {
      const body: Record<string, unknown> = { model: target.model, temperature: 0.1, max_tokens: opts.maxTokens ?? 200, messages: [{ role: 'system', content: system }, { role: 'user', content: user.slice(0, 4000) }] };
      if (opts.json && (target.provider === 'groq' || target.provider === 'openai')) body.response_format = { type: 'json_object' };
      response = await deps.fetcher({ url: target.url, method: 'POST', headers: { ...target.headers, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    }
  } catch (error) { if (error instanceof FlowApiError) throw error; throw new FlowApiError('network', 'Could not reach the AI service. Check your internet connection.'); }
  recordUse(deps.usage, deps.now?.());
  if (response.status < 200 || response.status >= 300) throw failure(response, target.cloud);
  try { const parsed = JSON.parse(text(response)) as { choices?: { message?: { content?: unknown } }[]; reply?: unknown }; return typeof parsed.reply === 'string' ? parsed.reply : String(parsed.choices?.[0]?.message?.content ?? ''); } catch { throw new FlowApiError('bad-reply', 'The AI service sent something unexpected.'); }
}

/** A chat turn where the AI may call tools (OpenAI-style function calling). Own key or local server only, never the shared helper. */
export async function chatWithTools(messages: { role: string; content: string | null; tool_calls?: unknown; tool_call_id?: string; name?: string }[], tools: { name: string; description: string; parameters: unknown }[], settings: FlowApiSettings, keys: Keys, deps: Deps): Promise<{ content: string; tool_calls: { id: string; type: 'function'; function: { name: string; arguments: string } }[] }> {
  const target = resolve('chat', settings, keys);
  if (target.cloud) throw new FlowApiError('no-key', 'The assistant needs your own AI key. Add one in Settings > Flow voice and AI.');
  guard(target, settings, deps);
  const body: Record<string, unknown> = { model: target.model, temperature: 0.2, max_tokens: 900, messages };
  if (tools.length) { body.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })); body.tool_choice = 'auto'; }
  let response: HttpResponse;
  try { response = await deps.fetcher({ url: target.url, method: 'POST', headers: { ...target.headers, 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
  catch (error) { if (error instanceof FlowApiError) throw error; throw new FlowApiError('network', 'Could not reach the AI service. Check your internet connection.'); }
  recordUse(deps.usage, deps.now?.());
  if (response.status === 400 && /tool|function/i.test(text(response))) throw new FlowApiError('http', 'This model does not support tools, so it cannot act in the app. Pick another model in Settings > Flow voice and AI (the walkthrough suggests ones that do).', 400);
  if (response.status < 200 || response.status >= 300) throw failure(response, false);
  try {
    const parsed = JSON.parse(text(response)) as { choices?: { message?: { content?: unknown; tool_calls?: { id?: unknown; function?: { name?: unknown; arguments?: unknown } }[] } }[] };
    const message = parsed.choices?.[0]?.message ?? {};
    const calls = (Array.isArray(message.tool_calls) ? message.tool_calls : []).slice(0, 8).map((c, i) => ({
      id: typeof c.id === 'string' && c.id ? c.id : `call_${i}`, type: 'function' as const,
      function: { name: String(c.function?.name ?? ''), arguments: typeof c.function?.arguments === 'string' ? c.function.arguments : JSON.stringify(c.function?.arguments ?? {}) },
    })).filter((c) => c.function.name);
    return { content: typeof message.content === 'string' ? message.content : '', tool_calls: calls };
  } catch { throw new FlowApiError('bad-reply', 'The AI service sent something unexpected.'); }
}

/** Model names a provider offers (OpenAI-style GET /models). Used by the walkthrough's "Find models". */
export async function listModels(provider: ProviderId, settings: FlowApiSettings, keys: Keys, deps: Deps): Promise<string[]> {
  const probe: FlowApiSettings = { ...settings, chatProvider: provider, chatModel: (settings.chatProvider === provider ? settings.chatModel : '') || 'list' }; // the name is not used for a list
  const target = resolve('chat', probe, keys);
  if (target.cloud) return [];
  let response: HttpResponse;
  try { response = await deps.fetcher({ url: target.url.replace(/\/chat\/completions$/, '/models'), method: 'GET', headers: target.headers }); }
  catch { throw new FlowApiError('network', 'Could not reach the service.'); }
  if (response.status < 200 || response.status >= 300) throw failure(response, false);
  try { const parsed = JSON.parse(text(response)) as { data?: { id?: unknown }[]; models?: { name?: unknown }[] }; const ids = (parsed.data ?? []).map((m) => String(m.id ?? '')).concat((parsed.models ?? []).map((m) => String(m.name ?? ''))); return ids.map((id) => id.replace(/^models\//, '')).filter(Boolean).sort().slice(0, 300); } catch { return []; }
}

/** The shortest possible real request, to show the user that the key and model work. */
export async function testChat(provider: ProviderId, settings: FlowApiSettings, keys: Keys, deps: Deps): Promise<string> {
  const probe: FlowApiSettings = { ...settings, chatProvider: provider, chatModel: settings.chatProvider === provider ? settings.chatModel : '' };
  const reply = await chatText('Reply with the single word OK.', 'Say OK.', probe, keys, deps, { ownKeyOnly: true, maxTokens: 12 });
  if (!reply.trim()) throw new FlowApiError('bad-reply', 'The service answered but said nothing. Try another model.');
  return reply.trim().slice(0, 40);
}

// ---------------------------------------------------------------------------------------------- voices
/** Splits text into pieces of at most `max` characters, at sentence ends where it can. */
export function splitForVoice(input: string, max: number): string[] {
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const window = rest.slice(0, max + 1);
    let cut = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
    if (cut < max * .4) cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '));
    if (cut < max * .4) cut = window.lastIndexOf(' ');
    if (cut < 1) cut = max - 1;
    out.push(rest.slice(0, cut + 1).trim()); rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** A WAV file around raw 16-bit mono PCM. */
export function pcmToWav(pcm: Uint8Array, sampleRate = 24000): ArrayBuffer {
  const header = new ArrayBuffer(44); const v = new DataView(header);
  const tag = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  tag(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); tag(8, 'WAVE'); tag(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); tag(36, 'data'); v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length); out.set(new Uint8Array(header), 0); out.set(pcm, 44); return out.buffer;
}
/** The sample data of a PCM WAV file, and its rate. */
function wavData(buf: ArrayBuffer): { pcm: Uint8Array; rate: number } | null {
  const v = new DataView(buf); if (buf.byteLength < 44 || v.getUint32(0, false) !== 0x52494646) return null;
  let at = 12, rate = 24000;
  while (at + 8 <= buf.byteLength) {
    const id = v.getUint32(at, false), size = v.getUint32(at + 4, true);
    if (id === 0x666d7420) rate = v.getUint32(at + 12, true);          // "fmt "
    if (id === 0x64617461) return { pcm: new Uint8Array(buf, at + 8, Math.min(size, buf.byteLength - at - 8)), rate }; // "data"
    at += 8 + size + (size % 2);
  }
  return null;
}
/** Several WAV files played as one. */
export function joinWav(parts: ArrayBuffer[]): ArrayBuffer {
  const data = parts.map(wavData).filter((x): x is { pcm: Uint8Array; rate: number } => x !== null);
  if (!data.length) return parts[0] ?? new ArrayBuffer(0);
  const total = data.reduce((n, d) => n + d.pcm.length, 0); const pcm = new Uint8Array(total); let o = 0;
  for (const d of data) { pcm.set(d.pcm, o); o += d.pcm.length; }
  return pcmToWav(pcm, data[0].rate);
}
const b64 = (text: string): Uint8Array => { const bin = atob(text); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };

/** Speech from a voice service. Returns audio bytes and their type. The free system voice needs no service at all (lib/flowSpeech). */
export async function synthesize(input: string, settings: FlowApiSettings, keys: Keys, deps: Deps): Promise<{ bytes: ArrayBuffer; mime: string }> {
  const target = resolve('tts', settings, keys);
  guard(target, settings, deps);
  const info = providerInfo(target.provider);
  const format = info.ttsFormat ?? 'mp3';
  const voice = (/playai/i.test(settings.ttsVoice) ? '' : settings.ttsVoice).trim() || info.ttsVoice || 'alloy';
  const post = async (url: string, headers: Record<string, string>, body: unknown): Promise<HttpResponse> => {
    let response: HttpResponse;
    try { response = await deps.fetcher({ url, method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
    catch { throw new FlowApiError('network', 'Could not reach the voice service.'); }
    recordUse(deps.usage, deps.now?.());
    return response;
  };
  if (target.provider === 'gemini') {
    const ask = (url: string) => post(url, target.headers, { contents: [{ parts: [{ text: input.slice(0, 900) }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } });
    let response = await ask(target.url);
    // The preview model names change. If the default one is gone, try the older preview once.
    if ((response.status === 404 || response.status === 400) && !settings.ttsModel.trim()) response = await ask(target.url.replace(encodeURIComponent(target.model), 'gemini-2.5-flash-preview-tts'));
    if (response.status < 200 || response.status >= 300) throw failure(response, false);
    let data = '';
    try { const parsed = JSON.parse(text(response)) as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] }; data = parsed.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data ?? ''; } catch { /* Handled below. */ }
    if (!data) throw new FlowApiError('bad-reply', 'The voice service answered without audio. Try again, or pick another voice.');
    return { bytes: pcmToWav(b64(data), 24000), mime: 'audio/wav' };
  }
  const pieces = info.ttsMax ? splitForVoice(input, info.ttsMax).slice(0, 6) : [input.slice(0, 600)];
  if (!pieces.length) throw new FlowApiError('bad-reply', 'There is nothing to say.');
  const parts: ArrayBuffer[] = [];
  for (const piece of pieces) {
    const response = await post(target.url, target.headers, { model: target.model, input: piece, voice, response_format: format });
    if (response.status < 200 || response.status >= 300) throw failure(response, false);
    parts.push(response.body);
  }
  return { bytes: format === 'wav' && parts.length > 1 ? joinWav(parts) : parts[0], mime: format === 'wav' ? 'audio/wav' : 'audio/mpeg' };
}

export const defaultFlowApi: FlowApiSettings = {
  sttProvider: 'cloud', chatProvider: 'off', ttsEngine: 'system', sttModel: '', chatModel: '', ttsModel: '', ttsVoice: '',
  customUrl: '', cloudUrl: '', language: 'auto', dailyLimit: 200, cloudLimit: 5,
};
