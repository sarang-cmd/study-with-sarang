import { baseRecipe, layerIds, layerInfo } from './catalog';
import type { BaseId, BaseRecipe, LayerId } from './catalog';
import type { MixState, Tune } from './mix';
import { layerSetting } from './mix';
import { recordingFor } from './recordings';

/** Everything is generated in the browser, with no network. The ten classic ambience layers can be replaced by real recordings (lib/recordings). */

// ---------------------------------------------------------------------------
// Layer buffers (8 second seamless-ish loops)
// ---------------------------------------------------------------------------

type Shape = 'bird' | 'cricket' | 'bell' | 'tick' | 'thump' | 'swish' | 'bowl' | 'chime' | 'hoot' | 'croak';
interface SoundEvent { start: number; duration: number; f: number; to: number; power: number; shape: Shape }

const TAU = 2 * Math.PI;
const hashNoise = (n: number) => ((Math.imul((n | 0) ^ 0x9e3779b9, 2654435761) >>> 0) / 4294967296) * 2 - 1;

function renderEvents(out: Float32Array, events: SoundEvent[], sampleRate: number) {
  for (const [index, event] of events.entries()) {
    const first = Math.max(0, Math.floor(event.start * sampleRate));
    const last = Math.min(out.length, Math.ceil((event.start + event.duration) * sampleRate));
    for (let i = first; i < last; i++) {
      const elapsed = i / sampleRate - event.start;
      if (elapsed < 0 || elapsed >= event.duration) continue;
      const { f, to, power, duration } = event;
      let value = 0;
      switch (event.shape) {
        case 'bird':
        case 'cricket': {
          const phase = TAU * (f * elapsed + .5 * to * elapsed ** 2 / duration);
          value = Math.sin(Math.PI * elapsed / duration) ** 2 * Math.sin(phase);
          break;
        }
        case 'bell': {
          const phase = TAU * (f * elapsed + .5 * to * elapsed ** 2 / duration);
          const envelope = Math.sin(Math.PI * elapsed / duration) * Math.exp(-2 * elapsed / duration);
          value = envelope * Math.sin(phase) + .11 * envelope * Math.sin(phase * 2.01);
          break;
        }
        case 'tick': {
          const envelope = Math.exp(-elapsed / (duration * .22));
          value = envelope * (Math.sin(TAU * f * elapsed) * .7 + hashNoise(i * 7 + index * 131) * .55);
          break;
        }
        case 'thump': value = Math.sin(TAU * f * elapsed) * Math.exp(-elapsed * 32) * (1 - elapsed / duration); break;
        case 'swish': value = hashNoise(i * 3 + index * 17) * Math.sin(Math.PI * elapsed / duration) ** 2; break;
        case 'bowl': {
          const attack = 1 - Math.exp(-elapsed * 38), decay = Math.exp(-elapsed * 1.05);
          value = attack * decay * (Math.sin(TAU * f * elapsed) + .8 * Math.sin(TAU * f * 1.0045 * elapsed) + .3 * Math.sin(TAU * f * 2.71 * elapsed) + .1 * Math.sin(TAU * f * 5.15 * elapsed)) / 2.2;
          break;
        }
        case 'chime': {
          const attack = 1 - Math.exp(-elapsed * 220), decay = Math.exp(-elapsed * 3.3);
          value = attack * decay * (Math.sin(TAU * f * elapsed) + .4 * Math.sin(TAU * f * 2.76 * elapsed) + .15 * Math.sin(TAU * f * 5.4 * elapsed));
          break;
        }
        case 'hoot': {
          const phase = TAU * (f * elapsed - .5 * (.1 * f) * elapsed ** 2 / duration);
          value = Math.sin(Math.PI * elapsed / duration) ** 1.5 * Math.sin(phase + .35 * Math.sin(TAU * 5 * elapsed)) * (.9 + .1 * Math.sin(TAU * 4.5 * elapsed));
          break;
        }
        case 'croak': value = Math.sin(Math.PI * elapsed / duration) ** 2 * Math.sin(TAU * f * elapsed) * (.55 + .45 * Math.sin(TAU * 42 * elapsed)); break;
      }
      out[i] += power * value;
    }
  }
}

export interface BufferContext { sampleRate: number; createBuffer: (channels: number, length: number, sampleRate: number) => AudioBuffer }

