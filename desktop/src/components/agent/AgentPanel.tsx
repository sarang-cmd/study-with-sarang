import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2, Send, Sparkles, Trash2, X, TriangleAlert, Wand2 } from 'lucide-react';
import { SYSTEM_PROMPT, runAgent, toolAllowed } from '../../lib/agent';
import { buildTools, type AgentRuntime } from '../../lib/agentTools';
import { addItem, clearAgent, closeAgent, getAgent, patchAgent, subscribeAgent } from '../../lib/agentStore';
import { desktop, isDesktop } from '../../lib/desktop';
import { browserFetcher, chatWithTools, providerInfo } from '../../lib/flowApi';
import { deviceId, readKeys, usageStore } from '../../lib/flowStore';
import { getPrefs, usePrefs } from '../../lib/prefs';
import { addNote } from '../../lib/notifications';
import { useDesktop } from '../../context/DesktopContext';
import { useSettings } from '../../context/SettingsContext';
import { useSound } from '../../context/SoundContext';
import { useTimer } from '../../context/TimerContext';
import { openAiGuide } from './AiGuide';

const IDEAS = ['Add a to-do: finish the physics problem set', 'Set my goal to "two past paper questions" for Maths', 'Play rain sounds at 30 percent and start a 25 minute focus', 'Remind me to stop at 22:00 with a message and quiet sound'];

