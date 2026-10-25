import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, Search, Sparkles, X } from 'lucide-react';
import { desktop } from '../../lib/desktop';
import { FlowApiError, PROVIDERS, PROVIDERS_CHECKED, browserFetcher, listModels, providerInfo, testChat, type Cost, type ProviderId } from '../../lib/flowApi';
import { deviceId, maskKey, readKeys, setKey, usageStore } from '../../lib/flowStore';
import { getPrefs, setPrefs } from '../../lib/prefs';
import { addNote } from '../../lib/notifications';
import { openAgent } from '../../lib/agentStore';
import type { ConfirmMode } from '../../lib/agent';

export const AI_GUIDE_KEY = 'study-with-sarang:ai-guide';
const EVENT = 'swa-ai-guide';
export interface GuideState { done: boolean; skipped: boolean; at: string }
export function readGuide(): GuideState | null { try { const r = JSON.parse(localStorage.getItem(AI_GUIDE_KEY) ?? 'null'); return r && typeof r === 'object' ? { done: r.done === true, skipped: r.skipped === true, at: String(r.at ?? '') } : null; } catch { return null; } }
function writeGuide(state: Omit<GuideState, 'at'>) { try { localStorage.setItem(AI_GUIDE_KEY, JSON.stringify({ ...state, at: new Date().toISOString() })); } catch { /* ignore */ } }
/** Opens the walkthrough from anywhere (Settings, the assistant, the first-run tutorial). */
export const openAiGuide = (step = 0) => window.dispatchEvent(new CustomEvent(EVENT, { detail: { step } }));

const COST_LABEL: Record<Cost, string> = { service: 'Free, shared', tier: 'Free plan', local: 'On your computer', paid: 'Paid' };
const GOALS = [
  { id: 'assistant', title: 'An assistant that does things for me', hint: 'Say "add a to-do" or "set up a 25 minute focus with rain" and it is done. Needs a chat service.' },
  { id: 'voice', title: 'Speak to the app (dictation)', hint: 'Hold the key and talk. A free shared helper covers 5 a day; your own key has no such limit.' },
  { id: 'drift', title: 'Smarter distraction check', hint: 'Lets unknown sites be judged by AI. The built-in word lists work without it.' },
] as const;
type GoalId = (typeof GOALS)[number]['id'];
const STEPS = ['Goal', 'Service', 'Key', 'Test', 'Allowed'];

