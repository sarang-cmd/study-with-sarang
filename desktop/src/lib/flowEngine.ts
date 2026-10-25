/**
 * The Flow pipeline, from key press to action. Free and local first:
 *   1. What the built-in recognizer heard is read by lib/intent. If that is clear, it runs. No service is involved.
 *   2. Only when it is unsure does Flow turn to a service: it asks you first (or goes ahead, as you chose), turns the recording into text,
 *      reads that with the same built-in understanding, and only if that still fails asks the AI what was meant.
 *   3. Recordings that contain no speech never leave the device.
 * All outside effects are passed in, so every branch can be tested.
 */
import { FlowApiError, ask, transcribe, type AskContext, type AskResult, type Deps, type Keys } from './flowApi';
import { Gesture, Vad, idleUi, type FlowConfirm, type FlowSettings, type FlowUi, type GestureAction } from './flow';
import { guessIntent, parseIntent, type Intent, type IntentContext } from './intent';

export interface Recording { bytes: ArrayBuffer; mime: string; seconds: number }
export interface Recorder {
  start(): Promise<void>;
  /** Stops and returns the audio, or null when there is none. */
  stop(): Promise<Recording | null>;
  cancel(): void;
}
export interface LocalListener {
  /** Begin listening for words the built-in recognizer can place. */
  start(): void;
  /** Stop and give the best text it has (possibly empty). */
  stop(): Promise<string>;
}
export interface FlowDeps {
  settings: () => FlowSettings;
  keys: () => Keys;
  api: Deps;
  publishable?: () => { url: string; key: string } | undefined;
  recorder: Recorder;
  local: () => LocalListener | null;
  context: () => IntentContext & { playing: boolean; volume: number; timerRunning: boolean; level: string };
  /** Runs a command. It may return a sentence (an answer, or what happened) to show and speak. */
  execute: (command: string) => void | string | Promise<string | void>;
  say: (text: string, kind: 'answer' | 'done') => void;
  cue: (kind: 'start' | 'stop' | 'done' | 'error') => void;
  publish: (ui: FlowUi) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

type ConfirmChoice = 'run' | 'ask' | 'cancel';

export class FlowEngine {
  ui: FlowUi = idleUi();
  private gesture: Gesture;
  private vad: Vad | null = null;
  private listening = false;
  private starting: Promise<void> | null = null;
  private seq = 0;
  private confirmResolve: ((choice: ConfirmChoice) => void) | null = null;
  private local: LocalListener | null = null;
  private idleTimer: unknown = null;
  private busy = false;

  constructor(private deps: FlowDeps) {
    const s = deps.settings();
    this.gesture = new Gesture((action) => this.onGesture(action), { mode: s.mode, tapMs: s.tapMs, doubleMs: s.doubleMs });
  }

  private now = () => this.deps.now?.() ?? Date.now();
  private after(fn: () => void, ms: number) { return this.deps.setTimer ? this.deps.setTimer(fn, ms) : setTimeout(fn, ms); }
  private clear(id: unknown) { if (this.deps.clearTimer) this.deps.clearTimer(id); else clearTimeout(id as ReturnType<typeof setTimeout>); }

  private set(patch: Partial<FlowUi>) {
    const s = this.deps.settings();
    this.ui = { ...this.ui, style: s.barStyle, place: s.barPlace, size: s.barSize, showText: s.barText, ...patch, seq: ++this.seq };
    this.deps.publish(this.ui);
  }
  private linger(ms: number) { if (this.idleTimer) this.clear(this.idleTimer); this.idleTimer = this.after(() => { this.idleTimer = null; if (!this.listening && !this.busy) this.set({ phase: 'idle', text: '', message: '', confirm: null, bars: [], level: 0 }); }, ms); }

  // ---- input ------------------------------------------------------------------------------
  /** Raw key events from the shell (down and up) or from the page. */
  keyDown() { this.configure(); this.gesture.down(this.now()); }
  keyUp() { this.gesture.up(this.now()); }
  keyToggle() { this.configure(); this.gesture.toggle(this.now()); }
  tick() { this.gesture.tick(this.now()); }
  private configure() { const s = this.deps.settings(); this.gesture.options = { mode: s.mode, tapMs: s.tapMs, doubleMs: s.doubleMs }; }
  /** Esc or the bar's close button. */
  cancel() { this.finishListening(false); if (this.confirmResolve) { const done = this.confirmResolve; this.confirmResolve = null; done('cancel'); } }
  /** Another key was pressed with the Flow key (a shortcut such as Ctrl+C): this was not meant for Flow. */
  abort() { if (this.listening) void this.finishListening(false); else this.gesture.reset(); }
  /** The bar's own stop button in hands-free mode. */
  stopNow() { if (this.listening) { this.gesture.reset(); void this.finishListening(true); } }
  choose(choice: ConfirmChoice) { const done = this.confirmResolve; this.confirmResolve = null; done?.(choice); }
  get isActive() { return this.listening || this.busy || this.ui.phase === 'confirm'; }