/** The assistant drawer. It can act in the app through the tools in agentTools.ts, with your own AI key only. */
export function AgentPanel() {
  const st = useSyncExternalStore(subscribeAgent, getAgent, getAgent);
  const [prefs] = usePrefs();
  const reduce = useReducedMotion();
  const timer = useTimer(); const sound = useSound(); const dsk = useDesktop(); const { openSettings } = useSettings();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(68);
  useEffect(() => { // sit just below the top bar, whatever its height is
    if (!st.open) return; const place = () => { const h = document.querySelector('header'); setTop(Math.round((h?.getBoundingClientRect().bottom ?? 56) + 8)); };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, { passive: true }); return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place); };
  }, [st.open]);
  const latest = useRef({ timer, sound, dsk }); latest.current = { timer, sound, dsk };
  const flow = prefs.flow; const a = prefs.agent;
  const configured = flow.chatProvider !== 'off';
  const info = configured ? providerInfo(flow.chatProvider) : null;

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [st.items.length, st.live.length, st.pending, st.busy]);
  useEffect(() => { if (!st.open) return; const on = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeAgent(); } }; window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on); }, [st.open]); // bubble phase: the walkthrough and the bell handle Escape first

  const send = useCallback(async (raw: string) => {
    const text = raw.trim(); const now = getAgent();
    if (!text || now.busy) return;
    const p = getPrefs();
    setDraft(''); addItem({ role: 'user', text }); patchAgent({ busy: true, live: [] });
    const fetcher = desktop ? (request: Parameters<NonNullable<typeof desktop>['netFetch']>[0]) => desktop!.netFetch(request) : browserFetcher;
    const runtime: AgentRuntime = {
      execute: (command) => latest.current.dsk.run(command), desktop: isDesktop,
      get timer() { const t = latest.current.timer; return { running: t.running, phase: t.phase, mode: t.mode, seconds: t.seconds, task: t.task, settings: t.settings, setSettings: t.setSettings }; },
      get sound() { const s = latest.current.sound; return { playing: s.playing, volume: s.mix.volume / 100 }; },
      mixNames: () => latest.current.dsk.allMixNames(), macros: () => latest.current.dsk.macros, setMacros: (next) => latest.current.dsk.setMacros(() => next),
    };
    const tools = buildTools(runtime);
    const outcome = await runAgent(now.history, text, {
      tools, allowed: toolAllowed(p.agent), confirmMode: p.agent.confirm, system: SYSTEM_PROMPT,
      chat: (messages, list) => chatWithTools(messages, list.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })), p.flow, readKeys(), { fetcher, usage: usageStore, device: deviceId() }),
      confirm: (step) => new Promise<boolean>((resolve) => patchAgent({ pending: { ...step, resolve: (ok) => { patchAgent({ pending: null }); resolve(ok); } } })),
      onStep: (step) => patchAgent({ live: [...getAgent().live, step] }),
    });
    if (outcome.stopped === 'error') addItem({ role: 'error', text: outcome.error ?? 'The assistant could not answer.', steps: outcome.steps });
    else addItem({ role: 'assistant', text: outcome.reply || (outcome.steps.length ? 'Done.' : '...'), steps: outcome.steps });
    const changed = outcome.steps.filter((s) => s.ok && !/^(Looked|Listed)/.test(s.summary)).length;
    if (changed) addNote({ kind: 'ai', title: 'Assistant', message: `Made ${changed} change${changed === 1 ? '' : 's'}: ${outcome.steps.filter((s) => s.ok).map((s) => s.summary).slice(0, 3).join('; ')}` });
    patchAgent({ busy: false, live: [], history: outcome.stopped === 'error' ? now.history : outcome.messages });
  }, []);

  return createPortal(<AnimatePresence>
    {st.open && <motion.aside key="agent" role="dialog" aria-label="Assistant" data-testid="agent-panel"
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ top }} className="fixed bottom-3 right-3 z-[60] flex w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl border border-ink/20 bg-canvas shadow-2xl">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-canvas"><Sparkles size={15} /></span>
        <div className="min-w-0 flex-1"><h2 className="text-[13px] font-semibold leading-tight">Assistant</h2><p className="truncate text-[11px] text-muted">{configured && info ? `${info.short || info.label}, your own key` : 'Not set up yet'}{configured ? `, confirm: ${a.confirm === 'off' ? 'never' : a.confirm === 'changes' ? 'changes' : 'everything'}` : ''}</p></div>
        <button type="button" onClick={clearAgent} aria-label="Clear the conversation" data-testid="agent-clear" data-tip="Clear the conversation" className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:text-ink"><Trash2 size={15} /></button>
        <button type="button" onClick={closeAgent} aria-label="Close the assistant" className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:text-ink"><X size={16} /></button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" data-testid="agent-log" aria-live="polite">
        {!a.enabled && <p className="rounded-2xl border border-line p-3 text-[12px] text-muted">The assistant is switched off. Turn it on under Settings, Assistant.</p>}
        {a.enabled && !configured && <div className="rounded-2xl border border-line p-4 text-[12px] leading-relaxed">
          <p className="font-semibold">Pick an AI service first</p>
          <p className="mt-1 text-muted">The assistant uses your own free key (Groq, Gemini, OpenRouter, Mistral, GitHub Models) or a model on your own computer (Ollama). The walkthrough takes about two minutes.</p>
          <button type="button" className="studio-button mt-3" onClick={() => { closeAgent(); openAiGuide(); }}><Wand2 size={13} /> Start the walkthrough</button>
        </div>}
        {a.enabled && configured && st.items.length === 0 && <div className="space-y-2">
          <p className="text-[12px] text-muted">Ask me to change anything you could change by hand. For example:</p>
          {IDEAS.map((idea) => <button key={idea} type="button" onClick={() => void send(idea)} className="block w-full rounded-2xl border border-line px-3 py-2 text-left text-[12px] transition-colors hover:border-ink">{idea}</button>)}
        </div>}
        {st.items.map((item) => <motion.div key={item.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={item.role === 'user' ? 'flex justify-end' : ''}>
          <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed ${item.role === 'user' ? 'bg-ink text-canvas' : item.role === 'error' ? 'border border-ink/40 bg-ink/[.04]' : 'border border-line'}`} data-role={item.role}>
            {item.role === 'error' && <TriangleAlert size={13} className="mb-1" />}
            <p className="whitespace-pre-wrap">{item.text}</p>
            {a.showSteps && item.steps && item.steps.length > 0 && <ul className="mt-2 space-y-1 border-t border-line pt-2" data-testid="agent-steps">
              {item.steps.map((s, i) => <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted"><span className="mt-[1px]">{s.ok ? <Check size={11} /> : <X size={11} />}</span><span>{s.summary}{!s.ok ? ` (${s.result})` : ''}</span></li>)}
            </ul>}
          </div>
        </motion.div>)}
        {st.busy && <div className="flex items-center gap-2 text-[11px] text-muted" data-testid="agent-busy"><Loader2 size={13} className="animate-spin" />{st.live.length ? `${st.live.length} step${st.live.length === 1 ? '' : 's'} done, thinking...` : 'Thinking...'}</div>}
        {st.pending && <div className="rounded-2xl border border-ink p-3" data-testid="agent-confirm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Allow this?</p>
          <p className="mt-1 text-[12.5px]">{st.pending.summary}</p>
          <div className="mt-2 flex gap-2"><button type="button" className="studio-button" data-testid="agent-allow" onClick={() => st.pending?.resolve(true)}>Allow</button><button type="button" className="studio-button" data-testid="agent-deny" onClick={() => st.pending?.resolve(false)}>Decline</button></div>
        </div>}
        <div ref={endRef} />
      </div>

      <form className="border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
        <div className="flex items-end gap-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={600} data-testid="agent-input" aria-label="Message the assistant" placeholder={configured ? 'What should I do?' : 'Set up an AI service first'} disabled={!configured || !a.enabled}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(draft); } }} className="field !min-h-0 flex-1 resize-none !py-2 text-[12.5px]" />
          <button type="submit" disabled={!configured || !a.enabled || st.busy || !draft.trim()} data-testid="agent-send" aria-label="Send" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-canvas transition-opacity disabled:opacity-30"><Send size={15} /></button>
        </div>
        <p className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10.5px] text-muted"><span>This chat is not saved. Your key is used directly, never the shared helper.</span><button type="button" className="underline" onClick={() => { closeAgent(); openSettings('assistant'); }}>Assistant settings</button></p>
      </form>
    </motion.aside>}
  </AnimatePresence>, document.body);
}