/** A short walkthrough: pick what you want, pick a free service, paste a key, make a real test request, decide what the AI may do. */
export function AiGuide() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<GoalId[]>(['assistant']);
  const [provider, setProvider] = useState<ProviderId>('groq');
  const [key, setKeyText] = useState('');
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<'' | 'find' | 'test'>('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmMode>('off');
  const info = providerInfo(provider);
  const choices = useMemo(() => PROVIDERS.filter((p) => p.id !== 'cloud' && (p.chat || p.id === 'custom')), []);

  useEffect(() => {
    const on = (e: Event) => {
      const p = getPrefs();
      const current = p.flow.chatProvider !== 'off' ? p.flow.chatProvider : 'groq';
      setProvider(current); setModel(p.flow.chatModel); setUrl(p.flow.customUrl); setKeyText(''); setConfirm(p.agent.confirm);
      setStep(Math.max(0, Math.min(4, Number((e as CustomEvent).detail?.step) || 0))); setResult(null); setModels([]); setOpen(true);
    };
    window.addEventListener(EVENT, on); return () => window.removeEventListener(EVENT, on);
  }, []);
  useEffect(() => { if (!open) return; const on = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }; window.addEventListener('keydown', on, true); return () => window.removeEventListener('keydown', on, true); }, [open]);

  const savedKey = readKeys()[provider] ?? '';
  const deps = () => ({ fetcher: desktop ? (request: Parameters<NonNullable<typeof desktop>['netFetch']>[0]) => desktop!.netFetch(request) : browserFetcher, usage: usageStore, device: deviceId() });
  const apply = (): { flow: ReturnType<typeof getPrefs>['flow'] } => {
    if (key.trim()) setKey(provider, key.trim());
    const p = getPrefs();
    const flow = { ...p.flow, chatProvider: provider, chatModel: model.trim() === info.chat ? '' : model.trim(), customUrl: provider === 'custom' ? url.trim() : p.flow.customUrl };
    return { flow };
  };
  const find = async () => {
    setBusy('find'); setResult(null);
    try { const { flow } = apply(); const list = await listModels(provider, flow, readKeys(), deps()); setModels(list); setResult({ ok: true, text: list.length ? `${list.length} models found. Pick one, or keep the suggested one.` : 'The service did not list models. Type a model name instead.' }); }
    catch (error) { setResult({ ok: false, text: error instanceof FlowApiError ? error.message : 'Could not list models.' }); }
    setBusy('');
  };
  const test = async () => {
    setBusy('test'); setResult(null);
    try { const { flow } = apply(); const reply = await testChat(provider, flow, readKeys(), deps()); setResult({ ok: true, text: `It works. The model answered: "${reply}".` }); }
    catch (error) { setResult({ ok: false, text: error instanceof FlowApiError ? error.message : 'The test failed.' }); }
    setBusy('');
  };
  const finish = (openChat: boolean) => {
    const { flow } = apply();
    const next = { ...flow };
    if (goals.includes('voice') && info.stt) next.sttProvider = provider;
    setPrefs({ flow: next, agent: { ...getPrefs().agent, enabled: true, confirm }, ...(goals.includes('drift') ? { drift: { ...getPrefs().drift, ai: true } } : {}) });
    writeGuide({ done: true, skipped: false }); setOpen(false);
    addNote({ kind: 'ai', title: 'AI is set up', message: `${info.short} is ready${goals.includes('assistant') ? '. Open the assistant from the top bar.' : '.'}` });
    if (openChat && goals.includes('assistant')) openAgent();
  };
  const skip = () => { writeGuide({ done: false, skipped: true }); setOpen(false); };
  const toggleGoal = (id: GoalId) => setGoals((cur) => (cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id]));
  const needsKey = info.needsKey; const keyOk = !needsKey || key.trim().length > 7 || savedKey.length > 7;
  const canNext = step === 0 ? goals.length > 0 : step === 2 ? keyOk && (provider !== 'custom' || url.trim().length > 6) : true;

  const body = [
    <div key="goal" className="space-y-2.5" data-testid="aiguide-step-goal">
      <p className="text-[12.5px] text-muted">Everything in this app works without AI. Choose what you want it for and the next steps only ask for what that needs.</p>
      {GOALS.map((g) => <button key={g.id} type="button" onClick={() => toggleGoal(g.id)} aria-pressed={goals.includes(g.id)} className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors ${goals.includes(g.id) ? 'border-ink bg-ink/[.04]' : 'border-line hover:border-ink/50'}`}>
        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${goals.includes(g.id) ? 'border-ink bg-ink text-canvas' : 'border-line'}`}>{goals.includes(g.id) && <Check size={12} />}</span>
        <span><span className="block text-[13px] font-semibold">{g.title}</span><span className="block text-[11.5px] text-muted">{g.hint}</span></span>
      </button>)}
    </div>,
    <div key="service" className="space-y-2" data-testid="aiguide-step-service">
      <p className="text-[12.5px] text-muted">These have a free way in. Limits and model names change; they were checked in {PROVIDERS_CHECKED}, so confirm on the provider's page.</p>
      <div className="grid max-h-[300px] gap-2 overflow-y-auto pr-1">
        {choices.map((p) => <button key={p.id} type="button" onClick={() => { setProvider(p.id); setModel(''); setModels([]); setResult(null); }} aria-pressed={provider === p.id} data-testid={`aiguide-provider-${p.id}`} className={`rounded-2xl border px-3.5 py-2.5 text-left transition-colors ${provider === p.id ? 'border-ink bg-ink/[.04]' : 'border-line hover:border-ink/50'}`}>
          <span className="flex items-center gap-2"><span className="text-[13px] font-semibold">{p.short}</span><span className={`rounded-full px-2 py-[1px] text-[10px] font-semibold ${p.cost === 'paid' ? 'border border-line text-muted' : 'bg-ink text-canvas'}`}>{COST_LABEL[p.cost]}</span></span>
          <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{p.freeNote}</span>
        </button>)}
      </div>
      {goals.includes('voice') && <p className="text-[11.5px] text-muted">For dictation without your own key, the shared helper gives 5 a day. Groq and OpenAI also transcribe speech with your key.</p>}
    </div>,
    <div key="key" className="space-y-3" data-testid="aiguide-step-key">
      <ol className="list-decimal space-y-1 pl-5 text-[12.5px]">{info.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      {info.keyUrl && <a href={info.keyUrl} target="_blank" rel="noreferrer" className="studio-button inline-flex"><ExternalLink size={13} /> Open the {info.short} page</a>}
      {needsKey && <label className="block text-[11.5px] font-semibold">Paste your key{savedKey ? <span className="ml-2 font-normal text-muted">saved: {maskKey(savedKey)}</span> : null}
        <input type="password" value={key} onChange={(e) => setKeyText(e.target.value)} placeholder={savedKey ? 'Leave empty to keep the saved key' : 'Paste here'} autoComplete="off" spellCheck={false} data-testid="aiguide-key" className="field mt-1 w-full text-[12px]" /></label>}
      {provider === 'custom' && <label className="block text-[11.5px] font-semibold">Server address<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:1234/v1" data-testid="aiguide-url" className="field mt-1 w-full text-[12px]" /></label>}
      {!needsKey && provider !== 'custom' && <p className="text-[12px] text-muted">No key needed. Make sure Ollama is running, then continue.</p>}
      <p className="text-[11px] text-muted">Your key stays on this device. It is never synced, exported or sent anywhere except to {info.short}.</p>
    </div>,
    <div key="test" className="space-y-3" data-testid="aiguide-step-test">
      <label className="block text-[11.5px] font-semibold">Model<input value={model} onChange={(e) => setModel(e.target.value)} list="aiguide-models" placeholder={info.chat} data-testid="aiguide-model" className="field mt-1 w-full text-[12px]" /></label>
      <datalist id="aiguide-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
      <p className="text-[11.5px] text-muted">The assistant needs a model that supports tools (function calling). The suggested one does. Free model names change, so use Find models if the test fails.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="studio-button" onClick={() => void find()} disabled={busy !== ''} data-testid="aiguide-find">{busy === 'find' ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Find models</button>
        <button type="button" className="studio-button" onClick={() => void test()} disabled={busy !== ''} data-testid="aiguide-test">{busy === 'test' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Test connection</button>
      </div>
      {result && <p role="status" data-testid="aiguide-result" className={`rounded-2xl border px-3 py-2 text-[12px] ${result.ok ? 'border-ink' : 'border-line text-muted'}`}>{result.ok ? <Check size={12} className="mr-1 inline" /> : <X size={12} className="mr-1 inline" />}{result.text}</p>}
    </div>,
    <div key="allowed" className="space-y-3" data-testid="aiguide-step-allowed">
      <p className="text-[12.5px]">The assistant can do what you can do in the app: run commands, change settings, manage to-dos, subjects, automations and macros. It cannot see your keys or pairing code, quit the app, or delete your history.</p>
      <p className="text-[11.5px] font-semibold">Ask before it acts?</p>
      {([['off', 'Never, just do it', 'Fastest. You see every action in the log and can undo it by hand.'], ['changes', 'Ask before changes', 'Reading is free, anything it changes needs your Allow.'], ['all', 'Ask before every action', 'Slowest and safest.']] as const).map(([id, title, hint]) => <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-2.5 ${confirm === id ? 'border-ink bg-ink/[.04]' : 'border-line'}`}>
        <input type="radio" name="aiguide-confirm" checked={confirm === id} onChange={() => setConfirm(id)} className="mt-1" /><span><span className="block text-[12.5px] font-semibold">{title}</span><span className="block text-[11px] text-muted">{hint}</span></span></label>)}
      <p className="text-[11px] text-muted">You can change all of this later under Settings, Assistant, and re-run this walkthrough there.</p>
    </div>,
  ];

  return createPortal(<AnimatePresence>
    {open && <motion.div key="guide" className="fixed inset-0 z-[132] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <motion.div role="dialog" aria-modal="true" aria-label="AI walkthrough" data-testid="aiguide" initial={reduce ? false : { opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }} className="flex max-h-[92vh] w-full max-w-[520px] flex-col rounded-3xl border border-ink/20 bg-canvas p-5 shadow-2xl">
        <div className="flex items-center gap-2"><Sparkles size={16} /><h2 className="flex-1 text-[15px] font-semibold">Set up AI, step {step + 1} of {STEPS.length}: {STEPS[step]}</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:text-ink"><X size={16} /></button></div>
        <div className="mt-3 flex gap-1.5" aria-hidden="true">{STEPS.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-ink' : 'bg-line'}`} />)}</div>
        <div className="mt-4 min-h-[260px] flex-1 overflow-y-auto pr-1">
          <AnimatePresence mode="wait" initial={false}><motion.div key={step} initial={reduce ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: -18 }} transition={{ duration: .18 }}>{body[step]}</motion.div></AnimatePresence>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="text-[11.5px] text-muted underline" onClick={skip}>Not now</button>
          <span className="flex-1" />
          {step > 0 && <button type="button" className="studio-button" onClick={() => setStep(step - 1)}><ArrowLeft size={13} /> Back</button>}
          {step < STEPS.length - 1 ? <button type="button" className="studio-button !bg-ink !text-canvas disabled:opacity-40" disabled={!canNext} onClick={() => setStep(step + 1)} data-testid="aiguide-next">{step === 3 && !result?.ok ? 'Skip test' : 'Next'} <ArrowRight size={13} /></button>
            : <button type="button" className="studio-button !bg-ink !text-canvas" onClick={() => finish(true)} data-testid="aiguide-finish"><Check size={13} /> Finish{goals.includes('assistant') ? ' and open the assistant' : ''}</button>}
        </div>
      </motion.div>
    </motion.div>}
  </AnimatePresence>, document.body);
}
