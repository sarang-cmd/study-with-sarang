import { TTS_ENGLISH_ONLY, synthesize, type Deps, type FlowApiSettings, type Keys } from './flowApi';

/** Reads Flow's answers aloud: with the system voice (free, offline) or a voice service. */
export interface SpeakSettings extends FlowApiSettings { speakAnswers: boolean; speakDone: boolean; ttsRate: number; ttsPitch: number; ttsVolume: number; ttsSystemVoice?: string; language: 'auto' | 'en' | 'de' }
/** What happened. A service that failed is never hidden: the text says why, and the system voice took over. */
export interface SpeakResult { engine: 'service' | 'system' | 'none'; error?: string; voice?: string }
let audio: HTMLAudioElement | null = null;
let url = '';

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* No speech. */ }
  if (audio) { audio.pause(); audio = null; }
  if (url) { URL.revokeObjectURL(url); url = ''; }
}

/** The best voice for the language: the one you picked if it fits, else a natural-sounding one, else a local one. */
export function pickVoice(voices: SpeechSynthesisVoice[], language: string, preferred = ''): SpeechSynthesisVoice | null {
  const lang = language.toLowerCase().slice(0, 2);
  if (preferred) { const chosen = voices.find((voice) => voice.name === preferred || voice.voiceURI === preferred); if (chosen && chosen.lang.toLowerCase().startsWith(lang)) return chosen; }
  const matching = voices.filter((voice) => voice.lang.toLowerCase().startsWith(lang));
  const pool = matching.length ? matching : voices.filter((voice) => voice.default);
  return pool.find((voice) => /natural|neural|online/i.test(voice.name)) ?? pool.find((voice) => voice.localService) ?? pool[0] ?? null;
}
export const looksGerman = (text: string) => /\b(ich|und|der|die|das|nicht|ist|ein|eine|wie|was|bitte|lautstärke|stunde|minuten)\b/i.test(text) || /[äöüß]/i.test(text);
const languageFor = (text: string, settings: SpeakSettings) => (settings.language === 'auto' ? (looksGerman(text) ? 'de' : (navigator.language || 'en')) : settings.language);

/** Voices the system offers, once the browser has loaded them (they arrive a moment after start). */
export function systemVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis; if (!synth) { resolve([]); return; }
    const now = synth.getVoices(); if (now.length) { resolve(now); return; }
    const done = () => { synth.removeEventListener('voiceschanged', done); resolve(synth.getVoices()); };
    synth.addEventListener('voiceschanged', done); setTimeout(done, 1500);
  });
}

function speakSystem(clean: string, settings: SpeakSettings, voices: SpeechSynthesisVoice[]): SpeakResult {
  const synth = window.speechSynthesis;
  if (!synth) return { engine: 'none', error: 'This system has no built-in voice.' };
  const utterance = new SpeechSynthesisUtterance(clean);
  const language = languageFor(clean, settings);
  const voice = pickVoice(voices, language, settings.ttsSystemVoice ?? '');
  if (voice) { utterance.voice = voice; utterance.lang = voice.lang; } else utterance.lang = language;
  utterance.rate = settings.ttsRate; utterance.pitch = settings.ttsPitch; utterance.volume = settings.ttsVolume;
  synth.speak(utterance);
  return { engine: 'system', voice: voice?.name };
}

export async function speak(text: string, settings: SpeakSettings, keys: Keys, deps: Deps): Promise<SpeakResult> {
  stopSpeaking();
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!clean || settings.ttsEngine === 'off') return { engine: 'none' };
  let error = '';
  const wantsService = settings.ttsEngine !== 'system';
  // Some voices speak English only: other languages go to the system voice on purpose, without an error.
  const englishOnlySkip = wantsService && TTS_ENGLISH_ONLY.includes(settings.ttsEngine as never) && languageFor(clean, settings).slice(0, 2) !== 'en';
  if (wantsService && !englishOnlySkip) {
    try {
      const { bytes, mime } = await synthesize(clean, settings, keys, deps);
      url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      audio = new Audio(url); audio.volume = settings.ttsVolume; audio.playbackRate = settings.ttsRate;
      await audio.play();
      return { engine: 'service' };
    } catch (failure) { error = failure instanceof Error ? failure.message : 'The voice service did not answer.'; }
  }
  const result = speakSystem(clean, settings, await systemVoices());
  return error ? { ...result, error } : result;
}
