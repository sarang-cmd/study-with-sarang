import { useEffect, useRef } from 'react';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { desktop } from '../lib/desktop';
import { addDriftLog, aiKey, buildDriftPrompt, createDriftTracker, createHourLimiter, parseDriftReply, type DriftEvent } from '../lib/drift';
import { FlowApiError, chatText } from '../lib/flowApi';
import { deviceId, readKeys, usageStore } from '../lib/flowStore';
import { patchIntegrationState, getIntegrationState } from '../lib/integrationState';
import { addNote, osNotify } from '../lib/notifications';
import { emitAutomation } from '../lib/automations';
import { getPlan } from '../lib/plan';
import { usePrefs } from '../lib/prefs';
import { playUi } from '../lib/synth';
import { notify } from './ui/toast';

const AI_CACHE = 'study-with-sarang:drift-ai';
const readCache = (): Map<string, 'drift' | 'ok'> => { try { const raw = JSON.parse(localStorage.getItem(AI_CACHE) ?? '[]') as [string, 'drift' | 'ok'][]; return new Map(raw.filter((e) => Array.isArray(e) && typeof e[0] === 'string' && (e[1] === 'drift' || e[1] === 'ok')).slice(-200)); } catch { return new Map(); } };
const writeCache = (map: Map<string, 'drift' | 'ok'>) => { try { localStorage.setItem(AI_CACHE, JSON.stringify([...map.entries()].slice(-200))); } catch { /* Full storage. */ } };
export const clearDriftAiCache = () => { try { localStorage.removeItem(AI_CACHE); } catch { /* Ignore. */ } };

/**
 * Desktop only, renders nothing. Takes what the shell sees (the front program, the open website), asks lib/drift what it means,
 * and does what the user chose when they drift: a message, a system notification, a distraction mark, a pause.
 */
export function DriftBridge() {
  const sound = useSound();
  const timer = useTimer();
  const [prefs] = usePrefs();
  const d = prefs.drift;
  const latest = useRef({ d, timer, sound, flow: prefs.flow });
  latest.current = { d, timer, sound, flow: prefs.flow };
  const cache = useRef(readCache());
  const limiter = useRef(createHourLimiter(() => latest.current.d.aiPerHour, () => Date.now()));
  const aiWarned = useRef(false);
  const tracker = useRef<ReturnType<typeof createDriftTracker> | null>(null);

  if (!tracker.current) {
    tracker.current = createDriftTracker({
      now: () => Date.now(),
      settings: () => latest.current.d,
      focusActive: () => latest.current.timer.running && latest.current.timer.phase === 'focus',
      aiCache: cache.current,
      onUnknown: (key, sample) => { void askAi(key, sample); },
      onDrift: (event) => respond(event),
    });
  }

  function respond(event: DriftEvent) {
    const { d: s, timer: t, sound: snd } = latest.current;
    const where = event.host || event.label;
    const subject = getPlan().subject;
    addDriftLog({ at: event.at, label: where, category: event.category, why: event.why, seconds: event.seconds, source: event.source, subject });
    emitAutomation('drift-detected', { title: where });
    if (event.firstOfEpisode && s.onMark && t.running) t.markDistraction();
    const title = `Drifted to ${where}`;
    const body = event.category ? `${event.category}. Back to your block?` : 'Back to your block?';
    if (s.onNote) addNote({ kind: 'drift', title, message: body, key: 'drift' });
    if (s.onSystem) osNotify(title, body);
    if (s.onToast) notify({ title, message: body, variant: 'warning', id: 'drift', kind: 'drift', record: false, duration: 9000, actions: { label: 'Allow this for now', onClick: () => tracker.current?.allowNow(), variant: 'outline' } });
    if (s.onChime) playUi('pause');
    if (s.onPause && t.running) t.pause();
    if (s.onSoundPause && snd.playing) snd.pause();
  }

  async function askAi(key: string, sample: { app: string; host: string; title: string }) {
    const { d: s, flow } = latest.current;
    if (!s.ai || cache.current.has(key)) return;
    if (!limiter.current.allow()) return;
    const plan = getPlan();
    const prompt = buildDriftPrompt({ app: sample.app, host: sample.host, title: sample.title, subject: plan.subject.split(':').pop()?.replace(/-/g, ' ') ?? '', goal: plan.goal, sendTitle: s.aiSendTitle });
    try {
      const fetcher = desktop ? (request: Parameters<NonNullable<typeof desktop>['netFetch']>[0]) => desktop!.netFetch(request) : (await import('../lib/flowApi')).browserFetcher;
      const reply = await chatText(prompt.system, prompt.user, flow, readKeys(), { fetcher, usage: usageStore, device: deviceId() }, { ownKeyOnly: true, maxTokens: 80, json: true });
      const parsed = parseDriftReply(reply);
      if (parsed) { cache.current.set(aiKey(sample.app, sample.host), parsed.drift ? 'drift' : 'ok'); writeCache(cache.current); tracker.current?.tick(); }
    } catch (error) {
      if (!aiWarned.current) { aiWarned.current = true; notify({ title: 'AI check could not run', message: error instanceof FlowApiError ? error.message : 'The AI service did not answer.', variant: 'warning', id: 'drift-ai', kind: 'drift' }); }
    }
  }

  useEffect(() => {
    const api = desktop;
    if (!api) return;
    const off = [
      api.onDriftSample((sample) => tracker.current?.feed(sample)),
      api.onDriftStatus((status) => patchIntegrationState({ driftWindow: status.window, driftHelper: status.helper, driftMessage: status.message, driftPairing: status.pairing === true })),
    ];
    void api.integrationStatus().then((status) => { if (status?.drift) patchIntegrationState({ driftWindow: status.drift.window, driftHelper: status.drift.helper, driftMessage: status.drift.message, driftPairing: status.drift.pairing === true }); });
    return () => off.forEach((fn) => fn());
  }, []);

  useEffect(() => {
    desktop?.driftConfig({ enabled: d.enabled, window: true, helper: d.enabled && d.helper, port: d.port, token: d.token });
    if (!d.enabled) { tracker.current?.reset(); patchIntegrationState({ driftNow: null }); }
  }, [d.enabled, d.helper, d.port, d.token]);

  useEffect(() => {
    if (!desktop) return;
    const id = window.setInterval(() => {
      const tr = tracker.current; if (!tr) return;
      tr.tick();
      const st = tr.state();
      const next = latest.current.d.enabled && st.judgement.label ? { label: st.judgement.label, verdict: st.judgement.verdict, why: st.judgement.why, seconds: st.since ? Math.round((Date.now() - st.since) / 1000) : 0 } : null;
      const cur = getIntegrationState().driftNow;
      if ((cur?.label ?? '') !== (next?.label ?? '') || cur?.verdict !== next?.verdict || (next && cur && Math.floor(cur.seconds / 5) !== Math.floor(next.seconds / 5))) patchIntegrationState({ driftNow: next });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
