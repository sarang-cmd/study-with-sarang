/**
 * Calm tools: a breathing guide, quiet moving scenes, a grounding exercise, a wind-down timer and an intention.
 * Plain logic here; the drawing is in lib/calmScenes and the screen is components/CalmOverlay.
 * Everything stays grayscale, like the rest of the studio.
 */
export type PatternId = 'box' | '478' | 'coherent' | 'relax' | 'custom';
export type SceneId = 'aurora' | 'rain' | 'stars' | 'ripples' | 'embers' | 'drift';
export interface Pattern { id: PatternId; label: string; blurb: string; steps: [number, number, number, number] } // in, hold, out, rest (seconds)
export const PATTERNS: Pattern[] = [
  { id: 'box', label: 'Box 4-4-4-4', blurb: 'In, hold, out, hold. Steadies a racing mind. Used before exams and presentations.', steps: [4, 4, 4, 4] },
  { id: '478', label: '4-7-8', blurb: 'A long, slow exhale. Good for winding down and falling asleep.', steps: [4, 7, 8, 0] },
  { id: 'coherent', label: 'Coherent 5.5', blurb: 'About six breaths a minute, in and out evenly. A gentle everyday rhythm.', steps: [5.5, 0, 5.5, 0] },
  { id: 'relax', label: 'Relax 4-2-6', blurb: 'A longer breath out than in, with a short pause. A soft reset between blocks.', steps: [4, 2, 6, 0] },
  { id: 'custom', label: 'My own', blurb: 'Set each part yourself.', steps: [4, 2, 6, 0] },
];
export const SCENES: { id: SceneId; label: string; blurb: string }[] = [
  { id: 'aurora', label: 'Aurora', blurb: 'Slow ribbons of light.' },
  { id: 'rain', label: 'Rain on glass', blurb: 'Drops that run down a window.' },
  { id: 'stars', label: 'Starfield', blurb: 'A quiet night sky that twinkles.' },
  { id: 'ripples', label: 'Ripples', blurb: 'Circles spreading over still water.' },
  { id: 'embers', label: 'Embers', blurb: 'Soft sparks rising from a fire.' },
  { id: 'drift', label: 'Mist', blurb: 'Fog drifting past.' },
];

export interface CalmSettings {
  pattern: PatternId; custom: [number, number, number, number];
  cycles: number;             // 0 = until you stop
  breathSound: boolean;       // A soft tone as each breath changes direction
  breathCount: boolean;       // Show the seconds counting down inside the orb
  scene: SceneId;
  sceneSound: boolean;        // The scene reacts to the sound that is playing
  intensity: number;          // 10 to 100: how much is on screen
  speed: number;              // 25 to 200 percent
  motion: 'auto' | 'full' | 'reduced';
  screensaver: boolean; screensaverMinutes: number;
  windMinutes: number; windFade: number; windDim: boolean;  // Wind-down: total, fade length, dim the screen
  intentionOn: boolean; intention: string;
  groundingPace: number;      // Seconds per step in the 5-4-3-2-1 exercise when it runs by itself (0 = manual)
}
export const defaultCalm: CalmSettings = {
  pattern: 'box', custom: [4, 2, 6, 0], cycles: 0, breathSound: false, breathCount: true,
  scene: 'aurora', sceneSound: true, intensity: 60, speed: 100, motion: 'auto',
  screensaver: false, screensaverMinutes: 5, windMinutes: 30, windFade: 10, windDim: true,
  intentionOn: false, intention: '', groundingPace: 0,
};

export function sanitizeCalm(raw: unknown): CalmSettings {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const d = defaultCalm;
  const flag = (v: unknown, f: boolean) => (typeof v === 'boolean' ? v : f);
  const num = (v: unknown, f: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : f);
  const custom = Array.isArray(r.custom) && r.custom.length === 4 ? (r.custom.map((x, i) => Math.round(num(x, d.custom[i], i === 1 || i === 3 ? 0 : 1, 20) * 10) / 10) as [number, number, number, number]) : [...d.custom] as [number, number, number, number];
  return {
    pattern: PATTERNS.some((p) => p.id === r.pattern) ? (r.pattern as PatternId) : d.pattern, custom,
    cycles: Math.round(num(r.cycles, d.cycles, 0, 99)), breathSound: flag(r.breathSound, d.breathSound), breathCount: flag(r.breathCount, d.breathCount),
    scene: SCENES.some((s) => s.id === r.scene) ? (r.scene as SceneId) : d.scene, sceneSound: flag(r.sceneSound, d.sceneSound),
    intensity: Math.round(num(r.intensity, d.intensity, 10, 100)), speed: Math.round(num(r.speed, d.speed, 25, 200)),
    motion: r.motion === 'full' || r.motion === 'reduced' ? r.motion : 'auto',
    screensaver: flag(r.screensaver, d.screensaver), screensaverMinutes: Math.round(num(r.screensaverMinutes, d.screensaverMinutes, 1, 120)),
    windMinutes: Math.round(num(r.windMinutes, d.windMinutes, 1, 240)), windFade: Math.round(num(r.windFade, d.windFade, 1, 60)), windDim: flag(r.windDim, d.windDim),
    intentionOn: flag(r.intentionOn, d.intentionOn), intention: typeof r.intention === 'string' ? r.intention.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 140) : d.intention,
    groundingPace: Math.round(num(r.groundingPace, d.groundingPace, 0, 60)),
  };
}