export function makeSoundBuffer(context: BufferContext, sound: LayerId, seed: number): AudioBuffer {
  const seconds = 8;
  const length = Math.round(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  let state = (seed ^ Math.imul(layerIds.indexOf(sound) + 1, 0x9e3779b9)) >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const events: SoundEvent[] = [];
  const push = (start: number, duration: number, f: number, to: number, power: number, shape: Shape) => {
    if (start < seconds) events.push({ start, duration: Math.min(duration, seconds - start), f, to, power, shape });
  };

  switch (sound) {
    case 'Birdsong':
      for (let i = 0; i < 9; i++) { const start = (i + .16 + random() * .46) * seconds / 10;
        push(start, .12 + random() * .22, 840 + random() * 440, 90 + random() * 260, .5, 'bird'); }
      break;
    case 'Crickets':
      for (let i = 0; i < 23; i++) { const start = (i + random() * .28) * seconds / 24;
        push(start, .055 + random() * .035, 2100 + random() * 480, 0, .25, 'cricket'); }
      break;
    case 'Soft bells':
      for (let i = 0; i < 5; i++) { const start = (i + .2 + random() * .5) * seconds / 6;
        push(start, .6 + random() * .55, [220, 261.63, 329.63, 392][Math.floor(random() * 4)], 0, .5, 'bell'); }
      break;
    case 'Stream':
      for (let i = 0; i < 70; i++) push(random() * 7.9, .03 + random() * .06, 500 + random() * 900, 500 + random() * 900, .2, 'bird');
      break;
    case 'Night train':
      for (let k = 0; k < 19; k++) { const base = k * seconds / 19;
        push(base, .16, 70, 0, .55, 'thump'); push(base + .115, .16, 82, 0, .45, 'thump');
        push(base, .03, 1800, 0, .1, 'tick'); push(base + .115, .03, 1500, 0, .08, 'tick'); }
      break;
    case 'Clock':
      for (let k = 0; k < 8; k++) push(k + .05, .03, k % 2 ? 1800 : 2300, 0, .5, 'tick');
      break;
    case 'Keyboard': {
      let cursor = .2;
      while (cursor < 7.6) {
        const keys = 3 + Math.floor(random() * 6);
        for (let i = 0; i < keys; i++) { push(cursor, .018 + random() * .02, 1500 + random() * 1800, 0, .22 + random() * .25, 'tick'); cursor += .09 + random() * .12; }
        cursor += .5 + random() * 1.6;
      }
      break;
    }
    case 'Library hush': push(1.5, .45, 0, 0, .1, 'swish'); push(5.2, .38, 0, 0, .09, 'swish'); break;
    case 'Singing bowls':
      push(.3, 3.7, [196, 220, 261.63][Math.floor(random() * 3)], 0, .5, 'bowl');
      push(4.1, 3.7, [174.61, 196, 233.08][Math.floor(random() * 3)], 0, .45, 'bowl');
      break;
    case 'Wind chimes':
      for (const clusterStart of [.4, 4.3]) {
        let at = clusterStart;
        const count = 3 + Math.floor(random() * 2);
        for (let i = 0; i < count; i++) { push(at, 1.2, [523.25, 587.33, 659.25, 783.99, 880][Math.floor(random() * 5)], 0, .3, 'chime'); at += .15 + random() * .25; }
      }
      break;
    case 'Owl':
      for (const call of [1, 5.3]) { push(call, .38, 392, 0, .35, 'hoot'); push(call + .55, .5, 349, 0, .38, 'hoot'); }
      break;
    case 'Frogs':
      for (const group of [.5, 4.5]) for (let i = 0; i < 4; i++) {
        push(group + i * .26, .2, 430, 0, .28, 'croak');
        push(group + .13 + i * .27, .18, 560, 0, .16, 'croak');
      }
      break;
    default: break;
  }
  const eventTrack = new Float32Array(length);
  if (events.length) renderEvents(eventTrack, events, context.sampleRate);

  let smooth = 0, snap = 0, fast = 0, brown = 0;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let peak = .000001;
  for (let i = 0; i < length; i++) {
    const t = i / context.sampleRate;
    const raw = random() * 2 - 1;
    smooth = .992 * smooth + .008 * raw;
    const slow = Math.sin(TAU * (.11 + seed % 7 * .007) * t);
    let value = 0;
    switch (sound) {
      case 'Rainfall': {
        if (random() < 9 / context.sampleRate) snap = .18 + random() * .16;
        snap *= .998;
        value = .38 * raw + smooth * 1.5 + snap * Math.sin(TAU * 1200 * t);
        break;
      }
      case 'Distant thunder': {
        const pulse = Math.exp(-(((t - 2.3) / .9) ** 2)) + .7 * Math.exp(-(((t - 6.1) / 1.1) ** 2));
        value = smooth * (2 + 7 * pulse) + .045 * raw * pulse;
        break;
      }
      case 'Shore waves': value = (.15 * raw + smooth * 2.3) * (.5 + .48 * slow); break;
      case 'Wind': value = (.16 * raw + smooth * 2.5) * (.72 + .22 * slow); break;
      case 'Hearth': {
        if (random() < 22 / context.sampleRate) snap = .25 + random() * .55;
        snap *= .992;
        value = .1 * raw + .65 * smooth + snap * raw;
        break;
      }
      case 'Café': {
        if (random() < 1.9 / context.sampleRate) snap = .2 + random() * .18;
        snap *= .996;
        value = 1.9 * smooth + .085 * raw + snap * Math.sin(TAU * 820 * t);
        break;
      }
      case 'White noise': value = raw * .65; break;
      case 'Pink noise':
        b0 = .99886 * b0 + raw * .0555179; b1 = .99332 * b1 + raw * .0750759; b2 = .969 * b2 + raw * .153852;
        b3 = .8665 * b3 + raw * .3104856; b4 = .55 * b4 + raw * .5329522; b5 = -.7616 * b5 - raw * .016898;
        value = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + raw * .5362) * .11; b6 = raw * .115926;
        break;
      case 'Brown noise': brown = (brown + .02 * raw) / 1.02; value = brown * 3.5; break;
      case 'Box fan': value = (.12 * raw + 3 * smooth) * (1 + .08 * Math.sin(TAU * 7 * t)) + .09 * Math.sin(TAU * 118 * t) + .04 * Math.sin(TAU * 236 * t); break;
      case 'Heavy rain': {
        if (random() < 38 / context.sampleRate) snap = .2 + random() * .2;
        snap *= .997;
        value = .6 * raw + smooth * 1.2 + snap * Math.sin(TAU * 1500 * t);
        break;
      }
      case 'Stream': fast = .72 * fast + .28 * raw; value = (fast - smooth * 3) * 1.1 * (.8 + .2 * slow); break;
      case 'Waterfall': value = (.55 * raw + smooth * 1.6) * (.86 + .1 * slow); break;
      case 'Night train': value = smooth * 2.4 + .1 * raw; break;
      case 'Airplane cabin': value = smooth * 2.2 + .1 * raw + .09 * Math.sin(TAU * 85 * t) + .045 * Math.sin(TAU * 170 * t); break;
      case 'Clock': value = .004 * raw; break;
      case 'Keyboard': value = .006 * raw; break;
      case 'Library hush': value = 1.2 * smooth + .05 * raw; break;
      case 'Singing bowls': value = smooth * .3; break;
      case 'Deep space':
        value = .5 * Math.sin(TAU * 55 * t) * (.7 + .3 * Math.sin(TAU * .125 * t)) + .3 * Math.sin(TAU * 82.5 * t + 1) * (.75 + .25 * Math.sin(TAU * .25 * t))
          + .2 * Math.sin(TAU * 110 * t + 2) * (.6 + .4 * Math.sin(TAU * .25 * t + 1)) + smooth * .7;
        break;
      case 'Owl': value = smooth * .5 + .02 * raw; break;
      case 'Frogs': value = .02 * raw + smooth * .3; break;
      case 'Birdsong':
      case 'Crickets':
      case 'Soft bells':
      case 'Wind chimes': break;
    }
    value += eventTrack[i];
    // Fade both ends of the loop to silence to avoid clicks on wraparound.
    const fade = Math.min(1, i / (context.sampleRate * .09), (length - 1 - i) / (context.sampleRate * .09));
    samples[i] = value * Math.max(0, fade);
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const normalization = Math.min(4, .72 / peak);
  for (let i = 0; i < length; i++) samples[i] *= normalization;
  return buffer;
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

export interface LayerParams { level: number; pan: number; tone: number; width: number }
export interface LayerHandle { gain: GainNode; seed: number; recorded: boolean; set: (params: LayerParams, tc?: number) => void; stop: () => void }
const LAYER_GAIN = .22;

function toneFrequency(base: number, tone: number) { return Math.max(60, Math.min(16000, base * 2 ** (tone / 100 * 1.6))); }

export function makeAmbientLayer(context: AudioContext, sound: LayerId, seed: number, buffer: AudioBuffer, recorded = false): LayerHandle {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, context.currentTime);
  const filter = context.createBiquadFilter();
  // A real recording keeps its whole spectrum; the Tone slider then only softens or brightens it.
  const [type, frequency]: [BiquadFilterType, number] = recorded ? ['lowpass', 9000] : layerInfo[sound].filter;
  filter.type = type; filter.frequency.value = frequency;
  const pan = context.createStereoPanner();
  const source = context.createBufferSource();
  source.buffer = buffer; source.loop = true;
  source.connect(filter).connect(pan).connect(gain);
  // "Next variation" starts a recording somewhere else in the file, so it does not always begin with the same moment.
  source.start(0, recorded ? ((seed * 2654435761) % 1000) / 1000 * Math.max(0, buffer.duration - .1) : 0);
  return {
    gain, seed, recorded,
    set: (params, tc = .08) => {
      const time = context.currentTime;
      filter.frequency.setTargetAtTime(toneFrequency(frequency, params.tone), time, tc);
      pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, params.pan / 100 * (params.width / 100 * 1.6))), time, tc);
    },
    stop: () => { try { source.stop(); } catch { /* Already stopped. */ } source.disconnect(); filter.disconnect(); pan.disconnect(); gain.disconnect(); },
  };
}

