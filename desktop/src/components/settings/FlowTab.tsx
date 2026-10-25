import { useEffect, useState, useSyncExternalStore } from 'react';
import { desktop, isDesktop } from '../../lib/desktop';
import { PROVIDERS, TTS_ENGLISH_ONLY, TTS_VOICES, providerInfo, type ProviderId } from '../../lib/flowApi';
import { CODE_VK, CUSTOM_KEY, FLOW_KEYS, describeCodes, resolveKey, sanitizeCodes, type BarPlace, type BarStyle, type FlowUi, type GestureMode, type UnsureMode } from '../../lib/flow';
import { getKeyStatus, publishableProject, runTester, subscribeFlow } from '../../lib/flowRuntime';
import { SIRI_EXAMPLES } from '../../lib/intentMore';
import { speak, systemVoices } from '../../lib/flowSpeech';
import { deviceId, maskKey, readKeys, setKey, usageStore, usedToday } from '../../lib/flowStore';
import { browserFetcher } from '../../lib/flowApi';
import { setPrefs, usePrefs } from '../../lib/prefs';
import { FlowBarView } from '../FlowBarView';
import { Slider } from '../Slider';
import { Card, Toggle } from '../desktop/shared';
import { Row, Segmented } from './parts';
import { openAiGuide } from '../agent/AiGuide';

const COST_WORD: Record<string, string> = { service: 'Free, shared', tier: 'Free plan', local: 'On your computer', paid: 'Paid' };
const noteOf = (info: { cost: string; freeNote: string; note: string } | null) => (info ? `${COST_WORD[info.cost]}. ${info.freeNote} ${info.note}` : undefined);

const field = 'field !min-h-8 !w-auto max-w-[280px] !py-1 text-[11px]';
const KEYED = PROVIDERS.filter((p) => p.needsKey || p.id === 'custom');

function KeyCapture({ onDone }: { onDone: (codes: string[]) => void }) {
  const [shown, setShown] = useState<string[]>([]);
  useEffect(() => {
    const held = new Set<string>(); let best: string[] = [];
    const down = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); if (e.code === 'Escape') { onDone([]); return; } held.add(e.code); if (held.size >= best.length) best = [...held]; setShown([...held]); };
    const up = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); held.delete(e.code); if (held.size === 0) onDone(sanitizeCodes(best.filter((code) => code in CODE_VK))); };
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true);
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); };
  }, [onDone]);
  return <span className="rounded-full border border-ink px-3 py-1 text-[11px] font-semibold" aria-live="polite">{shown.length ? describeCodes(shown) : 'Press the keys you want, then let go (Esc cancels)'}</span>;
}

const DEMO: FlowUi = { phase: 'listening', mode: 'hold', text: 'volume forty', message: '', level: .5, bars: Array.from({ length: 32 }, (_, i) => .25 + .5 * Math.abs(Math.sin(i * .55))), confirm: null, style: 'wave', place: 'bottom', size: 'medium', showText: true, dark: false, key: '', seq: 0 };