  private onGesture(action: GestureAction) {
    if (this.ui.phase === 'confirm') { if (action === 'start') { this.cancel(); void this.begin(); } return; }
    if (this.busy) return;
    if (action === 'start') void this.begin();
    else if (action === 'handsfree') this.set({ mode: 'handsfree' });
    else if (action === 'stop') void this.finishListening(true);
    else if (action === 'cancel') this.finishListening(false);
  }

  // ---- listening --------------------------------------------------------------------------
  private async begin() {
    const s = this.deps.settings();
    if (!s.enabled || this.listening) return;
    if (this.idleTimer) { this.clear(this.idleTimer); this.idleTimer = null; }
    this.listening = true;
    this.vad = new Vad({ silenceMs: s.silenceMs, maxMs: s.maxSeconds * 1000 });
    this.local = this.deps.local();
    this.local?.start();
    this.set({ phase: 'listening', mode: 'hold', text: '', message: '', confirm: null, bars: [], level: 0 });
    this.after(() => { if (this.listening) this.deps.cue('start'); }, 140); // A quick Ctrl+C style tap should stay silent
    this.starting = this.deps.recorder.start().catch((error: unknown) => {
      this.listening = false; this.local = null; this.gesture.reset();
      this.set({ phase: 'error', message: micMessage(error) });
      this.deps.cue('error'); this.linger(4000);
    });
    await this.starting;
  }

  /** Called by the recorder about 30 times a second while listening. Hands-free listening ends here when you stop talking. */
  level(level: number, bars: number[]) {
    if (!this.listening || !this.vad) return;
    const verdict = this.vad.feed(level, this.now());
    this.ui = { ...this.ui, level, bars };
    this.deps.publish({ ...this.ui, seq: ++this.seq });
    if (verdict === 'limit' || (verdict === 'end' && this.ui.mode === 'handsfree')) { this.gesture.reset(); void this.finishListening(true); }
    else if (verdict === 'end' && this.ui.mode === 'hold' && !this.vad.spoke) { /* Holding in silence is fine. */ }
  }

  private async finishListening(process: boolean) {
    if (!this.listening) return;
    if (this.starting) { const pending = this.starting; this.starting = null; await pending; if (!this.listening) return; }
    this.listening = false;
    const vad = this.vad; this.vad = null;
    const local = this.local; this.local = null;
    this.gesture.reset();
    if (!process) { this.deps.recorder.cancel(); void local?.stop(); this.set({ phase: 'idle', text: '', message: '', bars: [], level: 0 }); return; }
    this.deps.cue('stop');
    this.busy = true;
    this.set({ phase: 'thinking', message: '', bars: [], level: 0 });
    try {
      const [recording, heard] = await Promise.all([this.deps.recorder.stop(), local ? local.stop() : Promise.resolve('')]);
      await this.handle((heard ?? '').trim(), recording, Boolean(vad?.heardSomething()), local !== null);
    } catch (error) {
      this.fail(error);
    } finally { this.busy = false; }
  }