// ---------------------------------------------------------------------------
// Base environment (Flow, Stillness, ...)  -  the original recipe, now tunable.
// Level 100, motion 100 and brightness 100 reproduce the original sound exactly.
// ---------------------------------------------------------------------------

export interface BaseParams { level: number; motion: number; bright: number }
export interface BaseHandle { gain: GainNode; set: (params: BaseParams, tc?: number) => void; stop: () => void }

function noiseBuffer(context: AudioContext, seed: number): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
  const data = buffer.getChannelData(0);
  let state = seed >>> 0;
  let smooth = 0;
  for (let index = 0; index < data.length; index++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const random = (state / 2147483648 - 1);
    smooth = smooth * 0.978 + random * 0.022;
    data[index] = smooth * 3.5;
  }
  return buffer;
}

export function makeBase(context: AudioContext, recipe: BaseRecipe, seed: number): BaseHandle {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, context.currentTime);
  const trim = context.createGain();
  trim.connect(gain);
  const sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const shift = 1 + ((seed % 7) - 3) / 100;
  for (const [index, base] of recipe.tones.entries()) {
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = index === 0 ? 'sine' : 'triangle';
    osc.frequency.value = base * shift;
    amp.gain.value = index === 0 ? 0.055 : 0.008;
    osc.connect(amp).connect(trim);
    osc.start();
    sources.push(osc);
  }
  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const noiseAmp = context.createGain();
  noise.buffer = noiseBuffer(context, seed);
  noise.loop = true;
  filter.type = 'lowpass';
  filter.frequency.value = recipe.noiseCut;
  noiseAmp.gain.value = recipe.noiseGain;
  noise.connect(filter).connect(noiseAmp).connect(trim);
  noise.start();
  sources.push(noise);
  let texture: BiquadFilterNode | null = null;
  if (recipe.detail) {
    const detail = context.createBufferSource();
    texture = context.createBiquadFilter();
    const detailGain = context.createGain();
    detail.buffer = noiseBuffer(context, seed ^ 0x5a5a5a);
    detail.loop = true;
    texture.type = recipe.detail.type;
    texture.frequency.value = recipe.detail.freq;
    detailGain.gain.value = recipe.detail.gain;
    detail.connect(texture).connect(detailGain).connect(trim);
    detail.start(); sources.push(detail);
  }
  // Slow timbral motion is sound design, not brainwave therapy.
  const motion = context.createOscillator();
  const motionDepth = context.createGain();
  motion.type = 'sine';
  motion.frequency.value = 0.09 + (seed % 5) * 0.027;
  motionDepth.gain.value = 0.012 * (recipe.motion ?? 1);
  motion.connect(motionDepth).connect(noiseAmp.gain);
  motion.start();
  sources.push(motion);
  return {
    gain,
    set: (params, tc = .08) => {
      const time = context.currentTime;
      trim.gain.setTargetAtTime(params.level / 100, time, tc);
      motionDepth.gain.setTargetAtTime(0.012 * (recipe.motion ?? 1) * params.motion / 100, time, tc);
      filter.frequency.setTargetAtTime(recipe.noiseCut * params.bright / 100, time, tc);
      if (texture && recipe.detail) texture.frequency.setTargetAtTime(recipe.detail.freq * params.bright / 100, time, tc);
    },
    stop: () => { for (const source of sources) { try { source.stop(); } catch { /* Already stopped. */ } } gain.disconnect(); trim.disconnect(); },
  };
}

