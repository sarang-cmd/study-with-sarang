import type { LocalListener, Recorder, Recording } from './flowEngine';

/**
 * The microphone side of Flow, in the page. It records only while Flow is listening, measures loudness for the bar,
 * and (optionally) keeps the microphone open for a few seconds afterwards so the next request starts instantly.
 */
export interface RecorderOptions {
  warmSeconds: () => number;
  onLevel: (level: number, bars: number[]) => void;
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
}

const MIMES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];
export const pickMime = (supported: (type: string) => boolean) => MIMES.find((type) => { try { return supported(type); } catch { return false; } }) ?? '';

export const BAR_COUNT = 32;

/** Turns frequency data into BAR_COUNT values from 0 to 1, weighted toward the voice range so the bar looks lively on speech. */
export function barsFrom(freq: Uint8Array, count = BAR_COUNT): number[] {
  const usable = Math.max(count, Math.floor(freq.length * .6));
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i / count) ** 1.4 * usable), to = Math.max(from + 1, Math.floor(((i + 1) / count) ** 1.4 * usable));
    let sum = 0; for (let j = from; j < to; j++) sum += freq[j] ?? 0;
    out.push(Math.min(1, (sum / (to - from) / 255) * 1.35));
  }
  return out;
}
/** Loudness 0 to 1 from time-domain samples (centered on 128). */
export function levelFrom(samples: Uint8Array): number {
  let sum = 0; for (let i = 0; i < samples.length; i++) { const v = (samples[i] - 128) / 128; sum += v * v; }
  return Math.min(1, Math.sqrt(sum / Math.max(1, samples.length)) * 3.2);
}

export function createRecorder(options: RecorderOptions): Recorder & { prepare(): Promise<void>; close(): void; active(): boolean } {
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let startedAt = 0;
  let meter: ReturnType<typeof setInterval> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let mime = '';
  let opening: Promise<void> | null = null;

  async function open() {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    if (stream && stream.getAudioTracks().some((track) => track.readyState === 'live')) return;
    const devices = options.mediaDevices ?? navigator.mediaDevices;
    if (!devices?.getUserMedia) { const error = new Error('No microphone API'); error.name = 'NotFoundError'; throw error; }
    stream = await devices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    context = new Ctx();
    source = context.createMediaStreamSource(stream);
    analyser = context.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = .6;
    source.connect(analyser);
  }
  function release() {
    if (meter) { clearInterval(meter); meter = null; }
    try { source?.disconnect(); } catch { /* Gone. */ }
    stream?.getTracks().forEach((track) => track.stop());
    void context?.close().catch(() => undefined);
    stream = null; context = null; analyser = null; source = null;
  }
  function scheduleRelease() {
    const warm = options.warmSeconds();
    if (closeTimer) clearTimeout(closeTimer);
    if (warm <= 0) { release(); return; }
    closeTimer = setTimeout(() => { closeTimer = null; if (!recorder) release(); }, warm * 1000);
  }

  return {
    active: () => recorder !== null,
    async prepare() { await open(); },
    close() { if (closeTimer) clearTimeout(closeTimer); recorder = null; release(); },
    async start() {
      if (recorder) return;
      opening = open();
      await opening; opening = null;
      if (!stream || !analyser) throw new Error('No stream');
      if (context?.state === 'suspended') await context.resume().catch(() => undefined);
      mime = pickMime((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));
      chunks = [];
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
      rec.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder = rec; startedAt = Date.now();
      rec.start(250);
      const time = new Uint8Array(analyser.fftSize), freq = new Uint8Array(analyser.frequencyBinCount);
      meter = setInterval(() => {
        if (!analyser) return;
        analyser.getByteTimeDomainData(time); analyser.getByteFrequencyData(freq);
        options.onLevel(levelFrom(time), barsFrom(freq));
      }, 33);
    },
    async stop(): Promise<Recording | null> {
      const rec = recorder;
      if (meter) { clearInterval(meter); meter = null; }
      if (!rec) return null;
      recorder = null;
      const seconds = (Date.now() - startedAt) / 1000;
      const done = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
      try { if (rec.state !== 'inactive') rec.stop(); } catch { /* Already stopped. */ }
      await Promise.race([done, new Promise<void>((resolve) => setTimeout(resolve, 1500))]);
      scheduleRelease();
      const blob = new Blob(chunks, { type: (rec.mimeType || mime || 'audio/webm').split(';')[0] });
      chunks = [];
      if (!blob.size) return null;
      return { bytes: await blob.arrayBuffer(), mime: blob.type || 'audio/webm', seconds };
    },
    cancel() {
      const rec = recorder; recorder = null; chunks = [];
      if (meter) { clearInterval(meter); meter = null; }
      if (rec) { rec.ondataavailable = null; rec.onstop = null; try { if (rec.state !== 'inactive') rec.stop(); } catch { /* Already stopped. */ } }
      scheduleRelease();
    },
  };
}

// ---------------------------------------------------------------------------------------------- built-in recognizers
interface SpeechResultLike { isFinal: boolean; 0: { transcript: string } }
interface SpeechEventLike { results: ArrayLike<SpeechResultLike> }
interface RecognitionLike { lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number; onresult: ((e: SpeechEventLike) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start(): void; stop(): void; abort(): void }

/** The browser's own speech recognition. Chrome, Edge and Safari have it; they send the audio to the browser maker, so it is opt-in. */
export function browserListener(language: () => 'auto' | 'en' | 'de'): LocalListener | null {
  const Ctor = (window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => RecognitionLike }).webkitSpeechRecognition;
  if (!Ctor) return null;
  let rec: RecognitionLike | null = null;
  let text = '';
  let ended: (() => void) | null = null;
  return {
    start() {
      text = '';
      try {
        const r = new Ctor();
        const lang = language();
        r.lang = lang === 'de' ? 'de-DE' : lang === 'en' ? 'en-US' : (navigator.language || 'en-US');
        r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
        r.onresult = (event) => { let t = ''; for (let i = 0; i < event.results.length; i++) t += `${event.results[i][0].transcript} `; text = t.trim(); };
        r.onend = () => { ended?.(); };
        r.onerror = () => { ended?.(); };
        rec = r; r.start();
      } catch { rec = null; }
    },
    stop() {
      return new Promise<string>((resolve) => {
        const r = rec; rec = null;
        if (!r) { resolve(text); return; }
        const timer = setTimeout(() => { ended = null; resolve(text); }, 900);
        ended = () => { clearTimeout(timer); ended = null; resolve(text); };
        try { r.stop(); } catch { clearTimeout(timer); resolve(text); }
      });
    },
  };
}
