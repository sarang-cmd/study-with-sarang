/** Soft start, done and error sounds for Flow. Tiny synthesized tones, no files. */
let context: AudioContext | null = null;
export type Cue = 'start' | 'stop' | 'done' | 'error';
const NOTES: Record<Cue, number[]> = { start: [523.25, 783.99], stop: [659.25, 523.25], done: [523.25, 659.25, 783.99], error: [233.08, 196] };

export function playCue(kind: Cue, volume = .5) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    context ??= new Ctx();
    if (context.state === 'suspended') void context.resume();
    const t0 = context.currentTime + .01;
    NOTES[kind].forEach((freq, i) => {
      const osc = context!.createOscillator(), amp = context!.createGain();
      osc.type = kind === 'error' ? 'triangle' : 'sine'; osc.frequency.value = freq;
      const start = t0 + i * .075;
      amp.gain.setValueAtTime(0, start); amp.gain.linearRampToValueAtTime(.09 * volume, start + .015); amp.gain.exponentialRampToValueAtTime(.0001, start + .22);
      osc.connect(amp).connect(context!.destination); osc.start(start); osc.stop(start + .25);
    });
  } catch { /* No audio available. */ }
}

/** A single soft tone as the breath changes direction: rising on in, falling on out, a quiet tick for the holds. */
export function BREATH_TONES(phase: 'in' | 'hold' | 'out' | 'rest') {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    context ??= new Ctx();
    if (context.state === 'suspended') void context.resume();
    const t = context.currentTime + .01;
    const osc = context.createOscillator(), amp = context.createGain();
    osc.type = 'sine';
    const from = phase === 'in' ? 330 : phase === 'out' ? 440 : 392, to = phase === 'in' ? 440 : phase === 'out' ? 330 : 392;
    osc.frequency.setValueAtTime(from, t); osc.frequency.linearRampToValueAtTime(to, t + .6);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(phase === 'hold' || phase === 'rest' ? .03 : .07, t + .08); amp.gain.exponentialRampToValueAtTime(.0001, t + .9);
    osc.connect(amp).connect(context.destination); osc.start(t); osc.stop(t + 1);
  } catch { /* No audio available. */ }
}