// ---------------------------------------------------------------------------
// The engine: one signal chain, live-tunable
// ---------------------------------------------------------------------------

function impulseResponse(context: AudioContext): AudioBuffer {
  const seconds = 2.6;
  const length = Math.round(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let state = 0x1234abcd + channel * 977, soft = 0;
    for (let i = 0; i < length; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      soft = soft * .6 + (state / 2147483648 - 1) * .4;
      data[i] = soft * (1 - i / length) ** 2.6;
    }
  }
  return buffer;
}

const warmthFrequency = (warmth: number) => 400 * 50 ** (warmth / 100);
const lowcutFrequency = (lowcut: number) => 20 * 20 ** (lowcut / 100);

/**
 * Maps the 0 to 1 volume slider to the gain in front of the limiter. Low and middle settings stay close to what they
 * were; the top of the range now reaches about +8 dB (2.6 times) more, because 100% used to be too quiet for many
 * speakers and headphones. A soft clipper at the very end keeps peaks below full scale.
 */
export const MAX_BOOST = 1.6;
let boost = MAX_BOOST;
let capShare = 1;
/** Settings: how far the top of the slider goes (Loudness) and the share of the slider that is usable (Volume cap). */
export function setLoudnessBoost(value: number) { boost = Number.isFinite(value) ? Math.max(0, Math.min(4, value)) : MAX_BOOST; }
export function setVolumeCap(percent: number) { capShare = Number.isFinite(percent) ? Math.max(.2, Math.min(1, percent / 100)) : 1; }
export const levelToGain = (level: number) => { const l = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0)) * capShare; return l * (1 + boost * l * l); };