export function FlowTab() {
  const [prefs] = usePrefs();
  const f = prefs.flow;
  const set = (patch: Partial<typeof f>) => setPrefs({ flow: { ...f, ...patch } });
  useSyncExternalStore(subscribeFlow, getKeyStatus, getKeyStatus);
  const status = getKeyStatus();
  const [keys, setKeys] = useState(readKeys);
  const [capturing, setCapturing] = useState(false);
  const [drafts, setDrafts] = useState({ customUrl: f.customUrl, cloudUrl: f.cloudUrl });
  const [used, setUsed] = useState(usedToday());
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [sample, setSample] = useState('');
  useEffect(() => { let live = true; void systemVoices().then((list) => { if (live) setVoices([...list].sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))); }); return () => { live = false; }; }, []);
  const key = resolveKey(f.keyId, f.keyCodes);
  const project = publishableProject();
  const dark = document.documentElement.classList.contains('dark');
  useEffect(() => { const on = () => { setKeys(readKeys()); setUsed(usedToday()); }; window.addEventListener('swa-flow-keys', on); window.addEventListener('focus', on); return () => { window.removeEventListener('swa-flow-keys', on); window.removeEventListener('focus', on); }; }, []);
  const saveKey = (id: ProviderId, value: string) => { setKey(id, value); };
  const providerOptions = (kind: 'stt' | 'chat' | 'tts') => PROVIDERS.filter((p) => p.id === 'custom' ? kind !== 'tts' : p.id === 'ollama' ? kind === 'chat' : Boolean(p[kind])).map((p) => <option key={p.id} value={p.id}>{p.label}</option>);
  const sttInfo = f.sttProvider === 'off' ? null : providerInfo(f.sttProvider);
  const chatInfo = f.chatProvider === 'off' ? null : providerInfo(f.chatProvider);
  const usesCloud = f.sttProvider === 'cloud';
  const needed = new Set<ProviderId>([...(f.sttProvider !== 'off' ? [f.sttProvider] : []), ...(f.chatProvider !== 'off' ? [f.chatProvider] : []), ...(f.ttsEngine !== 'off' && f.ttsEngine !== 'system' ? [f.ttsEngine] : [])]);

  return <div className="grid gap-5">
    <Card title="Flow" hint={isDesktop ? 'Hold a key, say what you want, and Flow does it. "Flow, volume full", "set volume 40", "start the timer", "rainy window". Works from any app.' : 'Hold a key, say what you want, and Flow does it. In a browser the key only works while this page is in front. The desktop app works from any window.'}>
      <div className="grid gap-2">
        <Toggle label="Turn Flow on" hint="Nothing is listened to until you press the key. The microphone is used only while you hold it (or in hands-free mode)." checked={f.enabled} onChange={(enabled) => set({ enabled })} />
        {f.enabled && isDesktop && <p role="status" data-testid="flow-status" className="rounded-lg border border-line px-3 py-2 text-[11px] text-muted">{status.status === 'on' ? `Ready. Hold ${key.label} and speak.` : status.status === 'starting' ? 'Starting...' : status.status === 'error' ? `Problem: ${status.message}` : 'Off'}{!status.hold && status.status === 'on' ? ' On this system a press starts and the next press stops, because key releases cannot be seen.' : ''}</p>}
        <Row label="Push-to-talk key" hint={isDesktop ? 'A lone Right Ctrl is the default: few apps use it. Pressing another key with it (Ctrl+C) is treated as a normal shortcut, not as Flow.' : 'Keys that other pages and the browser rarely use. Pressing another key with it cancels.'}>
          <span className="flex flex-wrap items-center gap-2">
            {capturing ? <KeyCapture onDone={(codes) => { setCapturing(false); if (codes.length) set({ keyId: CUSTOM_KEY, keyCodes: codes }); }} />
              : <><select className={field} value={f.keyId} onChange={(e) => set({ keyId: e.target.value })} aria-label="Push-to-talk key">
                {FLOW_KEYS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                <option value={CUSTOM_KEY}>{f.keyCodes.length ? `Custom: ${describeCodes(f.keyCodes)}` : 'Custom...'}</option></select>
              <button type="button" className="studio-button" onClick={() => setCapturing(true)}>Record a key</button></>}
          </span></Row>
        {FLOW_KEYS.find((k) => k.id === f.keyId)?.hint && <p className="px-1 text-[10px] text-muted">{FLOW_KEYS.find((k) => k.id === f.keyId)?.hint}</p>}
        <Row label="How it listens" hint="Hold: speak while holding, release to send. Hands-free: double-tap the key, speak, and Flow stops when you pause."><Segmented<GestureMode> label="How it listens" value={f.mode} onChange={(mode) => set({ mode })} options={[{ id: 'both', label: 'Both' }, { id: 'hold', label: 'Hold only' }, { id: 'handsfree', label: 'Hands-free only' }]} /></Row>
        <div className="flex flex-wrap gap-2"><button type="button" className="studio-button" disabled={!f.enabled} onClick={() => runTester()} data-testid="flow-try">Try it now (hands-free)</button></div>
      </div>
    </Card>

    <Card title="When Flow is not sure" hint="Clear commands are understood on your computer, for free. Only when Flow cannot place what you said does it consider a service (set up below).">
      <div className="grid gap-2">
        <Row label="Unclear request" hint={f.unsure === 'ask' ? 'Flow shows a small question: do the closest command, or let the assistant work it out. (Skipped in browsers without built-in speech recognition, where every request needs the service.)' : f.unsure === 'auto' ? 'Flow goes straight to the service without asking.' : 'Flow never uses a service. It says it did not understand.'}>
          <Segmented<UnsureMode> label="Unclear request" value={f.unsure} onChange={(unsure) => set({ unsure })} options={[{ id: 'ask', label: 'Ask me' }, { id: 'auto', label: 'Use the service' }, { id: 'never', label: 'Never' }]} /></Row>
        <Toggle label="Let the assistant answer questions" hint='"What is the capital of France?", "give me a study tip". Off: it only runs commands.' checked={f.answers} onChange={(answers) => set({ answers })} />
        <Row label="Language" hint="Used for hearing and for voice replies."><select className={field} value={f.language} onChange={(e) => set({ language: e.target.value as 'auto' | 'en' | 'de' })} aria-label="Language"><option value="auto">Automatic</option><option value="en">English</option><option value="de">Deutsch</option></select></Row>
        {!isDesktop && <Toggle label="Use the browser's speech recognition first" hint="Chrome and Edge can recognize simple commands themselves, which makes clear commands instant and free. The browser's maker may process that audio. Off: nothing is recognized until you use a service." checked={f.browserSpeech} onChange={(browserSpeech) => set({ browserSpeech })} />}
        {isDesktop && <Toggle label="Understand free sentences" hint="Lets the built-in Windows recognizer write down sentences that are not on its list, such as &quot;add a to-do hand in the report&quot;. It still runs on this PC. Turn off if Windows hears too many wrong words." checked={f.localFree} onChange={(localFree) => set({ localFree })} />}
        {isDesktop && <Slider label="Keep the Windows recognizer ready for" value={f.localWarm} min={0} max={60} defaultValue={5} onChange={(localWarm) => set({ localWarm })} format={(v) => (v === 0 ? 'no time' : `${v} min`)} hint="The built-in recognizer takes a couple of seconds to start. It stays ready this long after you use Flow. Windows shows the microphone as in use meanwhile. The first request after a pause may go to the service instead." />}
      </div>
    </Card>

    <Card title="Services" hint="Used only for unclear requests. Your keys stay on this device, are never synced or exported, and are sent only to the service you pick.">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-canvas px-3.5 py-3"><span className="min-w-0 flex-1 text-[11px] text-muted">Not sure where to start? The walkthrough lists free options, opens the sign-up page, tests your key with a real request and explains what the AI may do.</span><button type="button" className="studio-button" onClick={() => openAiGuide()} data-testid="open-ai-guide">Open the AI walkthrough</button></div>
        <Row label="Speech to text" hint={noteOf(sttInfo)}><select className={field} value={f.sttProvider} onChange={(e) => set({ sttProvider: e.target.value as ProviderId | 'off' })} aria-label="Speech to text service"><option value="off">Off</option>{providerOptions('stt')}</select></Row>
        <Row label="Understanding and answers" hint={noteOf(chatInfo)}><select className={field} value={f.chatProvider} onChange={(e) => set({ chatProvider: e.target.value as ProviderId | 'off' })} aria-label="Assistant service"><option value="off">Off</option>{providerOptions('chat')}</select></Row>
        {KEYED.filter((p) => needed.has(p.id)).map((p) => <label key={p.id} className="block rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">{p.label.split(' (')[0]} key {p.keyUrl && <span className="font-normal text-muted">(create one at {p.keyUrl.replace('https://', '')})</span>}
          <input type="password" autoComplete="off" spellCheck={false} className="field mt-1.5 !min-h-9 font-mono font-normal" placeholder={keys[p.id] ? maskKey(keys[p.id]) : p.id === 'custom' ? 'optional' : 'paste your key'} onBlur={(e) => { if (e.target.value.trim()) { saveKey(p.id, e.target.value); e.target.value = ''; } }} data-testid={`flow-key-${p.id}`} aria-label={`${p.label} key`} />
          <span className="mt-1 flex items-center justify-between text-[10px] font-normal text-muted"><span>{keys[p.id] ? 'A key is saved on this device.' : p.needsKey ? 'No key saved yet.' : ''}</span>{keys[p.id] && <button type="button" className="underline" onClick={() => saveKey(p.id, '')}>Remove</button>}</span></label>)}
        {needed.has('custom') && <label className="block rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Custom address
          <input className="field mt-1.5 !min-h-9 font-mono font-normal" spellCheck={false} value={drafts.customUrl} onChange={(e) => setDrafts({ ...drafts, customUrl: e.target.value })} onBlur={() => set({ customUrl: drafts.customUrl })} placeholder="http://localhost:11434/v1" aria-label="Custom address" />
          <span className="mt-1 block text-[10px] font-normal text-muted">Any OpenAI-style address: Ollama, LM Studio and others. https, or http on this computer.</span></label>}
        {usesCloud && <div className="rounded-xl border border-line bg-canvas p-3 text-[11px]">
          <p className="font-semibold">Flow Cloud</p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted">A small shared helper that needs no key from you: about {f.cloudLimit} requests a day per person, enforced by the server. It runs as a function in the Supabase project of this app ({project ? project.url.replace('https://', '') : 'none set'}). It only works once that function is deployed; see docs/FLOW_CLOUD.md. Your own Groq key above is always the most reliable.</p>
          <label className="mt-2 block font-semibold">Different address (optional)
            <input className="field mt-1.5 !min-h-9 font-mono font-normal" spellCheck={false} value={drafts.cloudUrl} onChange={(e) => setDrafts({ ...drafts, cloudUrl: e.target.value })} onBlur={() => set({ cloudUrl: drafts.cloudUrl })} placeholder={project ? `${project.url}/functions/v1/flow-assist` : 'https://'} aria-label="Flow Cloud address" /></label>
        </div>}
        <Slider label="My daily limit for my own keys" value={f.dailyLimit} min={0} max={500} step={5} defaultValue={200} onChange={(dailyLimit) => set({ dailyLimit })} format={(v) => (v === 0 ? 'none' : `${v} / day`)} hint="A safety net so a mistake cannot use up your quota. Counts requests made from this device. 0 turns it off." />
        <Slider label="Flow Cloud allowance shown" value={f.cloudLimit} min={1} max={50} defaultValue={5} onChange={(cloudLimit) => set({ cloudLimit })} format={(v) => `${v} / day`} hint="What this app assumes the shared helper allows (dictation only). The server decides the real number." />
        <p className="px-1 text-[10px] text-muted" data-testid="flow-used">Used today on this device: {used} request{used === 1 ? '' : 's'}.</p>
        <details className="rounded-xl border border-line bg-canvas px-3.5 py-3"><summary className="cursor-pointer text-[11px] font-semibold">Models (advanced)</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {([['sttModel', 'Speech to text', sttInfo?.stt], ['chatModel', 'Assistant', chatInfo?.chat], ['ttsModel', 'Voice', f.ttsEngine !== 'off' && f.ttsEngine !== 'system' ? providerInfo(f.ttsEngine).tts : '']] as const).map(([name, label, def]) => <label key={name} className="text-[10px] font-semibold text-muted">{label}<input className="field mt-1 !min-h-8 !py-1 font-mono text-[11px] font-normal" value={f[name]} onChange={(e) => set({ [name]: e.target.value } as Partial<typeof f>)} placeholder={def || 'default'} spellCheck={false} /></label>)}
          </div><p className="mt-2 text-[10px] text-muted">Companies rename and retire models. If a request fails with "model not found", put a current name here.</p></details>
      </div>
    </Card>

    <Card title="Voice replies" hint="Flow can read answers aloud. The system voice is free and works offline. A service voice sounds more natural but counts as a request.">
      <div className="grid gap-2">
        <Row label="Voice"><select className={field} value={f.ttsEngine} onChange={(e) => set({ ttsEngine: e.target.value as typeof f.ttsEngine, ttsVoice: '', ttsModel: '' })} aria-label="Voice for replies" data-testid="tts-engine"><option value="system">System voice (free)</option><option value="off">Off</option>{PROVIDERS.filter((p) => p.tts).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Row>
        {f.ttsEngine !== 'system' && f.ttsEngine !== 'off' && <>
          <Row label="Voice name" hint={`Voices ${providerInfo(f.ttsEngine).short} offers. ${TTS_ENGLISH_ONLY.includes(f.ttsEngine) ? 'English only: German replies use the system voice.' : 'Speaks many languages, including German.'}`}>
            <select className={field} value={f.ttsVoice || providerInfo(f.ttsEngine).ttsVoice || ''} onChange={(e) => set({ ttsVoice: e.target.value })} aria-label="Voice name" data-testid="tts-voice">{(TTS_VOICES[f.ttsEngine as ProviderId] ?? [providerInfo(f.ttsEngine).ttsVoice ?? '']).map((v) => <option key={v} value={v}>{v}</option>)}</select></Row>
          {!readKeys()[f.ttsEngine as ProviderId] && <p className="rounded-lg border border-line px-3 py-2 text-[11px] leading-snug text-muted" data-testid="tts-nokey">No {providerInfo(f.ttsEngine).short} key yet. Add it above, or the system voice is used instead.</p>}
        </>}
        <Row label="System voice" hint="Used when the voice above is the system voice, when a service fails, and for languages a service voice does not speak.">
          <select className={field} value={f.ttsSystemVoice} onChange={(e) => set({ ttsSystemVoice: e.target.value })} aria-label="System voice" data-testid="tts-system-voice"><option value="">Best match (automatic)</option>{voices.map((v) => <option key={v.voiceURI} value={v.name}>{v.name} ({v.lang})</option>)}</select></Row>
        {voices.length > 0 && voices.length < 4 && <p className="px-1 text-[10px] leading-relaxed text-muted">Only {voices.length} system voice{voices.length === 1 ? ' is' : 's are'} installed. On Windows you can add more under Settings, Time and language, Speech, Manage voices.</p>}
        <Toggle label="Read answers aloud" checked={f.speakAnswers} onChange={(speakAnswers) => set({ speakAnswers })} />
        <Toggle label="Say what it did" hint={'Flow says "Volume 40 percent" after a command. Off keeps quick commands silent.'} checked={f.speakDone} onChange={(speakDone) => set({ speakDone })} />
        <Slider label="Speed" value={f.ttsRate} min={0.5} max={2} step={0.05} defaultValue={1} onChange={(ttsRate) => set({ ttsRate })} format={(v) => `${v.toFixed(2)}x`} />
        <Slider label="Pitch" value={f.ttsPitch} min={0.5} max={2} step={0.05} defaultValue={1} onChange={(ttsPitch) => set({ ttsPitch })} format={(v) => v.toFixed(2)} hint="System voices only." />
        <Slider label="Volume" value={Math.round(f.ttsVolume * 100)} min={0} max={100} defaultValue={100} onChange={(v) => set({ ttsVolume: v / 100 })} format={(v) => `${v}%`} />
        <div className="flex flex-wrap items-center gap-2"><button type="button" className="studio-button" data-testid="tts-test" onClick={() => { setSample('Playing...'); void speak(f.language === 'de' ? 'Hallo, ich bin Flow. Halte die Taste und sag mir, was ich tun soll.' : 'Hi, I am Flow. Hold the key and tell me what to do.', f, readKeys(), { fetcher: desktop ? (r) => desktop!.netFetch(r) : browserFetcher, usage: usageStore, device: deviceId() }).then((r) => setSample(r.error ? `The ${providerInfo(f.ttsEngine).short} voice did not work: ${r.error} The system voice${r.voice ? ` (${r.voice})` : ''} was used instead.` : r.engine === 'service' ? `Played with the ${providerInfo(f.ttsEngine).short} voice.` : r.engine === 'system' ? `Played with the system voice${r.voice ? ` (${r.voice})` : ''}.` : 'Nothing was played (voice is off or the system has none).')); }}>Hear a sample</button>
          {sample && <p role="status" className="text-[11px] leading-snug text-muted" data-testid="tts-result">{sample}</p>}</div>
      </div>
    </Card>

    <Card title="The bar" hint="A small bar appears while Flow listens, with a live picture of your voice.">
      <div className="grid gap-2">
        <Row label="Style"><Segmented<BarStyle> label="Bar style" value={f.barStyle} onChange={(barStyle) => set({ barStyle })} options={[{ id: 'wave', label: 'Wave' }, { id: 'bars', label: 'Bars' }, { id: 'orb', label: 'Orb' }, { id: 'ring', label: 'Ring' }]} /></Row>
        <Row label="Position"><Segmented<BarPlace> label="Bar position" value={f.barPlace} onChange={(barPlace) => set({ barPlace })} options={[{ id: 'bottom', label: 'Bottom' }, { id: 'center', label: 'Middle' }, { id: 'top', label: 'Top' }]} /></Row>
        <Row label="Size"><Segmented<'small' | 'medium' | 'large'> label="Bar size" value={f.barSize} onChange={(barSize) => set({ barSize })} options={[{ id: 'small', label: 'Small' }, { id: 'medium', label: 'Medium' }, { id: 'large', label: 'Large' }]} /></Row>
        <Toggle label="Show what Flow heard" checked={f.barText} onChange={(barText) => set({ barText })} />
        <Toggle label="Soft start and finish sounds" checked={f.cues} onChange={(cues) => set({ cues })} />
        <Slider label="Lower my sound while listening" value={f.duck} min={0} max={100} step={5} defaultValue={80} onChange={(duck) => set({ duck })} format={(v) => (v === 0 ? 'not at all' : `by ${v}%`)} hint="Keeps the app's own sound out of the microphone so Flow hears you better." />
        <Slider label="Keep the microphone open for" value={f.micWarm} min={0} max={60} defaultValue={8} onChange={(micWarm) => set({ micWarm })} format={(v) => (v === 0 ? 'no time' : `${v} s`)} hint="After a request the microphone stays open briefly so the next one starts at once and does not miss your first word. 0 closes it right away." />
        <div className="relative h-[180px] overflow-hidden rounded-xl border border-line bg-raised" aria-label="Preview of the bar"><div className="absolute inset-0 scale-[.9] origin-center"><FlowBarView preview ui={{ ...DEMO, style: f.barStyle, place: 'center', size: f.barSize, showText: f.barText, dark }} onAction={() => undefined} /></div></div>
      </div>
    </Card>

    <Card title="Things you can say" hint="Say Flow first if you like (it is optional when you hold the key). Everyday sentences work, not only exact phrases. Commands for other apps need the desktop app.">
      <div className="grid gap-3 sm:grid-cols-2" data-testid="say-list">
        {SIRI_EXAMPLES.map((g) => <div key={g.group}>
          <p className="mb-1 text-[11px] font-semibold text-ink">{g.group}</p>
          <ul className="grid gap-1 text-[11px] text-muted">{g.say.map((p) => <li key={p} className="rounded-md border border-line px-2.5 py-1.5">&ldquo;{p}&rdquo;</li>)}</ul>
        </div>)}
        <div>
          <p className="mb-1 text-[11px] font-semibold text-ink">Your sound and the screen</p>
          <ul className="grid gap-1 text-[11px] text-muted">{['volume full', 'set volume 40', 'turn it up', 'quieter', 'mute', 'next sound', 'zen mode', 'rainy window', 'run Start Flow session', 'I need to breathe', 'sleep timer 20 minutes', 'Lautstärke fünfzig (German works too)'].map((p) => <li key={p} className="rounded-md border border-line px-2.5 py-1.5">&ldquo;{p}&rdquo;</li>)}</ul>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted">&ldquo;Pause my music&rdquo; pauses Spotify, a browser video or a podcast. &ldquo;Pause the sound&rdquo; pauses this app&rsquo;s own sound. If nothing else is playing, Flow tells you and offers the nearest thing.</p>
    </Card>
  </div>;
}