  // ---- understanding ----------------------------------------------------------------------
  private async handle(heard: string, recording: Recording | null, loud: boolean, hasLocal: boolean) {
    const s = this.deps.settings();
    const ctx = this.deps.context();
    const intents: IntentContext = { mixNames: ctx.mixNames, macroNames: ctx.macroNames, todoNames: ctx.todoNames, subjectNames: ctx.subjectNames };

    // 1. The built-in recognizer and understanding: free, private, instant.
    if (heard) {
      const intent = parseIntent(heard, intents);
      if (intent) { await this.run(intent, heard); return; }
    }
    // Nothing worth sending: no speech, or too short.
    if (!heard && (!recording || !loud || recording.seconds < .35)) { this.say('error', heard ? heard : '', 'I did not hear anything.'); return; }

    // 2. Unsure. Is there anything to turn to?
    const canAsk = s.sttProvider !== 'off' && Boolean(recording) && recording!.bytes.byteLength > 0;
    const guess = heard ? guessIntent(heard, intents) : null;
    if (s.unsure === 'never' || (!canAsk && !(s.chatProvider !== 'off' && heard))) {
      if (guess && s.unsure !== 'never') { const ok = await this.confirm({ heard, guess: guess.command, guessLabel: guess.label, canAsk: false }); if (ok === 'run') await this.run(guess, heard); else this.toIdle(); return; }
      this.say('error', heard, heard ? `I did not understand "${heard}".` : 'I did not catch that.'); return;
    }
    // With no local recognizer at all (the web), every request needs the service, so asking each time would only be noise.
    if (s.unsure === 'ask' && hasLocal) {
      const choice = await this.confirm({ heard, guess: guess?.command ?? '', guessLabel: guess?.label ?? '', canAsk });
      if (choice === 'cancel') { this.toIdle(); return; }
      if (choice === 'run' && guess) { await this.run(guess, heard); return; }
    }

    // 3. The service. Text first (reading it with the built-in understanding costs nothing), then the AI.
    this.set({ phase: 'thinking', text: heard, message: 'Asking the service' });
    let text = heard;
    const publishable = this.deps.publishable?.();
    if (canAsk) {
      const words = await transcribe(recording!.bytes, recording!.mime, s, this.deps.keys(), this.deps.api, publishable, [...ctx.mixNames, ...ctx.macroNames]);
      if (words) text = words;
    }
    if (!text) { this.say('error', '', 'I did not catch that.'); return; }
    this.set({ text });
    const again = parseIntent(text, intents);
    if (again) { await this.run(again, text); return; }
    if (s.chatProvider === 'off') { this.say('error', text, `I heard "${text}", but did not understand it.`); return; }
    const result: AskResult = await ask(text, { ...ctx, answers: s.answers, language: s.language } satisfies AskContext, s, this.deps.keys(), this.deps.api, publishable);
    if (result.type === 'command') { await this.run({ command: result.command, label: labelFor(result.command), confidence: .8, how: 'guess' }, text); return; }
    if (result.type === 'answer') { this.set({ phase: 'done', text, message: result.text, bars: [], level: 0 }); this.deps.cue('done'); this.deps.say(result.text, 'answer'); this.linger(Math.min(14000, 4000 + result.text.length * 60)); return; }
    this.say('error', text, `I heard "${text}", but could not work out what to do.`);
  }

  private async run(intent: Intent, heard: string) {
    let answer = '';
    let slow: ReturnType<typeof setTimeout> | undefined;
    try {
      const out = await Promise.race([Promise.resolve(this.deps.execute(intent.command)), new Promise<void>((resolve) => { slow = setTimeout(resolve, 12000); })]);
      if (typeof out === 'string') answer = out.trim();
    } catch { /* A failing command must not break the bar. */ }
    clearTimeout(slow);
    const message = answer || intent.label;
    this.set({ phase: 'done', text: heard, message, bars: [], level: 0 });
    this.deps.cue('done');
    if (answer) this.deps.say(answer, 'answer');
    else if (this.deps.settings().speakDone) this.deps.say(intent.label, 'done');
    this.linger(answer ? Math.min(9000, 2200 + answer.length * 55) : 1700);
  }
  private say(phase: 'error', heard: string, message: string) {
    this.set({ phase, text: heard, message, bars: [], level: 0 }); this.deps.cue('error'); this.linger(3800);
  }
  private fail(error: unknown) {
    const message = error instanceof FlowApiError ? error.message : error instanceof Error ? error.message.slice(0, 160) : 'Something went wrong.';
    this.set({ phase: 'error', message, bars: [], level: 0 }); this.deps.cue('error'); this.linger(5200);
  }
  private confirm(request: FlowConfirm): Promise<ConfirmChoice> {
    this.set({ phase: 'confirm', text: request.heard, message: '', confirm: request, bars: [], level: 0 });
    return new Promise<ConfirmChoice>((resolve) => {
      const timer = this.after(() => finish('cancel'), 20000);
      const finish = (choice: ConfirmChoice) => { this.clear(timer); if (this.confirmResolve === finish) this.confirmResolve = null; resolve(choice); };
      this.confirmResolve = finish;
    });
  }
  private toIdle() { if (!this.listening) this.set({ phase: 'idle', text: '', message: '', confirm: null, bars: [], level: 0 }); }

  /** Closes everything, for when Flow is turned off or the page goes away. */
  dispose() { this.listening = false; this.deps.recorder.cancel(); void this.local?.stop(); if (this.idleTimer) this.clear(this.idleTimer); this.set({ phase: 'idle', bars: [], level: 0, confirm: null }); }
}

function micMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'The microphone is blocked. Allow it in the browser, or in Windows Settings > Privacy > Microphone.';
  if (name === 'NotFoundError') return 'No microphone was found.';
  if (name === 'NotReadableError') return 'The microphone is in use by another app.';
  return 'The microphone could not start.';
}
const labelFor = (command: string) => command.replace(/[._]/g, ' ').replace(':', ': ');