function softClipCurve(): Float32Array {
  const curve = new Float32Array(2049);
  for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(x * 1.1) / Math.tanh(1.1) * .98; }
  return curve;
}

export class StudioEngine {
  readonly context: AudioContext;
  readonly analyser: AnalyserNode;
  private bus: GainNode;
  private lowcut: BiquadFilterNode;
  private warmth: BiquadFilterNode;
  private dry: GainNode;
  private wet: GainNode;
  private breathe: GainNode;
  private lfo: OscillatorNode;
  private lfoDepth: GainNode;
  private pulse: GainNode;
  private pulseLfo: OscillatorNode;
  private pulseDepth: GainNode;
  private duck: GainNode;
  private master: GainNode;
  private base: { key: string; handle: BaseHandle } | null = null;
  private layers = new Map<LayerId, LayerHandle>();
  private buffers = new Map<string, AudioBuffer>();

  constructor() {
    const context = new AudioContext();
    this.context = context;
    this.bus = context.createGain();
    this.lowcut = context.createBiquadFilter(); this.lowcut.type = 'highpass'; this.lowcut.frequency.value = 20;
    this.warmth = context.createBiquadFilter(); this.warmth.type = 'lowpass'; this.warmth.frequency.value = Math.min(20000, context.sampleRate / 2 - 100);
    this.dry = context.createGain();
    this.wet = context.createGain(); this.wet.gain.value = 0;
    const convolver = context.createConvolver(); convolver.buffer = impulseResponse(context);
    this.breathe = context.createGain();
    this.lfo = context.createOscillator(); this.lfo.frequency.value = .1;
    this.lfoDepth = context.createGain(); this.lfoDepth.gain.value = 0;
    this.lfo.connect(this.lfoDepth).connect(this.breathe.gain); this.lfo.start();
    // "Neural lock" rhythm layer: a gentle amplitude pulse over the whole mix. Off (no change in level) until switched on.
    this.pulse = context.createGain();
    this.pulseLfo = context.createOscillator(); this.pulseLfo.frequency.value = 16;
    this.pulseDepth = context.createGain(); this.pulseDepth.gain.value = 0;
    this.pulseLfo.connect(this.pulseDepth).connect(this.pulse.gain); this.pulseLfo.start();
    this.duck = context.createGain();
    this.master = context.createGain(); this.master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -14; limiter.knee.value = 10; limiter.ratio.value = 6;
    limiter.attack.value = .008; limiter.release.value = .28;
    const makeup = context.createGain(); makeup.gain.value = 1.35;
    const clip = context.createWaveShaper(); clip.curve = softClipCurve() as Float32Array<ArrayBuffer>; clip.oversample = '4x';
    this.analyser = context.createAnalyser(); this.analyser.fftSize = 256; this.analyser.smoothingTimeConstant = .82;
    this.bus.connect(this.lowcut).connect(this.warmth);
    this.warmth.connect(this.dry).connect(this.breathe);
    this.warmth.connect(convolver).connect(this.wet).connect(this.breathe);
    this.breathe.connect(this.pulse).connect(this.duck).connect(this.master).connect(limiter).connect(makeup).connect(clip).connect(this.analyser).connect(context.destination);
  }