export const stepsFor = (settings: Pick<CalmSettings, 'pattern' | 'custom'>): [number, number, number, number] =>
  settings.pattern === 'custom' ? settings.custom : (PATTERNS.find((p) => p.id === settings.pattern) ?? PATTERNS[0]).steps;

export type BreathPhase = 'in' | 'hold' | 'out' | 'rest';
export interface BreathState { phase: BreathPhase; progress: number; scale: number; secondsLeft: number; cycle: number; label: string }
const LABEL: Record<BreathPhase, string> = { in: 'Breathe in', hold: 'Hold', out: 'Breathe out', rest: 'Rest' };
const ease = (x: number) => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, x)))) / 2;

/** Where in the breath you are after `t` seconds. `scale` runs from 0 (small) to 1 (full) and is smooth at every turn. */
export function breathAt(steps: [number, number, number, number], t: number): BreathState {
  const [a, b, c, d] = steps;
  const total = a + b + c + d;
  const cycle = total > 0 ? Math.floor(t / total) : 0;
  let x = total > 0 ? t - cycle * total : 0;
  const parts: [BreathPhase, number][] = [['in', a], ['hold', b], ['out', c], ['rest', d]];
  for (const [phase, length] of parts) {
    if (length <= 0) continue;
    if (x < length) {
      const progress = x / length;
      const scale = phase === 'in' ? ease(progress) : phase === 'out' ? 1 - ease(progress) : phase === 'hold' ? 1 : 0;
      return { phase, progress, scale, secondsLeft: Math.max(1, Math.ceil(length - x)), cycle, label: LABEL[phase] };
    }
    x -= length;
  }
  return { phase: 'in', progress: 0, scale: 0, secondsLeft: 1, cycle, label: LABEL.in };
}
export const cycleSeconds = (steps: [number, number, number, number]) => steps.reduce((sum, x) => sum + x, 0);

// ---------------------------------------------------------------------------------------------- grounding
export const GROUNDING = [
  { count: 5, sense: 'see', prompt: 'Name 5 things you can see.' },
  { count: 4, sense: 'feel', prompt: 'Notice 4 things you can feel, like your feet on the floor or the chair under you.' },
  { count: 3, sense: 'hear', prompt: 'Listen for 3 things you can hear.' },
  { count: 2, sense: 'smell', prompt: 'Find 2 things you can smell, or like to smell.' },
  { count: 1, sense: 'taste', prompt: 'Name 1 thing you can taste, or take one slow sip of water.' },
];

// ---------------------------------------------------------------------------------------------- wind-down
export interface WindDown { startedAt: number; endsAt: number; fadeMs: number; dim: boolean; done: boolean }
export function startWindDown(now: number, minutes: number, fadeMinutes: number, dim: boolean): WindDown {
  const total = Math.max(1, minutes) * 60_000;
  return { startedAt: now, endsAt: now + total, fadeMs: Math.min(total, Math.max(1, fadeMinutes) * 60_000), dim, done: false };
}
/** The share of full volume to play at, 1 before the fade and 0 at the end. */
export function windDownLevel(w: WindDown, now: number): number {
  const left = w.endsAt - now;
  if (left <= 0) return 0;
  if (left >= w.fadeMs) return 1;
  const x = left / w.fadeMs;
  return x * x * (3 - 2 * x); // smoothstep, so there is no audible step at the start of the fade
}
/** How dark the screen veil is, 0 to .85, growing over the last stretch. */
export function windDownVeil(w: WindDown, now: number): number {
  if (!w.dim) return 0;
  const left = w.endsAt - now;
  if (left <= 0) return .85;
  const span = Math.min(w.fadeMs, 5 * 60_000);
  return left >= span ? 0 : .85 * (1 - left / span);
}
export const minutesLeft = (w: WindDown, now: number) => Math.max(0, Math.ceil((w.endsAt - now) / 60_000));