  private buffer(sound: LayerId, seed: number): AudioBuffer {
    const key = `${sound}:${seed}`;
    let buffer = this.buffers.get(key);
    if (!buffer) { buffer = makeSoundBuffer(this.context, sound, seed); this.buffers.set(key, buffer); }
    return buffer;
  }

  private applyTune(tune: Tune, tc = .06) {
    const time = this.context.currentTime;
    const nyquist = this.context.sampleRate / 2 - 100;
    this.warmth.frequency.setTargetAtTime(Math.min(nyquist, warmthFrequency(tune.warmth)), time, tc);
    this.lowcut.frequency.setTargetAtTime(lowcutFrequency(tune.lowcut), time, tc);
    this.dry.gain.setTargetAtTime(1 - .35 * tune.space / 100, time, tc);
    this.wet.gain.setTargetAtTime(.8 * tune.space / 100, time, tc);
    const depth = .45 * tune.breathing / 100;
    this.breathe.gain.setTargetAtTime(1 - depth / 2, time, tc);
    this.lfoDepth.gain.setTargetAtTime(depth / 2, time, tc);
    this.lfo.frequency.setTargetAtTime(.04 + .26 * tune.breathRate / 100, time, tc);
  }

  /** Bring the audio graph in line with a mix. Cheap to call on every change. */
  sync(mix: MixState, seed: number) {
    const time = this.context.currentTime;
    this.applyTune(mix.tune);
    const baseParams: BaseParams = { level: mix.tune.baseLevel, motion: mix.tune.baseMotion, bright: mix.tune.baseBright };
    const key = `${mix.base}:${seed}`;
    if (this.base?.key !== key) {
      const old = this.base;
      if (old) {
        old.handle.gain.gain.cancelScheduledValues(time);
        old.handle.gain.gain.setValueAtTime(old.handle.gain.gain.value, time);
        old.handle.gain.gain.linearRampToValueAtTime(0, time + .65);
        window.setTimeout(() => old.handle.stop(), 850);
      }
      const handle = makeBase(this.context, baseRecipe[mix.base as BaseId], seed);
      handle.set(baseParams, .001);
      handle.gain.connect(this.bus);
      handle.gain.gain.linearRampToValueAtTime(1, time + .8);
      this.base = { key, handle };
    } else this.base.handle.set(baseParams);

    for (const id of layerIds) {
      const setting = layerSetting(mix, id);
      const existing = this.layers.get(id);
      const recording = setting.level > 0 ? recordingFor(id) : null;
      if (existing && (existing.seed !== seed || setting.level === 0 || existing.recorded !== Boolean(recording))) {
        existing.gain.gain.cancelScheduledValues(time);
        existing.gain.gain.setValueAtTime(existing.gain.gain.value, time);
        existing.gain.gain.linearRampToValueAtTime(0, time + .45);
        window.setTimeout(() => existing.stop(), 700);
        this.layers.delete(id);
      }
      if (setting.level === 0) continue;
      let handle = this.layers.get(id);
      const params: LayerParams = { ...setting, width: mix.tune.width };
      if (!handle) {
        handle = makeAmbientLayer(this.context, id, seed, recording ?? this.buffer(id, seed), Boolean(recording));
        handle.set(params, .001);
        handle.gain.connect(this.bus);
        handle.gain.gain.linearRampToValueAtTime(setting.level / 100 * LAYER_GAIN, time + .55);
        this.layers.set(id, handle);
      } else {
        handle.set(params);
        handle.gain.gain.setTargetAtTime(setting.level / 100 * LAYER_GAIN, time, .08);
      }
    }
    // Drop cached buffers from older variations.
    for (const key of this.buffers.keys()) if (!key.endsWith(`:${seed}`)) this.buffers.delete(key);
  }

  setMaster(level: number, tc = .05) {
    const time = this.context.currentTime;
    this.master.gain.cancelScheduledValues(time);
    this.master.gain.setValueAtTime(this.master.gain.value, time);
    this.master.gain.setTargetAtTime(levelToGain(level), time, tc);
  }
  rampMaster(level: number, seconds: number) {
    const time = this.context.currentTime;
    this.master.gain.cancelScheduledValues(time);
    this.master.gain.setValueAtTime(this.master.gain.value, time);
    this.master.gain.linearRampToValueAtTime(levelToGain(level), time + seconds);
  }
  /** Gentle amplitude pulse over the mix. rate in Hz, depth 0 to 1 (share of the level that swings). depth 0 = exactly the normal sound. */
  setPulse(rate: number, depth: number, tc = .12) {
    const time = this.context.currentTime; const d = Math.max(0, Math.min(.8, depth));
    this.pulseLfo.frequency.setTargetAtTime(Math.max(1, Math.min(60, rate)), time, tc);
    this.pulse.gain.setTargetAtTime(1 - d / 2, time, tc);
    this.pulseDepth.gain.setTargetAtTime(d / 2, time, tc);
  }
  setDuck(level: number, tc = .4) { this.duck.gain.setTargetAtTime(Math.max(0, Math.min(1, level)), this.context.currentTime, tc); }

  dispose() {
    for (const layer of this.layers.values()) layer.stop();
    this.base?.handle.stop();
    this.layers.clear(); this.base = null;
    void this.context.close();
  }
}

/** A short, soft three-note chime for the end of a session or break. */
export function playChime(kind: 'start' | 'end' | 'break' = 'end') {
  try {
    const context = new AudioContext();
    const notes = kind === 'start' ? [523.25, 659.25] : kind === 'break' ? [659.25, 523.25, 392] : [392, 523.25, 659.25];
    const master = context.createGain(); master.gain.value = .22; master.connect(context.destination);
    notes.forEach((frequency, index) => {
      const start = context.currentTime + index * .26;
      const osc = context.createOscillator(); const amp = context.createGain();
      osc.type = 'sine'; osc.frequency.value = frequency;
      amp.gain.setValueAtTime(0, start); amp.gain.linearRampToValueAtTime(1, start + .02); amp.gain.exponentialRampToValueAtTime(.001, start + 1.6);
      osc.connect(amp).connect(master); osc.start(start); osc.stop(start + 1.7);
    });
    window.setTimeout(() => void context.close(), 3200);
  } catch { /* The visual notification still appears. */ }
}

/** A very short, soft tick for quick actions (skip, next, reset). Quieter than the chime so it never fights the mix. */
let uiContext: AudioContext | null = null;
export type UiSound = 'tap' | 'next' | 'skip' | 'reset' | 'start' | 'pause' | 'achieve';
export function playUi(kind: UiSound = 'tap') {
  try {
    uiContext ??= new AudioContext();
    const context = uiContext;
    if (context.state === 'suspended') void context.resume();
    const notes = { tap: [880], next: [660, 880], skip: [740, 988], reset: [660, 494], start: [587, 784], pause: [784, 587], achieve: [523, 659, 784, 1047] }[kind];
    const master = context.createGain(); master.gain.value = .07; master.connect(context.destination);
    notes.forEach((frequency, index) => {
      const start = context.currentTime + index * .085;
      const osc = context.createOscillator(); const amp = context.createGain();
      osc.type = 'sine'; osc.frequency.value = frequency;
      amp.gain.setValueAtTime(0, start); amp.gain.linearRampToValueAtTime(1, start + .008); amp.gain.exponentialRampToValueAtTime(.001, start + .16);
      osc.connect(amp).connect(master); osc.start(start); osc.stop(start + .18);
    });
  } catch { /* A missing tick is fine. */ }
}
